import { pgTable, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const propChallengesTable = pgTable("prop_challenges", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  firmName: text("firm_name").notNull(),
  accountSize: real("account_size").notNull(),
  maxDrawdown: real("max_drawdown").notNull(),
  maxDailyLoss: real("max_daily_loss").notNull(),
  profitTarget: real("profit_target").notNull(),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }),
  phase: text("phase").notNull(),
  currentProfit: real("current_profit").notNull().default(0),
  currentDrawdown: real("current_drawdown").notNull().default(0),
  todayLoss: real("today_loss").notNull().default(0),
  lastResetDate: timestamp("last_reset_date", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const challengeTradeLogsTable = pgTable("challenge_trade_logs", {
  id: text("id").primaryKey(),
  challengeId: text("challenge_id").notNull(),
  pnl: real("pnl").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPropChallengeSchema = createInsertSchema(propChallengesTable);
export type InsertPropChallenge = z.infer<typeof insertPropChallengeSchema>;
export type PropChallenge = typeof propChallengesTable.$inferSelect;

export const insertChallengeTradeLogSchema = createInsertSchema(challengeTradeLogsTable);
export type InsertChallengeTradeLog = z.infer<typeof insertChallengeTradeLogSchema>;
export type ChallengeTradeLog = typeof challengeTradeLogsTable.$inferSelect;
