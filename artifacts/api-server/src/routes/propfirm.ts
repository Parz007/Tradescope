import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { eq, desc } from "drizzle-orm";
import { db, propChallengesTable, challengeTradeLogsTable } from "@workspace/db";

const router: IRouter = Router();

function calculateStatus(challenge: { currentDrawdown: number; accountSize: number; maxDrawdown: number; todayLoss: number; maxDailyLoss: number; currentProfit: number; profitTarget: number }): string {
  const drawdownPct = challenge.accountSize > 0 ? (challenge.currentDrawdown / (challenge.accountSize * challenge.maxDrawdown / 100)) * 100 : 0;
  const profitPct = challenge.accountSize > 0 ? (challenge.currentProfit / challenge.accountSize) * 100 : 0;

  if (profitPct >= challenge.profitTarget) return "passed";
  if (drawdownPct >= 100 || challenge.currentDrawdown >= (challenge.accountSize * challenge.maxDrawdown / 100)) return "failed";
  if (drawdownPct >= 75) return "danger";
  if (drawdownPct >= 50) return "at_risk";
  return "active";
}

function calculatePassingProbability(challenge: { currentProfit: number; accountSize: number; profitTarget: number; currentDrawdown: number; maxDrawdown: number }): number {
  const profitProgress = challenge.accountSize > 0 ? (challenge.currentProfit / challenge.accountSize) * 100 : 0;
  const drawdownUsed = challenge.accountSize > 0 ? (challenge.currentDrawdown / (challenge.accountSize * challenge.maxDrawdown / 100)) * 100 : 0;

  let prob = 50;
  prob += (profitProgress / challenge.profitTarget) * 30;
  prob -= drawdownUsed * 0.3;
  return Math.max(5, Math.min(95, Math.round(prob)));
}

router.get("/propfirm/challenges/:userId", async (req, res): Promise<void> => {
  const { userId } = req.params as { userId: string };

  const challenges = await db
    .select()
    .from(propChallengesTable)
    .where(eq(propChallengesTable.userId, userId))
    .orderBy(desc(propChallengesTable.createdAt));

  const enriched = await Promise.all(
    challenges.map(async (c) => {
      const trades = await db.select().from(challengeTradeLogsTable).where(eq(challengeTradeLogsTable.challengeId, c.id)).orderBy(desc(challengeTradeLogsTable.createdAt)).limit(5);
      const daysRemaining = c.endDate ? Math.max(0, Math.ceil((new Date(c.endDate).getTime() - Date.now()) / 86400000)) : null;
      return {
        ...c,
        status: calculateStatus(c),
        passingProbability: calculatePassingProbability(c),
        daysRemaining,
        recentTrades: trades,
      };
    })
  );

  res.json(enriched);
});

router.post("/propfirm/challenge", async (req, res): Promise<void> => {
  const body = req.body as {
    userId: string;
    firmName: string;
    accountSize: number;
    maxDrawdown: number;
    maxDailyLoss: number;
    profitTarget: number;
    startDate: string;
    endDate?: string | null;
    phase: string;
  };

  const [challenge] = await db.insert(propChallengesTable).values({
    id: randomUUID(),
    userId: body.userId,
    firmName: body.firmName,
    accountSize: body.accountSize,
    maxDrawdown: body.maxDrawdown,
    maxDailyLoss: body.maxDailyLoss,
    profitTarget: body.profitTarget,
    startDate: new Date(body.startDate),
    endDate: body.endDate ? new Date(body.endDate) : null,
    phase: body.phase,
  }).returning();

  res.status(201).json({
    ...challenge,
    status: "active",
    passingProbability: 50,
    daysRemaining: null,
    recentTrades: [],
  });
});

router.get("/propfirm/challenge/:id", async (req, res): Promise<void> => {
  const { id } = req.params as { id: string };

  const [challenge] = await db.select().from(propChallengesTable).where(eq(propChallengesTable.id, id)).limit(1);
  if (!challenge) {
    res.status(404).json({ error: "Challenge not found" });
    return;
  }

  const trades = await db.select().from(challengeTradeLogsTable).where(eq(challengeTradeLogsTable.challengeId, id)).orderBy(desc(challengeTradeLogsTable.createdAt)).limit(10);
  const daysRemaining = challenge.endDate ? Math.max(0, Math.ceil((new Date(challenge.endDate).getTime() - Date.now()) / 86400000)) : null;

  res.json({ ...challenge, status: calculateStatus(challenge), passingProbability: calculatePassingProbability(challenge), daysRemaining, recentTrades: trades });
});

router.delete("/propfirm/challenge/:id", async (req, res): Promise<void> => {
  const { id } = req.params as { id: string };
  await db.delete(challengeTradeLogsTable).where(eq(challengeTradeLogsTable.challengeId, id));
  await db.delete(propChallengesTable).where(eq(propChallengesTable.id, id));
  res.json({ success: true });
});

router.put("/propfirm/challenge/:id/trade", async (req, res): Promise<void> => {
  const { id } = req.params as { id: string };
  const { pnl, notes } = req.body as { pnl: number; notes?: string | null };

  const [challenge] = await db.select().from(propChallengesTable).where(eq(propChallengesTable.id, id)).limit(1);
  if (!challenge) {
    res.status(404).json({ error: "Challenge not found" });
    return;
  }

  await db.insert(challengeTradeLogsTable).values({ id: randomUUID(), challengeId: id, pnl, notes: notes ?? null });

  // Reset daily loss if new day
  const lastReset = new Date(challenge.lastResetDate).toDateString();
  const today = new Date().toDateString();
  let todayLoss = challenge.todayLoss;
  if (lastReset !== today) todayLoss = 0;
  if (pnl < 0) todayLoss += Math.abs(pnl);

  const newProfit = challenge.currentProfit + pnl;
  const newDrawdown = pnl < 0 ? challenge.currentDrawdown + Math.abs(pnl) : challenge.currentDrawdown;

  const [updated] = await db
    .update(propChallengesTable)
    .set({
      currentProfit: newProfit,
      currentDrawdown: newDrawdown,
      todayLoss,
      lastResetDate: lastReset !== today ? new Date() : challenge.lastResetDate,
      status: calculateStatus({ ...challenge, currentProfit: newProfit, currentDrawdown: newDrawdown, todayLoss }),
    })
    .where(eq(propChallengesTable.id, id))
    .returning();

  const trades = await db.select().from(challengeTradeLogsTable).where(eq(challengeTradeLogsTable.challengeId, id)).orderBy(desc(challengeTradeLogsTable.createdAt)).limit(5);
  const daysRemaining = updated.endDate ? Math.max(0, Math.ceil((new Date(updated.endDate).getTime() - Date.now()) / 86400000)) : null;

  res.json({ ...updated, status: calculateStatus(updated), passingProbability: calculatePassingProbability(updated), daysRemaining, recentTrades: trades });
});

router.post("/propfirm/challenge/:id/simulate", async (req, res): Promise<void> => {
  const { id } = req.params as { id: string };
  const { lossAmount } = req.body as { lossAmount: number };

  const [challenge] = await db.select().from(propChallengesTable).where(eq(propChallengesTable.id, id)).limit(1);
  if (!challenge) {
    res.status(404).json({ error: "Challenge not found" });
    return;
  }

  const loss = Math.abs(lossAmount);
  const newDrawdown = challenge.currentDrawdown + loss;
  const newDailyLoss = challenge.todayLoss + loss;
  const maxDrawdownAmount = challenge.accountSize * challenge.maxDrawdown / 100;
  const maxDailyLossAmount = challenge.accountSize * challenge.maxDailyLoss / 100;

  const drawdownPct = (newDrawdown / maxDrawdownAmount) * 100;
  const dailyLossPct = (newDailyLoss / maxDailyLossAmount) * 100;

  const wouldBreachDrawdown = newDrawdown >= maxDrawdownAmount;
  const wouldBreachDailyLoss = newDailyLoss >= maxDailyLossAmount;

  let message = "";
  if (wouldBreachDrawdown && wouldBreachDailyLoss) {
    message = `This loss would breach BOTH your max drawdown and daily loss limits. Challenge would FAIL.`;
  } else if (wouldBreachDrawdown) {
    message = `This loss would breach your max drawdown limit ($${maxDrawdownAmount.toFixed(2)}). Challenge would FAIL.`;
  } else if (wouldBreachDailyLoss) {
    message = `This loss would breach your daily loss limit ($${maxDailyLossAmount.toFixed(2)}). Trading would be locked for the day.`;
  } else {
    message = `This loss would put you at ${drawdownPct.toFixed(1)}% of max drawdown and ${dailyLossPct.toFixed(1)}% of daily loss limit.`;
  }

  res.json({ newDrawdown, newDailyLoss, drawdownPercent: drawdownPct, dailyLossPercent: dailyLossPct, wouldBreachDrawdown, wouldBreachDailyLoss, message });
});

export default router;
