from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
from enum import Enum


# ---------- Auth ----------
class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str = Field(min_length=1)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str


# ---------- Roles ----------
class UserRole(str, Enum):
    owner = "owner"
    admin = "admin"
    analyst = "analyst"


# ---------- Company ----------
class CompanyCreate(BaseModel):
    name: str = Field(min_length=1)
    sector: str = ""
    country: str = ""


class CompanyResponse(BaseModel):
    id: str
    name: str
    sector: str
    country: str
    created_at: str


# ---------- Me ----------
class MeResponse(BaseModel):
    user_id: str
    email: str
    full_name: str
    company_id: Optional[str] = None
    company_name: Optional[str] = None
    role: Optional[str] = None


# ---------- Dataset ----------
class DatasetResponse(BaseModel):
    id: str
    company_id: str
    filename: str
    row_count: Optional[int] = None
    columns: Optional[list] = None
    created_at: str


# ---------- Business Profile ----------
class BusinessProfileCreate(BaseModel):
    name: str
    description: str = ""
    segment_column: str
    price_column: str
    demand_column: str
    date_column: str = ""
    extra_config: dict = {}


class BusinessProfileResponse(BaseModel):
    id: str
    company_id: str
    name: str
    description: str
    segment_column: str
    price_column: str
    demand_column: str
    date_column: str
    extra_config: dict
    created_at: str


# ---------- Twin / Analysis ----------
class TwinBuildRequest(BaseModel):
    dataset_id: str
    profile_id: str
    method: str = "ols"  # ols | bayes
    price_change: float = 0.05


class AnalysisResponse(BaseModel):
    id: str
    company_id: str
    dataset_id: str
    profile_id: str
    method: str
    price_change: float
    status: str
    segments: Optional[list] = None
    model_artifacts: Optional[dict] = None
    summary: Optional[dict] = None
    created_at: str


# ---------- Scenarios ----------
class ScenarioAction(BaseModel):
    segment: str
    price_change: float


class ScenarioCreate(BaseModel):
    name: str
    analysis_id: str
    actions: list[ScenarioAction]


class ScenarioResponse(BaseModel):
    id: str
    company_id: str
    dataset_id: Optional[str] = None
    profile_id: Optional[str] = None
    analysis_id: Optional[str] = None
    name: str
    action_json: list
    result_json: Optional[dict] = None
    explanation_text: Optional[str] = None
    created_at: str
