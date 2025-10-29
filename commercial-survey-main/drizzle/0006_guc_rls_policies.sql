-- Switch RLS policies to rely on application GUCs instead of Postgres roles
-- Assumes transactions set:
--   SELECT set_config('app.role', 'platform'|'seller', true)
--   and for seller flows:
--   SELECT set_config('app.user_id', <sellerId>, true)

-- Ensure RLS remains enabled and enforced (idempotent)
ALTER TABLE public.question_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_responses FORCE ROW LEVEL SECURITY;
ALTER TABLE public.seller_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_progress FORCE ROW LEVEL SECURITY;

-- Platform policies: allow all ops when app.role = 'platform'
CREATE OR REPLACE POLICY qr_platform_all
  ON public.question_responses
  FOR ALL
  TO PUBLIC
  USING (current_setting('app.role', true) = 'platform')
  WITH CHECK (current_setting('app.role', true) = 'platform');

CREATE OR REPLACE POLICY sp_platform_all
  ON public.seller_progress
  FOR ALL
  TO PUBLIC
  USING (current_setting('app.role', true) = 'platform')
  WITH CHECK (current_setting('app.role', true) = 'platform');

-- Seller policies: restrict to own seller_id when app.role = 'seller'
-- SELECT
CREATE OR REPLACE POLICY qr_seller_select
  ON public.question_responses
  FOR SELECT
  TO PUBLIC
  USING (
    current_setting('app.role', true) = 'seller'
    AND seller_id = NULLIF(current_setting('app.user_id', true), '')::int
  );

CREATE OR REPLACE POLICY sp_seller_select
  ON public.seller_progress
  FOR SELECT
  TO PUBLIC
  USING (
    current_setting('app.role', true) = 'seller'
    AND seller_id = NULLIF(current_setting('app.user_id', true), '')::int
  );

-- INSERT
CREATE OR REPLACE POLICY qr_seller_insert
  ON public.question_responses
  FOR INSERT
  TO PUBLIC
  WITH CHECK (
    current_setting('app.role', true) = 'seller'
    AND seller_id = NULLIF(current_setting('app.user_id', true), '')::int
  );

CREATE OR REPLACE POLICY sp_seller_insert
  ON public.seller_progress
  FOR INSERT
  TO PUBLIC
  WITH CHECK (
    current_setting('app.role', true) = 'seller'
    AND seller_id = NULLIF(current_setting('app.user_id', true), '')::int
  );

-- UPDATE
CREATE OR REPLACE POLICY qr_seller_update
  ON public.question_responses
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

CREATE OR REPLACE POLICY sp_seller_update
  ON public.seller_progress
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

