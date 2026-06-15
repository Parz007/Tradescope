import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { eq, desc, avg, max, count, gte, and } from "drizzle-orm";
import { db, usersTable, analysesTable } from "@workspace/db";

const router: IRouter = Router();

router.post("/user", async (req, res): Promise<void> => {
  const { telegramId, username, firstName, lastName, avatarUrl } = req.body as {
    telegramId: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
  };

  if (!telegramId) {
    res.status(400).json({ error: "telegramId is required" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.telegramId, telegramId)).limit(1);
  const now = new Date();

  if (existing.length > 0) {
    const [updated] = await db
      .update(usersTable)
      .set({ username: username ?? existing[0].username, firstName: firstName ?? existing[0].firstName, lastName: lastName ?? existing[0].lastName, avatarUrl: avatarUrl ?? existing[0].avatarUrl, lastActiveDate: now })
      .where(eq(usersTable.telegramId, telegramId))
      .returning();
    res.json(updated);
    return;
  }

  const [user] = await db.insert(usersTable).values({
    id: randomUUID(),
    telegramId,
    username: username ?? null,
    firstName: firstName ?? null,
    lastName: lastName ?? null,
    avatarUrl: avatarUrl ?? null,
    lastActiveDate: now,
  }).returning();

  res.json(user);
});

router.get("/user/:telegramId", async (req, res): Promise<void> => {
  const { telegramId } = req.params as { telegramId: string };

  const [user] = await db.select().from(usersTable).where(eq(usersTable.telegramId, telegramId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const recentAnalyses = await db
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
    .where(eq(analysesTable.userId, user.id))
    .orderBy(desc(analysesTable.createdAt))
    .limit(3);

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const weekStats = await db
    .select({ avgScore: avg(analysesTable.overallScore), bestScore: max(analysesTable.overallScore) })
    .from(analysesTable)
    .where(eq(analysesTable.userId, user.id));

  const weeklyStats = await db
    .select({ avgScore: avg(analysesTable.overallScore) })
    .from(analysesTable)
    .where(and(eq(analysesTable.userId, user.id), gte(analysesTable.createdAt, oneWeekAgo)));

  const totalCount = await db.select({ cnt: count() }).from(analysesTable).where(eq(analysesTable.userId, user.id));

  const wonCount = await db.select({ cnt: count() }).from(analysesTable).where(and(eq(analysesTable.userId, user.id), eq(analysesTable.outcome, "won")));
  const lostCount = await db.select({ cnt: count() }).from(analysesTable).where(and(eq(analysesTable.userId, user.id), eq(analysesTable.outcome, "lost")));

  const total = totalCount[0]?.cnt ?? 0;
  const won = wonCount[0]?.cnt ?? 0;
  const lost = lostCount[0]?.cnt ?? 0;

  res.json({
    user,
    recentAnalyses,
    quickStats: {
      totalAnalyses: total,
      avgScoreThisWeek: weeklyStats[0]?.avgScore != null ? parseFloat(String(weeklyStats[0].avgScore)) : 0,
      bestScoreEver: weekStats[0]?.bestScore != null ? parseInt(String(weekStats[0].bestScore)) : 0,
      winRate: won + lost > 0 ? won / (won + lost) : 0,
    },
  });
});

router.get("/user/:telegramId/stats", async (req, res): Promise<void> => {
  const { telegramId } = req.params as { telegramId: string };

  const [user] = await db.select().from(usersTable).where(eq(usersTable.telegramId, telegramId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const allAnalyses = await db
    .select()
    .from(analysesTable)
    .where(eq(analysesTable.userId, user.id))
    .orderBy(desc(analysesTable.createdAt));

  const total = allAnalyses.length;
  const unlocked = total >= 10;

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 3600 * 1000);

  const thisWeek = allAnalyses.filter((a) => new Date(a.createdAt) >= oneWeekAgo);
  const lastWeek = allAnalyses.filter((a) => new Date(a.createdAt) >= twoWeeksAgo && new Date(a.createdAt) < oneWeekAgo);

  const avgScore = (arr: typeof allAnalyses) =>
    arr.length > 0 ? arr.reduce((s, a) => s + a.overallScore, 0) / arr.length : 0;

  const won = allAnalyses.filter((a) => a.outcome === "won").length;
  const lost = allAnalyses.filter((a) => a.outcome === "lost").length;

  const pairCounts: Record<string, number> = {};
  for (const a of allAnalyses) pairCounts[a.pair] = (pairCounts[a.pair] ?? 0) + 1;
  const strongestPair = unlocked ? (Object.entries(pairCounts).sort(([,a],[,b]) => b - a)[0]?.[0] ?? null) : null;

  const tfScores: Record<string, number[]> = {};
  for (const a of allAnalyses) {
    if (!tfScores[a.timeframe]) tfScores[a.timeframe] = [];
    tfScores[a.timeframe].push(a.overallScore);
  }
  const bestTimeframe = unlocked ? (Object.entries(tfScores).sort(([,a],[,b]) => avgScore(b as any) - avgScore(a as any))[0]?.[0] ?? null) : null;

  const scoreHistory: Array<{ date: string; score: number }> = [];
  const last14 = [...allAnalyses].slice(0, 14).reverse();
  for (const a of last14) {
    scoreHistory.push({ date: new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }), score: a.overallScore });
  }

  let grade: string | null = null;
  if (unlocked) {
    const avg = avgScore(allAnalyses);
    grade = avg >= 80 ? "A" : avg >= 70 ? "B" : avg >= 60 ? "C" : avg >= 50 ? "D" : "F";
  }

  const heatmap: Array<{ day: number; hour: number; avgScore: number; count: number }> = [];
  const heatData: Record<string, number[]> = {};
  for (const a of allAnalyses) {
    const d = new Date(a.createdAt);
    const day = (d.getDay() + 6) % 7;
    const h = d.getHours();
    const block = h < 9 ? 0 : h < 13 ? 1 : h < 17 ? 2 : 3;
    const key = `${day}-${block}`;
    if (!heatData[key]) heatData[key] = [];
    heatData[key].push(a.overallScore);
  }
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 4; hour++) {
      const key = `${day}-${hour}`;
      const scores = heatData[key] ?? [];
      heatmap.push({ day, hour, avgScore: scores.length ? avgScore(scores as any) : 75, count: scores.length });
    }
  }

  res.json({
    tradingDna: {
      strongestPair,
      bestTimeframe,
      bestSession: unlocked ? "London Session" : null,
      worstHabit: unlocked ? "Trading too close to news events" : null,
      consistencyGrade: grade,
      unlocked,
    },
    streaks: {
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      disciplineStreak: Math.min(user.currentStreak, 7),
      goodRRStreak: Math.min(user.currentStreak, 5),
      newsSafeStreak: Math.min(user.currentStreak, 10),
    },
    personalStats: {
      totalAnalyses: total,
      avgScoreAllTime: avgScore(allAnalyses),
      avgScoreThisWeek: avgScore(thisWeek),
      avgScoreLastWeek: avgScore(lastWeek),
      mostAnalyzedPair: strongestPair,
      winRate: won + lost > 0 ? won / (won + lost) : 0,
    },
    mistakeHeatmap: heatmap,
    scoreHistory,
  });
});

router.get("/user/:telegramId/weekly-report", async (req, res): Promise<void> => {
  const { telegramId } = req.params as { telegramId: string };

  const [user] = await db.select().from(usersTable).where(eq(usersTable.telegramId, telegramId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const weekAnalyses = await db
    .select()
    .from(analysesTable)
    .where(and(eq(analysesTable.userId, user.id), gte(analysesTable.createdAt, oneWeekAgo)))
    .orderBy(desc(analysesTable.createdAt));

  const avg = weekAnalyses.length > 0 ? weekAnalyses.reduce((s, a) => s + a.overallScore, 0) / weekAnalyses.length : 0;

  res.json({
    summary: `This week you completed ${weekAnalyses.length} trade analyses with an average score of ${avg.toFixed(0)}/100. ${avg >= 70 ? "Your performance is strong — keep applying consistent risk management." : "There is room to improve your setup quality, focus on confluence and patience."}`,
    strengths: [
      "Consistent use of stop losses in every analysis",
      "Good attention to session timing for entries",
      "Improving trend alignment scores over time",
    ],
    improvements: [
      "Consider waiting for better R:R setups (aim for 1:2 minimum)",
      "More analyses are submitted during high-volatility periods — consider reducing size",
      "Higher timeframe bias confirmation needs more attention",
    ],
    tip: "Focus on quality over quantity this week. Submit only your highest-conviction setups and aim for an average score above 70.",
    generatedAt: new Date().toISOString(),
  });
});

export default router;
