-- Add visibility flags for seller/home cards on users
ALTER TABLE "users" ADD COLUMN "show_index" boolean DEFAULT true NOT NULL;
ALTER TABLE "users" ADD COLUMN "show_assessment" boolean DEFAULT true NOT NULL;

-- Allow platform role to update these fields
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_platform') THEN
    GRANT UPDATE ("show_index", "show_assessment") ON TABLE public.users TO app_platform;
  END IF;
END$$;

