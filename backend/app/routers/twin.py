import json
import pandas as pd
from fastapi import APIRouter, HTTPException, Depends

from app.auth import get_current_user, CurrentUser, require_role
from app.database import get_supabase_service
from app.models.schemas import TwinBuildRequest, AnalysisResponse
from app.services.math_engine import analyze_segment

router = APIRouter(tags=["twin"])


@router.post("/twin/build", response_model=AnalysisResponse)
async def build_twin(
    req: TwinBuildRequest,
    user: CurrentUser = Depends(require_role("owner", "admin", "analyst")),
):
    if not user.company_id:
        raise HTTPException(status_code=400, detail="User must belong to a company")

    sb = get_supabase_service()

    # Load dataset
    ds_result = (
        sb.table("datasets")
        .select("*")
        .eq("id", req.dataset_id)
        .eq("company_id", user.company_id)
        .maybe_single()
        .execute()
    )
    if not ds_result.data:
        raise HTTPException(status_code=404, detail="Dataset not found")
    dataset = ds_result.data

    # Load profile
    prof_result = (
        sb.table("business_profiles")
        .select("*")
        .eq("id", req.profile_id)
        .eq("company_id", user.company_id)
        .maybe_single()
        .execute()
    )
    if not prof_result.data:
        raise HTTPException(status_code=404, detail="Business profile not found")
    profile = prof_result.data

    # Create analysis record (pending)
    analysis_insert = sb.table("analyses").insert({
        "company_id": user.company_id,
        "dataset_id": req.dataset_id,
        "profile_id": req.profile_id,
        "method": req.method,
        "price_change": req.price_change,
        "status": "running",
    }).execute()
    analysis_id = analysis_insert.data[0]["id"]

    try:
        # Load data
        raw_data = dataset.get("raw_data")
        if not raw_data:
            raise ValueError("Dataset has no stored data")

        df = pd.DataFrame(raw_data)

        seg_col = profile["segment_column"]
        price_col = profile["price_column"]
        demand_col = profile["demand_column"]

        # Validate columns exist
        for col in [seg_col, price_col, demand_col]:
            if col not in df.columns:
                raise ValueError(f"Column '{col}' not found in dataset. Available: {df.columns.tolist()}")

        # Run per-segment analysis
        segments = df[seg_col].unique().tolist()
        model_artifacts = {}
        segment_summaries = []

        for seg_name in segments:
            seg_df = df[df[seg_col] == seg_name].copy()
            prices = seg_df[price_col].values
            demands = seg_df[demand_col].values

            result = analyze_segment(
                prices, demands,
                method=req.method,
                price_change=req.price_change,
            )
            model_artifacts[str(seg_name)] = result

            if "error" not in result:
                segment_summaries.append({
                    "segment": str(seg_name),
                    "beta": result["estimation"]["beta"],
                    "r_squared": result["estimation"]["r_squared"],
                    "ci_95": result["bootstrap"]["ci_95"],
                    "baseline_price": result["baseline"]["price"],
                    "baseline_demand": result["baseline"]["demand"],
                    "revenue_change_pct": result["simulation"]["revenue_change_pct"],
                    "regime_used": result["regime"]["regime_used"],
                    "validation_mae": result["validation"].get("mae"),
                })
            else:
                segment_summaries.append({
                    "segment": str(seg_name),
                    "error": result["error"],
                })

        # Build summary
        valid_segments = [s for s in segment_summaries if "error" not in s]
        summary = {
            "total_segments": len(segments),
            "valid_segments": len(valid_segments),
            "avg_elasticity": (
                sum(s["beta"] for s in valid_segments) / len(valid_segments)
                if valid_segments else None
            ),
            "avg_r_squared": (
                sum(s["r_squared"] for s in valid_segments) / len(valid_segments)
                if valid_segments else None
            ),
            "segment_details": segment_summaries,
            "method": req.method,
            "price_change": req.price_change,
        }

        # Persist
        sb.table("analyses").update({
            "status": "completed",
            "segments": [str(s) for s in segments],
            "model_artifacts": model_artifacts,
            "summary": summary,
        }).eq("id", analysis_id).execute()

        return AnalysisResponse(
            id=analysis_id,
            company_id=user.company_id,
            dataset_id=req.dataset_id,
            profile_id=req.profile_id,
            method=req.method,
            price_change=req.price_change,
            status="completed",
            segments=[str(s) for s in segments],
            model_artifacts=model_artifacts,
            summary=summary,
            created_at=analysis_insert.data[0]["created_at"],
        )

    except Exception as e:
        sb.table("analyses").update({
            "status": "failed",
            "error_message": str(e),
        }).eq("id", analysis_id).execute()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/twin/latest", response_model=AnalysisResponse)
async def get_latest_twin(user: CurrentUser = Depends(get_current_user)):
    if not user.company_id:
        raise HTTPException(status_code=400, detail="User must belong to a company")

    sb = get_supabase_service()
    result = (
        sb.table("analyses")
        .select("*")
        .eq("company_id", user.company_id)
        .eq("status", "completed")
        .order("created_at", desc=True)
        .limit(1)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="No completed analysis found")

    a = result.data
    return AnalysisResponse(**a)


@router.get("/twin/analyses", response_model=list[AnalysisResponse])
async def list_analyses(user: CurrentUser = Depends(get_current_user)):
    if not user.company_id:
        raise HTTPException(status_code=400, detail="User must belong to a company")

    sb = get_supabase_service()
    result = (
        sb.table("analyses")
        .select("*")
        .eq("company_id", user.company_id)
        .order("created_at", desc=True)
        .execute()
    )
    return [AnalysisResponse(**a) for a in result.data]


@router.get("/twin/analysis/{analysis_id}", response_model=AnalysisResponse)
async def get_analysis(analysis_id: str, user: CurrentUser = Depends(get_current_user)):
    if not user.company_id:
        raise HTTPException(status_code=400, detail="User must belong to a company")

    sb = get_supabase_service()
    result = (
        sb.table("analyses")
        .select("*")
        .eq("id", analysis_id)
        .eq("company_id", user.company_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return AnalysisResponse(**result.data)
