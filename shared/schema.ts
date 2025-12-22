import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  hhUserId: text("hh_user_id").unique(),
  hhAccessToken: text("hh_access_token"),
  hhRefreshToken: text("hh_refresh_token"),
  hhTokenExpiresAt: timestamp("hh_token_expires_at"),
  email: text("email"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  company: text("company").notNull(),
  salary: text("salary").notNull(),
  description: text("description").notNull(),
  tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
  employmentType: text("employment_type").notNull().default("full-time"),
  location: text("location").notNull().default("Москва"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const swipes = pgTable("swipes", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  vacancyId: text("vacancy_id").notNull(),
  direction: text("direction").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const resumes = pgTable("resumes", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  hhResumeId: text("hh_resume_id"),
  title: text("title"),
  content: text("content").notNull(),
  contentJson: jsonb("content_json"),
  selected: boolean("selected").default(false).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const applications = pgTable("applications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  vacancyId: text("vacancy_id"),
  jobId: integer("job_id"),
  jobTitle: text("job_title").notNull(),
  company: text("company").notNull(),
  resumeId: integer("resume_id").references(() => resumes.id),
  coverLetter: text("cover_letter"),
  hhNegotiationId: text("hh_negotiation_id"),
  status: text("status").notNull().default("pending"),
  errorReason: text("error_reason"),
  appliedAt: timestamp("applied_at").defaultNow().notNull(),
});

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  createdAt: true,
});

export const insertSwipeSchema = createInsertSchema(swipes).omit({
  id: true,
  createdAt: true,
});

export const insertResumeSchema = createInsertSchema(resumes).omit({
  id: true,
  updatedAt: true,
});

export const insertApplicationSchema = createInsertSchema(applications).omit({
  id: true,
  appliedAt: true,
});

export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Swipe = typeof swipes.$inferSelect;
export type InsertSwipe = z.infer<typeof insertSwipeSchema>;
export type Resume = typeof resumes.$inferSelect;
export type InsertResume = z.infer<typeof insertResumeSchema>;
export type Application = typeof applications.$inferSelect;
export type InsertApplication = z.infer<typeof insertApplicationSchema>;

export interface HHJob {
  id: string;
  title: string;
  company: string;
  salary: string;

  // Короткое описание для карточек
  description: string;

  // Полное описание — для генерации сопроводительного письма Гигачатом
  descriptionFull?: string;

  location: string;
  employmentType: string;
  tags: string[];
  url?: string;
  logoUrl?: string;
}


export interface HHJobsResponse {
  jobs: HHJob[];
  hasMore: boolean;
  total: number;
  batch: number;
}

export interface HHResume {
  id: string;
  title: string;
  url: string;
  created_at: string;
  updated_at: string;
  alternate_url: string;
}

export interface HHUserInfo {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

// AI Compatibility table
export const aiCompatibility = pgTable("ai_compatibility", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  vacancyId: text("vacancy_id").notNull(),
  score: integer("score").notNull(),
  color: text("color").notNull(),
  explanation: text("explanation").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAiCompatibilitySchema = createInsertSchema(aiCompatibility).omit({
  id: true,
  createdAt: true,
});

export type AiCompatibility = typeof aiCompatibility.$inferSelect;
export type InsertAiCompatibility = z.infer<typeof insertAiCompatibilitySchema>;

export interface CompatibilityResult {
  vacancyId: string;
  score: number;
  color: "green" | "yellow" | "red";
  explanation: string;
}
