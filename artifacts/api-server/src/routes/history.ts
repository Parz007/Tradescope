import { Router, type IRouter } from "express";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { db, analysesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/history/:userId", async (req, res): Promise<void> => {
  const { userId } = req.params as { userId: string };

  const analyses = await db
    .select({
      id: analysesTable.id,
      pair: analysesTable.pair,
      direction: analysesTable.direction,
      timeframe: analysesTable.timeframe,
      overallScore: analysesTable.overallScore,
      scoreLabel: analysesTable.scoreLabel,
      verdict: analysesTable.verdict,
      outcome: analysesTable.outcome,
      createdAt: analysesTable.createdAt,
    })
    .from(analysesTable)
    .where(eq(analysesTable.userId, userId))
    .orderBy(desc(analysesTable.createdAt))
    .limit(50);

  res.json({ analyses, total: analyses.length, page: 1, limit: 50 });
});

router.post("/history/:userId/filter", async (req, res): Promise<void> => {
  const { userId } = req.params as { userId: string };
  const { pair, minScore, maxScore, outcome, page = 1, limit = 20 } = req.body as {
    pair?: string | null;
    minScore?: number | null;
    maxScore?: number | null;
    outcome?: string | null;
    page?: number;
    limit?: number;
  };

  const conditions = [eq(analysesTable.userId, userId)];
  if (pair) conditions.push(eq(analysesTable.pair, pair));
  if (outcome) conditions.push(eq(analysesTable.outcome, outcome));
  if (minScore != null) conditions.push(gte(analysesTable.overallScore, minScore));
  if (maxScore != null) conditions.push(lte(analysesTable.overallScore, maxScore));

  const analyses = await db
    .select({
      id: analysesTable.id,
      pair: analysesTable.pair,
      direction: analysesTable.direction,
      timeframe: analysesTable.timeframe,
      overallScore: analysesTable.overallScore,
      scoreLabel: analysesTable.scoreLabel,
      verdict: analysesTable.verdict,
      outcome: analysesTable.outcome,
      createdAt: analysesTable.createdAt,
    })
    .from(analysesTable)
    .where(and(...conditions))
    .orderBy(desc(analysesTable.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  res.json({ analyses, total: analyses.length, page, limit });
});

router.put("/history/:analysisId/outcome", async (req, res): Promise<void> => {
  const { analysisId } = req.params as { analysisId: string };
  const { outcome } = req.body as { outcome: string };

  if (!["won", "lost", "cancelled", "pending"].includes(outcome)) {
    res.status(400).json({ error: "Invalid outcome" });
    return;
  }

  const [updated] = await db
    .update(analysesTable)
    .set({ outcome })
    .where(eq(analysesTable.id, analysisId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  res.json({ ...updated, revengeTradeWarning: updated.revengeTradeWarning === 1 });
});

router.get("/history/:analysisId", async (req, res): Promise<void> => {
  const { analysisId } = req.params as { analysisId: string };

  const [analysis] = await db
    .select()
    .from(analysesTable)
    .where(eq(analysesTable.id, analysisId))
    .limit(1);

  if (!analysis) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  res.json({ ...analysis, revengeTradeWarning: analysis.revengeTradeWarning === 1 });
});

export default router;
