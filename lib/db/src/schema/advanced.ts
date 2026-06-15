import { pgTable, text, real, integer, timestamp, uuid, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tradeNotesTable = pgTable("trade_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  analysisId: text("analysis_id").notNull(),
  userId: text("user_id").notNull(),
  note: text("note").notNull(),
  mood: text("mood"),
  lessonsLearned: text("lessons_learned"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const priceAlertsTable = pgTable("price_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  pair: text("pair").notNull(),
  targetPrice: real("target_price").notNull(),
  direction: text("direction").notNull(),
  condition: text("condition").notNull().default("above"),
  note: text("note"),
  isActive: boolean("is_active").notNull().default(true),
  triggeredAt: timestamp("triggered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const riskScenariosTable = pgTable("risk_scenarios", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  accountSize: real("account_size").notNull(),
  riskPercent: real("risk_percent").notNull(),
  pair: text("pair").notNull(),
  entryPrice: real("entry_price").notNull(),
  stopLoss: real("stop_loss").notNull(),
  takeProfit: real("take_profit").notNull(),
  lotSize: real("lot_size"),
  pipValue: real("pip_value"),
  riskDollars: real("risk_dollars"),
  rewardDollars: real("reward_dollars"),
  rrRatio: real("rr_ratio"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTradeNoteSchema = createInsertSchema(tradeNotesTable);
export type InsertTradeNote = z.infer<typeof insertTradeNoteSchema>;
export type TradeNote = typeof tradeNotesTable.$inferSelect;

export const insertPriceAlertSchema = createInsertSchema(priceAlertsTable);
export type InsertPriceAlert = z.infer<typeof insertPriceAlertSchema>;
export type PriceAlert = typeof priceAlertsTable.$inferSelect;

export const insertRiskScenarioSchema = createInsertSchema(riskScenariosTable);
export type InsertRiskScenario = z.infer<typeof insertRiskScenarioSchema>;
export type RiskScenario = typeof riskScenariosTable.$inferSelect;
