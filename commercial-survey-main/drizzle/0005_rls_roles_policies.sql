-- RLS bootstrap: roles, grants, policies for commercial-survey
-- This migration is designed to be idempotent on Neon/Postgres 15+

-- 1) Create application roles (group roles, no LOGIN)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'app_platform'
  ) THEN
    CREATE ROLE app_platform NOLOGIN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'app_seller'
  ) THEN
    CREATE ROLE app_seller NOLOGIN;
  END IF;
END$$;

-- 2) Grant membership to the main login role (adjust if your login role differs)
-- This allows the application to `SET ROLE` to app_platform/app_seller safely.
DO $$
DECLARE
  login_role text := 'neondb_owner'; -- change if your login role differs
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = login_role) THEN
    EXECUTE format('GRANT app_platform TO %I', login_role);
    EXECUTE format('GRANT app_seller TO %I', login_role);
  END IF;
END$$;

-- 3) Base grants
GRANT USAGE ON SCHEMA public TO app_platform, app_seller;

-- Global read tables for both roles
GRANT SELECT ON TABLE
  public.survey_steps,
  public.questions,
  public.question_options,
  public.step_questions
TO app_platform, app_seller;

-- Users: platform reads; seller not required in phase 1
GRANT SELECT ON TABLE public.users TO app_platform;

-- Seller-scoped tables: full DML but subject to RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.question_responses TO app_platform, app_seller;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.seller_progress TO app_platform, app_seller;

-- 4) Enable and force RLS on seller-scoped tables
ALTER TABLE public.question_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_responses FORCE ROW LEVEL SECURITY;
ALTER TABLE public.seller_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_progress FORCE ROW LEVEL SECURITY;

-- 5) Policies
-- Platform: allow all operations, still enforced through RLS (no BYPASSRLS)
CREATE OR REPLACE POLICY qr_platform_all
  ON public.question_responses
  FOR ALL
  TO app_platform
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE POLICY sp_platform_all
  ON public.seller_progress
  FOR ALL
  TO app_platform
  USING (true)
  WITH CHECK (true);

-- Seller: restrict to own seller_id based on GUC `app.user_id`
-- Read
CREATE OR REPLACE POLICY qr_seller_select
  ON public.question_responses
  FOR SELECT
  TO app_seller
  USING (
    seller_id = NULLIF(current_setting('app.user_id', true), '')::int
  );

CREATE OR REPLACE POLICY sp_seller_select
  ON public.seller_progress
  FOR SELECT
  TO app_seller
  USING (
    seller_id = NULLIF(current_setting('app.user_id', true), '')::int
  );

-- Insert
CREATE OR REPLACE POLICY qr_seller_insert
  ON public.question_responses
  FOR INSERT
  TO app_seller
  WITH CHECK (
    seller_id = NULLIF(current_setting('app.user_id', true), '')::int
  );

CREATE OR REPLACE POLICY sp_seller_insert
  ON public.seller_progress
  FOR INSERT
  TO app_seller
  WITH CHECK (
    seller_id = NULLIF(current_setting('app.user_id', true), '')::int
  );

-- Update
CREATE OR REPLACE POLICY qr_seller_update
  ON public.question_responses
  FOR UPDATE
  TO app_seller
  USING (
    seller_id = NULLIF(current_setting('app.user_id', true), '')::int
  )
  WITH CHECK (
    seller_id = NULLIF(current_setting('app.user_id', true), '')::int
  );

CREATE OR REPLACE POLICY sp_seller_update
  ON public.seller_progress
  FOR UPDATE
  TO app_seller
  USING (
    seller_id = NULLIF(current_setting('app.user_id', true), '')::int
  )
  WITH CHECK (
    seller_id = NULLIF(current_setting('app.user_id', true), '')::int
  );

