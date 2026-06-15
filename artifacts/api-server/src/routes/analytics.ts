import { Router, type IRouter } from "express";
import { eq, desc, avg, count, gte } from "drizzle-orm";
import { db, usersTable, analysesTable } from "@workspace/db";

const router: IRouter = Router();

function getSession(hour: number, day: number): string {
  // day: 0=Sun, 6=Sat
  const isSunday = day === 0;
  const isSaturday = day === 6;
  if (isSaturday || (isSunday && hour < 21)) return "Weekend";
  if (hour >= 13 && hour < 16) return "London/NY Overlap";
  if (hour >= 7 && hour < 16) return "London";
  if (hour >= 13 && hour < 22) return "New York";
  return "Asian";
}

router.get("/analytics/:userId", async (req, res): Promise<void> => {
  const { userId } = req.params as { userId: string };

  const analyses = await db.select({
    id: analysesTable.id,
    pair: analysesTable.pair,
    direction: analysesTable.direction,
    timeframe: analysesTable.timeframe,
    overallScore: analysesTable.overallScore,
    outcome: analysesTable.outcome,
    emotionScore: analysesTable.emotionScore,
    confluenceData: analysesTable.confluenceData,
    createdAt: analysesTable.createdAt,
  }).from(analysesTable).where(eq(analysesTable.userId, userId)).orderBy(desc(analysesTable.createdAt)).limit(500);

  // Pair performance
  const pairMap: Record<string, { scores: number[]; won: number; lost: number }> = {};
  for (const a of analyses) {
    if (!pairMap[a.pair]) pairMap[a.pair] = { scores: [], won: 0, lost: 0 };
    pairMap[a.pair].scores.push(a.overallScore);
    if (a.outcome === "won") pairMap[a.pair].won++;
    if (a.outcome === "lost") pairMap[a.pair].lost++;
  }
  const pairPerformance = Object.entries(pairMap).map(([pair, d]) => ({
    pair,
    avgScore: Math.round(d.scores.reduce((s, x) => s + x, 0) / d.scores.length),
    winRate: d.scores.length > 0 ? Math.round((d.won / (d.won + d.lost || 1)) * 100) : 0,
    totalTrades: d.scores.length,
    wonTrades: d.won,
    lostTrades: d.lost,
  })).sort((a, b) => b.avgScore - a.avgScore).slice(0, 10);

  // Score trend (last 30 days by day)
  const trendMap: Record<string, { scores: number[]; count: number }> = {};
  for (const a of analyses) {
    const day = a.createdAt.toISOString().split("T")[0];
    if (!trendMap[day]) trendMap[day] = { scores: [], count: 0 };
    trendMap[day].scores.push(a.overallScore);
    trendMap[day].count++;
  }
  const scoreTrend = Object.entries(trendMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([date, d]) => ({
      date,
      avgScore: Math.round(d.scores.reduce((s, x) => s + x, 0) / d.scores.length),
      count: d.count,
    }));

  // Session breakdown
  const sessionMap: Record<string, { scores: number[]; won: number; lost: number }> = {};
  for (const a of analyses) {
    const hour = a.createdAt.getUTCHours();
    const day = a.createdAt.getUTCDay();
    const session = getSession(hour, day);
    if (!sessionMap[session]) sessionMap[session] = { scores: [], won: 0, lost: 0 };
    sessionMap[session].scores.push(a.overallScore);
    if (a.outcome === "won") sessionMap[session].won++;
    if (a.outcome === "lost") sessionMap[session].lost++;
  }
  const sessionBreakdown = Object.entries(sessionMap).map(([session, d]) => ({
    session,
    avgScore: Math.round(d.scores.reduce((s, x) => s + x, 0) / d.scores.length),
    count: d.scores.length,
    winRate: Math.round((d.won / (d.won + d.lost || 1)) * 100),
  }));

  // Direction breakdown
  const dirMap: Record<string, { scores: number[]; won: number; lost: number }> = {};
  for (const a of analyses) {
    if (!dirMap[a.direction]) dirMap[a.direction] = { scores: [], won: 0, lost: 0 };
    dirMap[a.direction].scores.push(a.overallScore);
    if (a.outcome === "won") dirMap[a.direction].won++;
    if (a.outcome === "lost") dirMap[a.direction].lost++;
  }
  const directionBreakdown = Object.entries(dirMap).map(([direction, d]) => ({
    direction,
    count: d.scores.length,
    avgScore: Math.round(d.scores.reduce((s, x) => s + x, 0) / d.scores.length),
    winRate: Math.round((d.won / (d.won + d.lost || 1)) * 100),
  }));

  // Emotion impact
  const emotionBuckets: Record<string, { scores: number[] }> = {
    "1-3 (Fear/Anxious)": { scores: [] },
    "4-6 (Neutral)": { scores: [] },
    "7-8 (Confident)": { scores: [] },
    "9-10 (Overconfident)": { scores: [] },
  };
  for (const a of analyses) {
    const e = a.emotionScore;
    if (e <= 3) emotionBuckets["1-3 (Fear/Anxious)"].scores.push(a.overallScore);
    else if (e <= 6) emotionBuckets["4-6 (Neutral)"].scores.push(a.overallScore);
    else if (e <= 8) emotionBuckets["7-8 (Confident)"].scores.push(a.overallScore);
    else emotionBuckets["9-10 (Overconfident)"].scores.push(a.overallScore);
  }
  const emotionImpact = Object.entries(emotionBuckets)
    .filter(([, d]) => d.scores.length > 0)
    .map(([label, d]) => ({
      label,
      avgScore: Math.round(d.scores.reduce((s, x) => s + x, 0) / d.scores.length),
      count: d.scores.length,
    }));

  // Top mistakes (from analyses with low scores)
  const mistakeMap: Record<string, number> = {};
  for (const a of analyses) {
    if (a.overallScore < 60) {
      const confluence = a.confluenceData as Record<string, number> | null;
      if (confluence) {
        for (const [k, v] of Object.entries(confluence)) {
          if (typeof v === "number" && v < 50) {
            const label = k.replace(/([A-Z])/g, " $1").trim();
            mistakeMap[label] = (mistakeMap[label] ?? 0) + 1;
          }
        }
      }
    }
  }
  const topMistakes = Object.entries(mistakeMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([k]) => k);

  res.json({ pairPerformance, scoreTrend, sessionBreakdown, directionBreakdown, emotionImpact, topMistakes });
});

router.get("/analytics/:userId/export", async (req, res): Promise<void> => {
  const { userId } = req.params as { userId: string };

  const analyses = await db.select().from(analysesTable).where(eq(analysesTable.userId, userId)).orderBy(desc(analysesTable.createdAt));

  const headers = ["Date", "Pair", "Direction", "Timeframe", "Entry", "SL", "TP", "Lot", "Risk%", "R:R", "Score", "Label", "Verdict", "Outcome"].join(",");
  const rows = analyses.map(a => [
    a.createdAt.toISOString().split("T")[0],
    a.pair,
    a.direction,
    a.timeframe,
    a.entryPrice,
    a.stopLoss,
    a.takeProfit,
    a.lotSize,
    a.riskPercent,
    a.rrRatio,
    a.overallScore,
    `"${a.scoreLabel}"`,
    `"${a.verdict.replace(/"/g, "'").slice(0, 80)}"`,
    a.outcome ?? "pending",
  ].join(",")).join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="tradescope-export-${userId}.csv"`);
  res.send(`${headers}\n${rows}`);
});

export default router;
