import os
import uuid
import json

import pandas as pd
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File

from app.auth import get_current_user, CurrentUser, require_role
from app.config import get_settings
from app.database import get_supabase_service
from app.models.schemas import DatasetResponse, BusinessProfileCreate, BusinessProfileResponse

router = APIRouter(tags=["datasets"])


@router.post("/datasets/upload", response_model=DatasetResponse)
async def upload_dataset(
    file: UploadFile = File(...),
    user: CurrentUser = Depends(require_role("owner", "admin")),
):
    if not user.company_id:
        raise HTTPException(status_code=400, detail="User must belong to a company")

    # Validate file type
    if not file.filename or not (
        file.filename.endswith(".xlsx")
        or file.filename.endswith(".xls")
        or file.filename.endswith(".csv")
    ):
        raise HTTPException(status_code=400, detail="File must be .xlsx, .xls, or .csv")

    settings = get_settings()
    upload_dir = os.path.join(settings.upload_dir, user.company_id)
    os.makedirs(upload_dir, exist_ok=True)

    # Save file
    file_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename)[1]
    storage_path = os.path.join(upload_dir, f"{file_id}{ext}")

    content = await file.read()
    with open(storage_path, "wb") as f:
        f.write(content)

    # Read and normalize
    try:
        if ext == ".csv":
            df = pd.read_csv(storage_path)
        else:
            df = pd.read_excel(storage_path)
    except Exception as e:
        os.remove(storage_path)
        raise HTTPException(status_code=400, detail=f"Failed to read file: {e}")

    row_count = len(df)
    columns = df.columns.tolist()

    # Store normalized data as JSON in Supabase
    raw_data = json.loads(df.to_json(orient="records", date_format="iso"))

    sb = get_supabase_service()
    result = sb.table("datasets").insert({
        "company_id": user.company_id,
        "filename": file.filename,
        "storage_path": storage_path,
        "row_count": row_count,
        "columns": columns,
        "raw_data": raw_data,
    }).execute()

    ds = result.data[0]
    return DatasetResponse(
        id=ds["id"],
        company_id=ds["company_id"],
        filename=ds["filename"],
        row_count=ds["row_count"],
        columns=ds["columns"],
        created_at=ds["created_at"],
    )


@router.get("/datasets", response_model=list[DatasetResponse])
async def list_datasets(user: CurrentUser = Depends(get_current_user)):
    if not user.company_id:
        raise HTTPException(status_code=400, detail="User must belong to a company")

    sb = get_supabase_service()
    result = (
        sb.table("datasets")
        .select("id, company_id, filename, row_count, columns, created_at")
        .eq("company_id", user.company_id)
        .order("created_at", desc=True)
        .execute()
    )

    return [DatasetResponse(**d) for d in result.data]


@router.get("/datasets/{dataset_id}", response_model=DatasetResponse)
async def get_dataset(dataset_id: str, user: CurrentUser = Depends(get_current_user)):
    if not user.company_id:
        raise HTTPException(status_code=400, detail="User must belong to a company")

    sb = get_supabase_service()
    result = (
        sb.table("datasets")
        .select("id, company_id, filename, row_count, columns, created_at")
        .eq("id", dataset_id)
        .eq("company_id", user.company_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return DatasetResponse(**result.data)


# ── Business Profiles ──

@router.post("/profiles", response_model=BusinessProfileResponse)
async def create_profile(
    req: BusinessProfileCreate,
    user: CurrentUser = Depends(require_role("owner", "admin")),
):
    if not user.company_id:
        raise HTTPException(status_code=400, detail="User must belong to a company")

    sb = get_supabase_service()
    result = sb.table("business_profiles").insert({
        "company_id": user.company_id,
        "name": req.name,
        "description": req.description,
        "segment_column": req.segment_column,
        "price_column": req.price_column,
        "demand_column": req.demand_column,
        "date_column": req.date_column,
        "extra_config": req.extra_config,
    }).execute()

    bp = result.data[0]
    return BusinessProfileResponse(**bp)


@router.get("/profiles", response_model=list[BusinessProfileResponse])
async def list_profiles(user: CurrentUser = Depends(get_current_user)):
    if not user.company_id:
        raise HTTPException(status_code=400, detail="User must belong to a company")

    sb = get_supabase_service()
    result = (
        sb.table("business_profiles")
        .select("*")
        .eq("company_id", user.company_id)
        .order("created_at", desc=True)
        .execute()
    )
    return [BusinessProfileResponse(**bp) for bp in result.data]


@router.get("/profiles/{profile_id}", response_model=BusinessProfileResponse)
async def get_profile(profile_id: str, user: CurrentUser = Depends(get_current_user)):
    if not user.company_id:
        raise HTTPException(status_code=400, detail="User must belong to a company")

    sb = get_supabase_service()
    result = (
        sb.table("business_profiles")
        .select("*")
        .eq("id", profile_id)
        .eq("company_id", user.company_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return BusinessProfileResponse(**result.data)
