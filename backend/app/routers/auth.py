from fastapi import APIRouter, HTTPException, Depends, status
from app.models.schemas import (
    SignupRequest, LoginRequest, AuthResponse, MeResponse,
    CompanyCreate, CompanyResponse,
)
from app.auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, CurrentUser, require_role,
)
from app.database import get_supabase_service

router = APIRouter(tags=["auth"])


@router.post("/auth/signup", response_model=AuthResponse)
async def signup(req: SignupRequest):
    sb = get_supabase_service()

    # Check if email already exists
    existing = sb.table("users").select("id").eq("email", req.email).maybe_single().execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Email already registered")

    pw_hash = hash_password(req.password)
    result = (
        sb.table("users")
        .insert({"email": req.email, "full_name": req.full_name, "password_hash": pw_hash})
        .execute()
    )
    user = result.data[0]
    token = create_access_token({"sub": user["id"], "email": req.email})

    return AuthResponse(
        access_token=token,
        user_id=user["id"],
        email=req.email,
    )


@router.post("/auth/login", response_model=AuthResponse)
async def login(req: LoginRequest):
    sb = get_supabase_service()

    user_row = sb.table("users").select("*").eq("email", req.email).maybe_single().execute()
    if not user_row.data:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user = user_row.data
    if not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": user["id"], "email": user["email"]})

    return AuthResponse(
        access_token=token,
        user_id=user["id"],
        email=user["email"],
    )


@router.get("/me", response_model=MeResponse)
async def get_me(user: CurrentUser = Depends(get_current_user)):
    return MeResponse(
        user_id=user.user_id,
        email=user.email,
        full_name=user.full_name,
        company_id=user.company_id,
        company_name=None,  # filled below if company exists
        role=user.role,
    )


@router.post("/company", response_model=CompanyResponse)
async def create_company(req: CompanyCreate, user: CurrentUser = Depends(get_current_user)):
    sb = get_supabase_service()

    # Check user doesn't already belong to a company
    if user.company_id:
        raise HTTPException(status_code=400, detail="User already belongs to a company")

    # Create company
    result = sb.table("companies").insert({
        "name": req.name,
        "sector": req.sector,
        "country": req.country,
    }).execute()
    company = result.data[0]

    # Link user as owner
    sb.table("company_users").insert({
        "user_id": user.user_id,
        "company_id": company["id"],
        "role": "owner",
    }).execute()

    return CompanyResponse(
        id=company["id"],
        name=company["name"],
        sector=company["sector"],
        country=company["country"],
        created_at=company["created_at"],
    )


@router.get("/company", response_model=CompanyResponse)
async def get_company(user: CurrentUser = Depends(get_current_user)):
    if not user.company_id:
        raise HTTPException(status_code=404, detail="User has no company")

    sb = get_supabase_service()
    result = sb.table("companies").select("*").eq("id", user.company_id).single().execute()
    c = result.data

    return CompanyResponse(
        id=c["id"],
        name=c["name"],
        sector=c["sector"],
        country=c["country"],
        created_at=c["created_at"],
    )
