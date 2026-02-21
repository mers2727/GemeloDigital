-- GemeloDigital Schema Migration 001
-- Multi-tenant SaaS with RLS

-- ============================================================
-- USERS (local auth – not Supabase Auth)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email       text UNIQUE NOT NULL,
    full_name   text NOT NULL DEFAULT '',
    password_hash text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- COMPANIES
-- ============================================================
CREATE TABLE IF NOT EXISTS companies (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL,
    sector      text NOT NULL DEFAULT '',
    country     text NOT NULL DEFAULT '',
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- COMPANY_USERS  (many-to-many with role)
-- ============================================================
CREATE TABLE IF NOT EXISTS company_users (
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    role        text NOT NULL DEFAULT 'analyst'
                CHECK (role IN ('owner','admin','analyst')),
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, company_id)
);

-- ============================================================
-- DATASETS
-- ============================================================
CREATE TABLE IF NOT EXISTS datasets (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    filename    text NOT NULL,
    storage_path text NOT NULL DEFAULT '',
    row_count   int,
    columns     jsonb,
    raw_data    jsonb,          -- optional: normalised rows stored for quick access
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- BUSINESS_PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS business_profiles (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name            text NOT NULL,
    description     text NOT NULL DEFAULT '',
    segment_column  text NOT NULL,
    price_column    text NOT NULL,
    demand_column   text NOT NULL,
    date_column     text NOT NULL DEFAULT '',
    extra_config    jsonb NOT NULL DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- ANALYSES  (persisted twin)
-- ============================================================
CREATE TABLE IF NOT EXISTS analyses (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    dataset_id      uuid NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    profile_id      uuid NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
    method          text NOT NULL DEFAULT 'ols',
    price_change    float NOT NULL DEFAULT 0.05,
    status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','running','completed','failed')),
    segments        jsonb,      -- list of segment names
    model_artifacts jsonb,      -- per-segment: beta, ci, baseline_price, baseline_demand,
                                --   validation_metrics, regime_used, bootstrap_quantiles
    summary         jsonb,      -- high-level summary for dashboard
    error_message   text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- SCENARIOS  (decision simulations)
-- ============================================================
CREATE TABLE IF NOT EXISTS scenarios (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    dataset_id      uuid REFERENCES datasets(id) ON DELETE SET NULL,
    profile_id      uuid REFERENCES business_profiles(id) ON DELETE SET NULL,
    analysis_id     uuid REFERENCES analyses(id) ON DELETE SET NULL,
    name            text NOT NULL,
    action_json     jsonb NOT NULL DEFAULT '[]',
    result_json     jsonb,
    explanation_text text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_company_users_company ON company_users(company_id);
CREATE INDEX IF NOT EXISTS idx_datasets_company ON datasets(company_id);
CREATE INDEX IF NOT EXISTS idx_business_profiles_company ON business_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_analyses_company ON analyses(company_id);
CREATE INDEX IF NOT EXISTS idx_scenarios_company ON scenarios(company_id);
CREATE INDEX IF NOT EXISTS idx_analyses_dataset ON analyses(dataset_id);
CREATE INDEX IF NOT EXISTS idx_scenarios_analysis ON scenarios(analysis_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tenant-scoped tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;

-- Helper: extract user_id from JWT  (works with Supabase Auth JWTs)
-- For local JWT we set the role + claim before each request.

-- COMPANIES: user can see companies they belong to
CREATE POLICY companies_select ON companies FOR SELECT
    USING (id IN (
        SELECT company_id FROM company_users
        WHERE user_id = auth.uid()
    ));

CREATE POLICY companies_insert ON companies FOR INSERT
    WITH CHECK (true);  -- anyone can create a company; membership checked at app level

-- COMPANY_USERS: user can see memberships for their companies
CREATE POLICY company_users_select ON company_users FOR SELECT
    USING (user_id = auth.uid() OR company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
    ));

CREATE POLICY company_users_insert ON company_users FOR INSERT
    WITH CHECK (true);  -- app-level check for who can invite

-- DATASETS
CREATE POLICY datasets_select ON datasets FOR SELECT
    USING (company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
    ));
CREATE POLICY datasets_insert ON datasets FOR INSERT
    WITH CHECK (company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
    ));
CREATE POLICY datasets_update ON datasets FOR UPDATE
    USING (company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
    ));
CREATE POLICY datasets_delete ON datasets FOR DELETE
    USING (company_id IN (
        SELECT company_id FROM company_users
        WHERE user_id = auth.uid() AND role IN ('owner','admin')
    ));

-- BUSINESS_PROFILES
CREATE POLICY profiles_select ON business_profiles FOR SELECT
    USING (company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
    ));
CREATE POLICY profiles_insert ON business_profiles FOR INSERT
    WITH CHECK (company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
    ));
CREATE POLICY profiles_update ON business_profiles FOR UPDATE
    USING (company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
    ));

-- ANALYSES
CREATE POLICY analyses_select ON analyses FOR SELECT
    USING (company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
    ));
CREATE POLICY analyses_insert ON analyses FOR INSERT
    WITH CHECK (company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
    ));
CREATE POLICY analyses_update ON analyses FOR UPDATE
    USING (company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
    ));

-- SCENARIOS
CREATE POLICY scenarios_select ON scenarios FOR SELECT
    USING (company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
    ));
CREATE POLICY scenarios_insert ON scenarios FOR INSERT
    WITH CHECK (company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
    ));
CREATE POLICY scenarios_update ON scenarios FOR UPDATE
    USING (company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
    ));
CREATE POLICY scenarios_delete ON scenarios FOR DELETE
    USING (company_id IN (
        SELECT company_id FROM company_users
        WHERE user_id = auth.uid() AND role IN ('owner','admin')
    ));
