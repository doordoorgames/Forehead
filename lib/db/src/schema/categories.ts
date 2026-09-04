import { serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { foreheadSchema } from "./namespace";

export const categoriesTable = foreheadSchema.table("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default("text"), // "text" | "image"
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const categoryItemsTable = foreheadSchema.table("category_items", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().references(() => categoriesTable.id, { onDelete: "cascade" }),
  itemText: text("item_text").notNull(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const charactersTable = foreheadSchema.table("characters", {
  id: serial("id").primaryKey(),
  answer: text("answer").notNull(),
  hints: text("hints").array().notNull(),
  lang: text("lang").notNull().default("en"), // "en" | "ar"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const charadesTable = foreheadSchema.table("charades", {
  id: serial("id").primaryKey(),
  answer: text("answer").notNull(),
  lang: text("lang").notNull().default("en"), // "en" | "ar"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const dykmCategoriesTable = foreheadSchema.table("dykm_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  lang: text("lang").notNull().default("en"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const dykmQuestionsTable = foreheadSchema.table("dykm_questions", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().references(() => dykmCategoriesTable.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCategorySchema = createInsertSchema(categoriesTable).omit({ id: true, createdAt: true });
export const insertCategoryItemSchema = createInsertSchema(categoryItemsTable).omit({ id: true, createdAt: true });
export const insertCharacterSchema = createInsertSchema(charactersTable).omit({ id: true, createdAt: true });
export const insertCharadeSchema = createInsertSchema(charadesTable).omit({ id: true, createdAt: true });
export const insertDykmCategorySchema = createInsertSchema(dykmCategoriesTable).omit({ id: true, createdAt: true });
export const insertDykmQuestionSchema = createInsertSchema(dykmQuestionsTable).omit({ id: true, createdAt: true });

export type Category = typeof categoriesTable.$inferSelect;
export type CategoryItem = typeof categoryItemsTable.$inferSelect;
export type Character = typeof charactersTable.$inferSelect;
export type Charade = typeof charadesTable.$inferSelect;
export type DykmCategory = typeof dykmCategoriesTable.$inferSelect;
export type DykmQuestion = typeof dykmQuestionsTable.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type InsertCategoryItem = z.infer<typeof insertCategoryItemSchema>;
export type InsertCharacter = z.infer<typeof insertCharacterSchema>;
export type InsertCharade = z.infer<typeof insertCharadeSchema>;
export type InsertDykmCategory = z.infer<typeof insertDykmCategorySchema>;
export type InsertDykmQuestion = z.infer<typeof insertDykmQuestionSchema>;
