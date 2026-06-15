import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, riskScenariosTable } from "@workspace/db";
import { randomUUID } from "crypto";

const router: IRouter = Router();

const JPY_PAIRS = ["USD/JPY", "EUR/JPY", "GBP/JPY", "CAD/JPY", "AUD/JPY", "NZD/JPY", "CHF/JPY"];
const XAU_PAIRS = ["XAU/USD"];

function getPipSize(pair: string): number {
  if (JPY_PAIRS.includes(pair)) return 0.01;
  if (XAU_PAIRS.includes(pair)) return 0.1;
  return 0.0001;
}

function calculatePipValue(pair: string, lotSize: number): number {
  const pipSize = getPipSize(pair);
  if (JPY_PAIRS.includes(pair)) return lotSize * 100000 * pipSize / 100;
  if (XAU_PAIRS.includes(pair)) return lotSize * 100 * pipSize;
  return lotSize * 100000 * pipSize;
}

function recommendedLotSize(accountSize: number, riskPercent: number, pair: string, entryPrice: number, stopLoss: number): number {
  const riskDollars = accountSize * riskPercent / 100;
  const pipSize = getPipSize(pair);
  const stopPips = Math.abs(entryPrice - stopLoss) / pipSize;
  const pipValuePerLot = calculatePipValue(pair, 1);
  if (stopPips === 0 || pipValuePerLot === 0) return 0.01;
  const lot = riskDollars / (stopPips * pipValuePerLot);
  return Math.max(0.01, Math.round(lot * 100) / 100);
}

router.post("/risk/calculate", async (req, res): Promise<void> => {
  const { accountSize, riskPercent, pair, entryPrice, stopLoss, takeProfit, leverage } = req.body as {
    accountSize: number;
    riskPercent: number;
    pair: string;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    leverage?: number | null;
  };

  if (!accountSize || !riskPercent || !pair || !entryPrice || !stopLoss || !takeProfit) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const pipSize = getPipSize(pair);
  const stopPips = Math.abs(entryPrice - stopLoss) / pipSize;
  const takeProfitPips = Math.abs(takeProfit - entryPrice) / pipSize;
  const rrRatio = takeProfitPips / stopPips;
  const riskDollars = accountSize * riskPercent / 100;
  const rewardDollars = riskDollars * rrRatio;

  const lotSize = recommendedLotSize(accountSize, riskPercent, pair, entryPrice, stopLoss);
  const pipValue = calculatePipValue(pair, lotSize);

  const marginRequired = leverage
    ? Math.round((lotSize * 100000 * entryPrice / leverage) * 100) / 100
    : null;

  const breakEvenPips = Math.round(stopPips * 0.1);

  const maxLossScenarios = [
    { label: "1 loss", trades: 1, remainingBalance: accountSize - riskDollars, percent: -riskPercent },
    { label: "3 losses", trades: 3, remainingBalance: accountSize - riskDollars * 3, percent: -riskPercent * 3 },
    { label: "5 losses", trades: 5, remainingBalance: accountSize - riskDollars * 5, percent: -riskPercent * 5 },
    { label: "10 losses", trades: 10, remainingBalance: accountSize - riskDollars * 10, percent: -riskPercent * 10 },
  ];

  res.json({
    riskDollars: Math.round(riskDollars * 100) / 100,
    rewardDollars: Math.round(rewardDollars * 100) / 100,
    rrRatio: Math.round(rrRatio * 100) / 100,
    lotSize,
    stopPips: Math.round(stopPips),
    takeProfitPips: Math.round(takeProfitPips),
    pipValue: Math.round(pipValue * 100) / 100,
    marginRequired,
    breakEvenPips,
    maxLossScenarios,
  });
});

router.get("/risk/scenarios/:userId", async (req, res): Promise<void> => {
  const { userId } = req.params as { userId: string };
  const scenarios = await db.select().from(riskScenariosTable)
    .where(eq(riskScenariosTable.userId, userId))
    .orderBy(desc(riskScenariosTable.createdAt))
    .limit(20);
  res.json(scenarios.map(s => ({
    ...s,
    id: String(s.id),
    createdAt: s.createdAt.toISOString(),
  })));
});

router.post("/risk/scenarios/:userId", async (req, res): Promise<void> => {
  const { userId } = req.params as { userId: string };
  const body = req.body as {
    name: string;
    accountSize: number;
    riskPercent: number;
    pair: string;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    lotSize?: number | null;
    pipValue?: number | null;
    riskDollars?: number | null;
    rewardDollars?: number | null;
    rrRatio?: number | null;
  };

  const [scenario] = await db.insert(riskScenariosTable).values({
    userId,
    name: body.name,
    accountSize: body.accountSize,
    riskPercent: body.riskPercent,
    pair: body.pair,
    entryPrice: body.entryPrice,
    stopLoss: body.stopLoss,
    takeProfit: body.takeProfit,
    lotSize: body.lotSize ?? null,
    pipValue: body.pipValue ?? null,
    riskDollars: body.riskDollars ?? null,
    rewardDollars: body.rewardDollars ?? null,
    rrRatio: body.rrRatio ?? null,
  }).returning();

  res.status(201).json({ ...scenario, id: String(scenario.id), createdAt: scenario.createdAt.toISOString() });
});

export default router;
