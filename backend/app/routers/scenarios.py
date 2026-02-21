from fastapi import APIRouter, HTTPException, Depends

from app.auth import get_current_user, CurrentUser, require_role
from app.database import get_supabase_service
from app.models.schemas import ScenarioCreate, ScenarioResponse
from app.services.math_engine import simulate_scenario

router = APIRouter(tags=["scenarios"])


@router.post("/scenarios", response_model=ScenarioResponse)
async def create_scenario(
    req: ScenarioCreate,
    user: CurrentUser = Depends(require_role("owner", "admin", "analyst")),
):
    if not user.company_id:
        raise HTTPException(status_code=400, detail="User must belong to a company")

    sb = get_supabase_service()

    # Load analysis
    analysis_result = (
        sb.table("analyses")
        .select("*")
        .eq("id", req.analysis_id)
        .eq("company_id", user.company_id)
        .eq("status", "completed")
        .maybe_single()
        .execute()
    )
    if not analysis_result.data:
        raise HTTPException(status_code=404, detail="Completed analysis not found")

    analysis = analysis_result.data
    model_artifacts = analysis.get("model_artifacts")
    if not model_artifacts:
        raise HTTPException(status_code=400, detail="Analysis has no model artifacts")

    # Simulate
    actions = [{"segment": a.segment, "price_change": a.price_change} for a in req.actions]
    sim_result = simulate_scenario(model_artifacts, actions)

    # Persist
    insert_result = sb.table("scenarios").insert({
        "company_id": user.company_id,
        "dataset_id": analysis.get("dataset_id"),
        "profile_id": analysis.get("profile_id"),
        "analysis_id": req.analysis_id,
        "name": req.name,
        "action_json": actions,
        "result_json": {
            "segments": sim_result["segments"],
            "aggregate": sim_result["aggregate"],
        },
        "explanation_text": sim_result["explanation"],
    }).execute()

    s = insert_result.data[0]
    return ScenarioResponse(**s)


@router.get("/scenarios", response_model=list[ScenarioResponse])
async def list_scenarios(user: CurrentUser = Depends(get_current_user)):
    if not user.company_id:
        raise HTTPException(status_code=400, detail="User must belong to a company")

    sb = get_supabase_service()
    result = (
        sb.table("scenarios")
        .select("*")
        .eq("company_id", user.company_id)
        .order("created_at", desc=True)
        .execute()
    )
    return [ScenarioResponse(**s) for s in result.data]


@router.get("/scenarios/{scenario_id}", response_model=ScenarioResponse)
async def get_scenario(scenario_id: str, user: CurrentUser = Depends(get_current_user)):
    if not user.company_id:
        raise HTTPException(status_code=400, detail="User must belong to a company")

    sb = get_supabase_service()
    result = (
        sb.table("scenarios")
        .select("*")
        .eq("id", scenario_id)
        .eq("company_id", user.company_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return ScenarioResponse(**result.data)
