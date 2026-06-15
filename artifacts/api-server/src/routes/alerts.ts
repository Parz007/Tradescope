import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, priceAlertsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/alerts/:userId", async (req, res): Promise<void> => {
  const { userId } = req.params as { userId: string };
  const alerts = await db.select().from(priceAlertsTable)
    .where(eq(priceAlertsTable.userId, userId))
    .orderBy(priceAlertsTable.createdAt);
  res.json(alerts.map(a => ({
    ...a,
    id: String(a.id),
    createdAt: a.createdAt.toISOString(),
    triggeredAt: a.triggeredAt ? a.triggeredAt.toISOString() : null,
  })));
});

router.post("/alerts", async (req, res): Promise<void> => {
  const { userId, pair, targetPrice, direction, condition, note } = req.body as {
    userId: string;
    pair: string;
    targetPrice: number;
    direction: string;
    condition: "above" | "below";
    note?: string | null;
  };

  if (!userId || !pair || !targetPrice || !direction || !condition) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const [alert] = await db.insert(priceAlertsTable).values({
    userId,
    pair,
    targetPrice,
    direction,
    condition,
    note: note ?? null,
    isActive: true,
  }).returning();

  res.status(201).json({
    ...alert,
    id: String(alert.id),
    createdAt: alert.createdAt.toISOString(),
    triggeredAt: null,
  });
});

router.delete("/alerts/:id", async (req, res): Promise<void> => {
  const { id } = req.params as { id: string };
  await db.delete(priceAlertsTable).where(eq(priceAlertsTable.id, id));
  res.json({ success: true });
});

export default router;
