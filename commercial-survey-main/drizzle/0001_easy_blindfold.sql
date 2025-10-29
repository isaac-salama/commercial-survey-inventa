CREATE TYPE "public"."user_role" AS ENUM('platform', 'seller');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'seller' NOT NULL;