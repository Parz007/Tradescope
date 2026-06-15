import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { eq, desc } from "drizzle-orm";
import { db, usersTable, analysesTable } from "@workspace/db";
import { analyzeTrade, analyzeChartImage } from "../services/openrouter";
import { getForexNews } from "../services/newsService";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/analyze", async (req, res): Promise<void> => {
  const body = req.body as {
    userId: string;
    pair: string;
    direction: string;
    timeframe: string;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    lotSize: number;
    riskPercent: number;
    accountSize?: number;
    rrRatio: number;
    reasoning: string;
    emotionScore: number;
    htfBias?: string | null;
    keyLevelsNearby?: boolean | null;
    keyLevelsDescription?: string | null;
    propFirmChallengeId?: string | null;
  };

  if (!body.userId || !body.pair || !body.direction || !body.reasoning) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, body.userId)).limit(1);
  if (!user) {
    res.status(400).json({ error: "User not found" });
    return;
  }

  // Check for revenge trade (last trade was a loss within 30 minutes)
  const lastTrade = await db
    .select()
    .from(analysesTable)
    .where(eq(analysesTable.userId, body.userId))
    .orderBy(desc(analysesTable.createdAt))
    .limit(1);

  const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
  const lastWasLoss = lastTrade[0]?.outcome === "lost" && new Date(lastTrade[0].createdAt) > thirtyMinsAgo;

  // Get news events
  const newsEvents = await getForexNews().catch(() => []);
  const upcomingNews = newsEvents.filter((n) => n.minutesAway >= 0 && n.minutesAway <= 240);

  req.log.info({ pair: body.pair, direction: body.direction }, "Analyzing trade");

  try {
    const result = await analyzeTrade({
      pair: body.pair,
      direction: body.direction,
      timeframe: body.timeframe,
      entryPrice: body.entryPrice,
      stopLoss: body.stopLoss,
      takeProfit: body.takeProfit,
      lotSize: body.lotSize,
      riskPercent: body.riskPercent,
      accountSize: body.accountSize ?? user.accountSize,
      rrRatio: body.rrRatio,
      reasoning: body.reasoning,
      emotionScore: body.emotionScore,
      htfBias: body.htfBias,
      keyLevelsNearby: body.keyLevelsNearby,
      keyLevelsDescription: body.keyLevelsDescription,
      newsEvents: upcomingNews,
      lastTradeResult: lastTrade[0]?.outcome ?? null,
      propFirmActive: !!body.propFirmChallengeId,
    });

    // Override revengeTradeWarning if we detected it
    if (lastWasLoss) result.revengeTradeWarning = true;

    const analysisId = randomUUID();
    const [saved] = await db.insert(analysesTable).values({
      id: analysisId,
      userId: body.userId,
      pair: body.pair,
      direction: body.direction,
      timeframe: body.timeframe,
      entryPrice: body.entryPrice,
      stopLoss: body.stopLoss,
      takeProfit: body.takeProfit,
      lotSize: body.lotSize,
      riskPercent: body.riskPercent,
      rrRatio: body.rrRatio,
      reasoning: body.reasoning,
      emotionScore: body.emotionScore,
      htfBias: body.htfBias ?? null,
      overallScore: result.overallScore,
      scoreLabel: result.scoreLabel,
      confluenceData: result.confluence,
      positives: result.positives,
      warnings: result.warnings,
      negatives: result.negatives,
      verdict: result.verdict,
      devilsAdvocate: result.devilsAdvocate,
      recommendations: result.recommendedActions,
      waitFor: result.waitFor,
      newsAlert: result.newsAlert ? result.newsAlert : null,
      propFirmAlert: result.propFirmAlert ?? null,
      revengeTradeWarning: result.revengeTradeWarning ? 1 : 0,
      lotSizeRecommendation: result.lotSizeRecommendation ?? null,
      outcome: "pending",
    }).returning();

    // Update user streak
    const today = new Date().toDateString();
    const lastActive = user.lastActiveDate ? new Date(user.lastActiveDate).toDateString() : null;
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    let newStreak = user.currentStreak;
    if (lastActive === today) {
      // same day, no change
    } else if (lastActive === yesterday) {
      newStreak = user.currentStreak + 1;
    } else {
      newStreak = 1;
    }

    await db.update(usersTable)
      .set({ currentStreak: newStreak, longestStreak: Math.max(newStreak, user.longestStreak), lastActiveDate: new Date() })
      .where(eq(usersTable.id, body.userId));

    res.json({
      ...saved,
      revengeTradeWarning: saved.revengeTradeWarning === 1,
    });
  } catch (err) {
    logger.error({ err }, "Analysis failed");
    res.status(500).json({ error: "Analysis failed. Please try again." });
  }
});

router.post("/analyze/chart", async (req, res): Promise<void> => {
  const body = req.body as {
    userId: string;
    imageBase64: string;
    mimeType: string;
    emotionScore?: number;
    notes?: string | null;
    newsEvents?: Array<{ title: string; currency: string; minutesAway: number }>;
  };

  if (!body.userId || !body.imageBase64 || !body.mimeType) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  if (body.imageBase64.length > 10_000_000) {
    res.status(400).json({ error: "Image too large. Please use an image under 7MB." });
    return;
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(body.mimeType)) {
    res.status(400).json({ error: "Unsupported image type. Use JPG, PNG or WebP." });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, body.userId)).limit(1);
  if (!user) {
    res.status(400).json({ error: "User not found" });
    return;
  }

  const lastTrade = await db
    .select()
    .from(analysesTable)
    .where(eq(analysesTable.userId, body.userId))
    .orderBy(desc(analysesTable.createdAt))
    .limit(1);

  const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
  const lastWasLoss = lastTrade[0]?.outcome === "lost" && new Date(lastTrade[0].createdAt) > thirtyMinsAgo;

  const newsEvents = body.newsEvents ?? (await getForexNews().catch(() => [])).filter((n) => n.minutesAway >= 0 && n.minutesAway <= 240);

  req.log.info({ userId: body.userId }, "Analysing chart image");

  try {
    const result = await analyzeChartImage({
      imageBase64: body.imageBase64,
      mimeType: body.mimeType,
      emotionScore: body.emotionScore ?? 7,
      notes: body.notes,
      newsEvents,
      lastTradeResult: lastTrade[0]?.outcome ?? null,
      propFirmActive: false,
    });

    if (lastWasLoss) result.revengeTradeWarning = true;

    const analysisId = randomUUID();
    const [saved] = await db.insert(analysesTable).values({
      id: analysisId,
      userId: body.userId,
      pair: "Chart Analysis",
      direction: "buy",
      timeframe: "chart",
      entryPrice: 0,
      stopLoss: 0,
      takeProfit: 0,
      lotSize: 0,
      riskPercent: 0,
      rrRatio: 0,
      reasoning: body.notes ?? "Chart analysis",
      emotionScore: body.emotionScore ?? 7,
      htfBias: null,
      overallScore: result.overallScore,
      scoreLabel: result.scoreLabel,
      confluenceData: result.confluence,
      positives: result.positives,
      warnings: result.warnings,
      negatives: result.negatives,
      verdict: result.verdict,
      devilsAdvocate: result.devilsAdvocate,
      recommendations: result.recommendedActions,
      waitFor: result.waitFor,
      newsAlert: result.newsAlert ?? null,
      propFirmAlert: result.propFirmAlert ?? null,
      revengeTradeWarning: result.revengeTradeWarning ? 1 : 0,
      lotSizeRecommendation: result.lotSizeRecommendation ?? null,
      outcome: "pending",
    }).returning();

    const today = new Date().toDateString();
    const lastActive = user.lastActiveDate ? new Date(user.lastActiveDate).toDateString() : null;
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    let newStreak = user.currentStreak;
    if (lastActive === today) {
      // same day — no change
    } else if (lastActive === yesterday) {
      newStreak = user.currentStreak + 1;
    } else {
      newStreak = 1;
    }

    await db.update(usersTable)
      .set({ currentStreak: newStreak, longestStreak: Math.max(newStreak, user.longestStreak), lastActiveDate: new Date() })
      .where(eq(usersTable.id, body.userId));

    res.json({ ...saved, revengeTradeWarning: saved.revengeTradeWarning === 1 });
  } catch (err) {
    logger.error({ err }, "Chart analysis failed");
    res.status(500).json({ error: "Chart analysis failed. Please try again." });
  }
});

export default router;
