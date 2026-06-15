import { pgTable, text, real, integer, json, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const analysesTable = pgTable("analyses", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  pair: text("pair").notNull(),
  direction: text("direction").notNull(),
  timeframe: text("timeframe").notNull(),
  entryPrice: real("entry_price").notNull(),
  stopLoss: real("stop_loss").notNull(),
  takeProfit: real("take_profit").notNull(),
  lotSize: real("lot_size").notNull(),
  riskPercent: real("risk_percent").notNull(),
  rrRatio: real("rr_ratio").notNull(),
  reasoning: text("reasoning").notNull(),
  emotionScore: integer("emotion_score").notNull(),
  htfBias: text("htf_bias"),
  overallScore: integer("overall_score").notNull(),
  scoreLabel: text("score_label").notNull(),
  confluenceData: json("confluence_data").notNull(),
  positives: json("positives").notNull(),
  warnings: json("warnings").notNull(),
  negatives: json("negatives").notNull(),
  verdict: text("verdict").notNull(),
  devilsAdvocate: json("devils_advocate").notNull(),
  recommendations: json("recommendations").notNull(),
  waitFor: text("wait_for").notNull(),
  newsAlert: json("news_alert"),
  propFirmAlert: text("prop_firm_alert"),
  revengeTradeWarning: integer("revenge_trade_warning").notNull().default(0),
  lotSizeRecommendation: real("lot_size_recommendation"),
  screenshotUrl: text("screenshot_url"),
  outcome: text("outcome"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAnalysisSchema = createInsertSchema(analysesTable);
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof analysesTable.$inferSelect;
