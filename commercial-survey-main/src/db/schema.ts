import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  pgEnum,
  integer,
  boolean,
  index,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["platform", "seller"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  image: text("image"),
  passwordHash: text("password_hash").notNull(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  lastLoginAt: timestamp("last_login_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  role: userRole("role").notNull().default("seller"),
  // Per-seller visibility controls for seller/home cards
  showIndex: boolean("show_index").notNull().default(true),
  showAssessment: boolean("show_assessment").notNull().default(true),
});

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// Survey structure (single survey assumed)

export const surveySteps = pgTable(
  "survey_steps",
  {
    id: serial("id").primaryKey(),
    key: varchar("key", { length: 100 }).notNull().unique(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    order: integer("order").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    orderIdx: index("survey_steps_order_idx").on(t.order),
  })
);

export const questions = pgTable(
  "questions",
  {
    id: serial("id").primaryKey(),
    key: varchar("key", { length: 100 }).notNull().unique(),
    label: text("label").notNull(),
    helpText: text("help_text"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  }
);

export const questionOptions = pgTable(
  "question_options",
  {
    id: serial("id").primaryKey(),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade", onUpdate: "cascade" }),
    value: varchar("value", { length: 100 }).notNull(),
    label: text("label").notNull(),
    order: integer("order").notNull(),
    score: integer("score").notNull(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => ({
    byQuestionValueUnique: uniqueIndex("question_options_question_id_value_unique").on(
      t.questionId,
      t.value
    ),
    byQuestionOrderIdx: index("question_options_question_id_order_idx").on(t.questionId, t.order),
  })
);

export const stepQuestions = pgTable(
  "step_questions",
  {
    id: serial("id").primaryKey(),
    stepId: integer("step_id")
      .notNull()
      .references(() => surveySteps.id, { onDelete: "restrict", onUpdate: "cascade" }),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict", onUpdate: "cascade" }),
    order: integer("order").notNull(),
    required: boolean("required").notNull().default(true),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    byStepOrderIdx: index("step_questions_step_id_order_idx").on(t.stepId, t.order),
    byStepQuestionUnique: uniqueIndex("step_questions_step_id_question_id_unique").on(
      t.stepId,
      t.questionId
    ),
  })
);

// Answers and progress

export const questionResponses = pgTable(
  "question_responses",
  {
    id: serial("id").primaryKey(),
    sellerId: integer("seller_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade", onUpdate: "cascade" }),
    optionId: integer("option_id")
      .notNull()
      .references(() => questionOptions.id, { onDelete: "cascade", onUpdate: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    bySellerQuestionUnique: uniqueIndex("question_responses_seller_id_question_id_unique").on(
      t.sellerId,
      t.questionId
    ),
    bySellerIdx: index("question_responses_seller_id_idx").on(t.sellerId),
    byQuestionIdx: index("question_responses_question_id_idx").on(t.questionId),
  })
);

export const sellerProgress = pgTable("seller_progress", {
  sellerId: integer("seller_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
  lastStepId: integer("last_step_id").references(() => surveySteps.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  lastStepOrder: integer("last_step_order"),
  reachedStep8: boolean("reached_step8").notNull().default(false),
  reachedStep8At: timestamp("reached_step8_at", { mode: "date" }),
  receivedReturn: boolean("received_return").notNull().default(false),
  receivedReturnMarkedAt: timestamp("received_return_marked_at", { mode: "date" }),
  receivedReturnMarkedByUserId: integer("received_return_marked_by_user_id").references(() => users.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

// Seller assessments (free-form business assessment captured as JSONB)
export const assessmentStatus = pgEnum("assessment_status", ["draft", "submitted"]);

export type SellerAssessmentData = {
  solution?: "unlock_full_service" | "unlock_response" | "unlock_fulfillment";
  vendaPorRegiao?: {
    sul?: number;
    sudeste?: number;
    norte?: number;
    nordeste?: number;
    centroOeste?: number;
  };
  modeloFiscal?: {
    compraEVenda?: boolean;
    filial?: boolean;
    remessaArmazemGeral?: boolean;
  };
  volumeMensalPedidos?: number;
  itensPorPedido?: number;
  skus?: number;
  ticketMedio?: number;
  canais?: string;
  gmvFlagshipMensal?: number;
  gmvMarketplacesMensal?: number;
  mesesCoberturaEstoque?: number;
  perfilProduto?: string;
  pesoMedioKg?: number;
  dimensoesCm?: { c?: number; l?: number; a?: number };
  reversaPercent?: number;
  projetosEspeciais?: string;
  comentarios?: string | null;
};

export const sellerAssessments = pgTable(
  "seller_assessments",
  {
    sellerId: integer("seller_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    status: assessmentStatus("status").notNull().default("draft"),
    data: jsonb("data").notNull().$type<SellerAssessmentData>(),
    submittedAt: timestamp("submitted_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    bySellerIdx: index("seller_assessments_seller_id_idx").on(t.sellerId),
  })
);

// Password reset tokens (hashed token storage)
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    tokenHash: varchar("token_hash", { length: 255 }).notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    usedAt: timestamp("used_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    byTokenHashUnique: uniqueIndex("password_reset_tokens_token_hash_unique").on(t.tokenHash),
    byEmailIdx: index("password_reset_tokens_email_idx").on(t.email),
  })
);
