-- Seller Assessments table to store business assessment as JSONB per seller

-- 1) Enum for assessment status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'assessment_status'
  ) THEN
    CREATE TYPE assessment_status AS ENUM ('draft', 'submitted');
  END IF;
END$$;

-- 2) Table
CREATE TABLE IF NOT EXISTS public.seller_assessments (
  seller_id integer PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  status assessment_status NOT NULL DEFAULT 'draft',
  data jsonb NOT NULL,
  submitted_at timestamp NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- 3) Basic index
CREATE INDEX IF NOT EXISTS seller_assessments_seller_id_idx ON public.seller_assessments (seller_id);

-- 4) Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.seller_assessments TO app_platform, app_seller;

-- 5) RLS
ALTER TABLE public.seller_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_assessments FORCE ROW LEVEL SECURITY;

-- Platform policies: allow all ops when app.role = 'platform'
CREATE OR REPLACE POLICY sa_platform_all
  ON public.seller_assessments
  FOR ALL
  TO PUBLIC
  USING (current_setting('app.role', true) = 'platform')
  WITH CHECK (current_setting('app.role', true) = 'platform');

-- Seller policies: restrict to own seller_id when app.role = 'seller'
-- SELECT
CREATE OR REPLACE POLICY sa_seller_select
  ON public.seller_assessments
  FOR SELECT
  TO PUBLIC
  USING (
    current_setting('app.role', true) = 'seller'
    AND seller_id = NULLIF(current_setting('app.user_id', true), '')::int
  );

-- INSERT
CREATE OR REPLACE POLICY sa_seller_insert
  ON public.seller_assessments
  FOR INSERT
  TO PUBLIC
  WITH CHECK (
    current_setting('app.role', true) = 'seller'
    AND seller_id = NULLIF(current_setting('app.user_id', true), '')::int
  );

-- UPDATE
CREATE OR REPLACE POLICY sa_seller_update
  ON public.seller_assessments
  FOR UPDATE
  TO PUBLIC
  USING (
    current_setting('app.role', true) = 'seller'
    AND seller_id = NULLIF(current_setting('app.user_id', true), '')::int
  )
  WITH CHECK (
    current_setting('app.role', true) = 'seller'
    AND seller_id = NULLIF(current_setting('app.user_id', true), '')::int
  );

