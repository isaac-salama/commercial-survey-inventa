CREATE TABLE "question_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_id" integer NOT NULL,
	"value" varchar(100) NOT NULL,
	"label" text NOT NULL,
	"order" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"seller_id" integer NOT NULL,
	"question_id" integer NOT NULL,
	"option_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(100) NOT NULL,
	"label" text NOT NULL,
	"help_text" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "questions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "seller_progress" (
	"seller_id" integer PRIMARY KEY NOT NULL,
	"last_step_id" integer,
	"last_step_order" integer,
	"reached_step8" boolean DEFAULT false NOT NULL,
	"reached_step8_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "step_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"step_id" integer NOT NULL,
	"question_id" integer NOT NULL,
	"order" integer NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"order" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "survey_steps_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "question_responses" ADD CONSTRAINT "question_responses_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "question_responses" ADD CONSTRAINT "question_responses_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "question_responses" ADD CONSTRAINT "question_responses_option_id_question_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."question_options"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "seller_progress" ADD CONSTRAINT "seller_progress_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "seller_progress" ADD CONSTRAINT "seller_progress_last_step_id_survey_steps_id_fk" FOREIGN KEY ("last_step_id") REFERENCES "public"."survey_steps"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "step_questions" ADD CONSTRAINT "step_questions_step_id_survey_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."survey_steps"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "step_questions" ADD CONSTRAINT "step_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "question_options_question_id_value_unique" ON "question_options" USING btree ("question_id","value");--> statement-breakpoint
CREATE INDEX "question_options_question_id_order_idx" ON "question_options" USING btree ("question_id","order");--> statement-breakpoint
CREATE UNIQUE INDEX "question_responses_seller_id_question_id_unique" ON "question_responses" USING btree ("seller_id","question_id");--> statement-breakpoint
CREATE INDEX "question_responses_seller_id_idx" ON "question_responses" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "question_responses_question_id_idx" ON "question_responses" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "step_questions_step_id_order_idx" ON "step_questions" USING btree ("step_id","order");--> statement-breakpoint
CREATE UNIQUE INDEX "step_questions_step_id_question_id_unique" ON "step_questions" USING btree ("step_id","question_id");--> statement-breakpoint
CREATE INDEX "survey_steps_order_idx" ON "survey_steps" USING btree ("order");