export interface AuthResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  email: string;
}

export interface MeResponse {
  user_id: string;
  email: string;
  full_name: string;
  company_id: string | null;
  company_name: string | null;
  role: string | null;
}

export interface Company {
  id: string;
  name: string;
  sector: string;
  country: string;
  created_at: string;
}

export interface Dataset {
  id: string;
  company_id: string;
  filename: string;
  row_count: number | null;
  columns: string[] | null;
  created_at: string;
}

export interface BusinessProfile {
  id: string;
  company_id: string;
  name: string;
  description: string;
  segment_column: string;
  price_column: string;
  demand_column: string;
  date_column: string;
  extra_config: Record<string, unknown>;
  created_at: string;
}

export interface SegmentDetail {
  segment: string;
  beta?: number;
  r_squared?: number;
  ci_95?: [number, number];
  baseline_price?: number;
  baseline_demand?: number;
  revenue_change_pct?: number;
  regime_used?: string;
  validation_mae?: number | null;
  error?: string;
}

export interface AnalysisSummary {
  total_segments: number;
  valid_segments: number;
  avg_elasticity: number | null;
  avg_r_squared: number | null;
  segment_details: SegmentDetail[];
  method: string;
  price_change: number;
}

export interface Analysis {
  id: string;
  company_id: string;
  dataset_id: string;
  profile_id: string;
  method: string;
  price_change: number;
  status: string;
  segments: string[] | null;
  model_artifacts: Record<string, unknown> | null;
  summary: AnalysisSummary | null;
  created_at: string;
}

export interface ScenarioAction {
  segment: string;
  price_change: number;
}

export interface Scenario {
  id: string;
  company_id: string;
  dataset_id: string | null;
  profile_id: string | null;
  analysis_id: string | null;
  name: string;
  action_json: ScenarioAction[];
  result_json: Record<string, unknown> | null;
  explanation_text: string | null;
  created_at: string;
}
