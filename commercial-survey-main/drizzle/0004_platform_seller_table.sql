-- Add last_login_at to users
ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp;

-- Add received_return fields to seller_progress
ALTER TABLE "seller_progress" ADD COLUMN "received_return" boolean DEFAULT false NOT NULL;
ALTER TABLE "seller_progress" ADD COLUMN "received_return_marked_at" timestamp;
ALTER TABLE "seller_progress" ADD COLUMN "received_return_marked_by_user_id" integer REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;

-- Helpful indexes for filtering and sorting
CREATE INDEX IF NOT EXISTS "users_last_login_at_idx" ON "users" USING btree ("last_login_at");
CREATE INDEX IF NOT EXISTS "users_created_at_idx" ON "users" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users" USING btree ("role");
CREATE INDEX IF NOT EXISTS "seller_progress_received_return_idx" ON "seller_progress" USING btree ("received_return");
CREATE INDEX IF NOT EXISTS "seller_progress_reached_step8_idx" ON "seller_progress" USING btree ("reached_step8");

