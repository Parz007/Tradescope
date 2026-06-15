import { Router, type IRouter } from "express";
import { eq, desc, count, gte } from "drizzle-orm";
import { db, usersTable, analysesTable, ftmoListingsTable, ftmoOrdersTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function adminAuth(req: any, res: any, next: any): void {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  const expected = process.env.ADMIN_PASSWORD ?? "admin123";
  if (token !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

router.post("/admin/login", async (req, res): Promise<void> => {
  const { password } = req.body as { password: string };
  const expected = process.env.ADMIN_PASSWORD ?? "admin123";

  if (password !== expected) {
    req.log.warn("Failed admin login attempt");
    res.status(401).json({ error: "Invalid password" });
    return;
  }

  res.json({ token: expected });
});

router.get("/admin/stats", adminAuth, async (_req, res): Promise<void> => {
  const totalUsers = await db.select({ cnt: count() }).from(usersTable);
  const totalAnalyses = await db.select({ cnt: count() }).from(analysesTable);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const analysesToday = await db.select({ cnt: count() }).from(analysesTable).where(gte(analysesTable.createdAt, today));

  const freeUsers = await db.select({ cnt: count() }).from(usersTable).where(eq(usersTable.subscriptionTier, "free"));
  const proUsers = await db.select({ cnt: count() }).from(usersTable).where(eq(usersTable.subscriptionTier, "pro"));
  const eliteUsers = await db.select({ cnt: count() }).from(usersTable).where(eq(usersTable.subscriptionTier, "elite"));

  res.json({
    totalUsers: totalUsers[0]?.cnt ?? 0,
    analysesToday: analysesToday[0]?.cnt ?? 0,
    totalAnalyses: totalAnalyses[0]?.cnt ?? 0,
    freeUsers: freeUsers[0]?.cnt ?? 0,
    proUsers: proUsers[0]?.cnt ?? 0,
    eliteUsers: eliteUsers[0]?.cnt ?? 0,
  });
});

router.get("/admin/users", adminAuth, async (req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));

  const enriched = await Promise.all(
    users.map(async (u) => {
      const [result] = await db.select({ cnt: count() }).from(analysesTable).where(eq(analysesTable.userId, u.id));
      return {
        id: u.id,
        telegramId: u.telegramId,
        username: u.username,
        firstName: u.firstName,
        subscriptionTier: u.subscriptionTier,
        totalAnalyses: result?.cnt ?? 0,
        createdAt: u.createdAt.toISOString(),
      };
    })
  );

  res.json(enriched);
});

router.put("/admin/user/:userId/tier", adminAuth, async (req, res): Promise<void> => {
  const { userId } = req.params as { userId: string };
  const { tier } = req.body as { tier: string };

  if (!["free", "pro", "elite"].includes(tier)) {
    res.status(400).json({ error: "Invalid tier" });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set({ subscriptionTier: tier })
    .where(eq(usersTable.id, userId))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [result] = await db.select({ cnt: count() }).from(analysesTable).where(eq(analysesTable.userId, user.id));

  res.json({
    id: user.id,
    telegramId: user.telegramId,
    username: user.username,
    firstName: user.firstName,
    subscriptionTier: user.subscriptionTier,
    totalAnalyses: result?.cnt ?? 0,
    createdAt: user.createdAt.toISOString(),
  });
});

router.get("/admin/analyses/today", adminAuth, async (_req, res): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const analyses = await db
    .select()
    .from(analysesTable)
    .where(gte(analysesTable.createdAt, today))
    .orderBy(desc(analysesTable.createdAt));

  res.json(analyses.map((a) => ({ ...a, revengeTradeWarning: a.revengeTradeWarning === 1 })));
});

router.get("/admin/marketplace/orders", adminAuth, async (_req, res): Promise<void> => {
  try {
    const orders = await db.select().from(ftmoOrdersTable).orderBy(desc(ftmoOrdersTable.createdAt));
    res.json(orders);
  } catch (err) {
    logger.error({ err }, "Failed to fetch marketplace orders");
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

router.patch("/admin/marketplace/order/:id", adminAuth, async (req, res): Promise<void> => {
  const { id } = req.params as { id: string };
  const { status, adminNotes } = req.body as { status: string; adminNotes?: string };

  const allowed = ["pending", "payment_received", "completed", "cancelled"];
  if (!allowed.includes(status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }

  const [order] = await db
    .update(ftmoOrdersTable)
    .set({
      status,
      adminNotes: adminNotes ?? null,
      completedAt: status === "completed" ? new Date() : undefined,
    })
    .where(eq(ftmoOrdersTable.id, id))
    .returning();

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  if (status === "completed" || status === "cancelled") {
    const newListingStatus = status === "completed" ? "sold" : "available";
    await db
      .update(ftmoListingsTable)
      .set({ status: newListingStatus })
      .where(eq(ftmoListingsTable.id, order.listingId));
  }

  res.json(order);
});

router.get("/admin/marketplace/listings", adminAuth, async (_req, res): Promise<void> => {
  try {
    const listings = await db.select().from(ftmoListingsTable).orderBy(ftmoListingsTable.accountSize);
    res.json(listings);
  } catch (err) {
    logger.error({ err }, "Failed to fetch marketplace listings");
    res.status(500).json({ error: "Failed to fetch listings" });
  }
});

router.patch("/admin/marketplace/listing/:id", adminAuth, async (req, res): Promise<void> => {
  const { id } = req.params as { id: string };
  const { status, priceUsd, featured } = req.body as { status?: string; priceUsd?: number; featured?: number };

  const update: Partial<{ status: string; priceUsd: number; featured: number }> = {};
  if (status) update.status = status;
  if (priceUsd !== undefined) update.priceUsd = priceUsd;
  if (featured !== undefined) update.featured = featured;

  const [listing] = await db
    .update(ftmoListingsTable)
    .set(update)
    .where(eq(ftmoListingsTable.id, id))
    .returning();

  if (!listing) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }

  res.json(listing);
});

router.post("/admin/marketplace/listing", adminAuth, async (req, res): Promise<void> => {
  const body = req.body as {
    accountSize: number;
    accountType: string;
    priceUsd: number;
    title: string;
    description?: string;
    leverage?: string;
    maxDailyLoss?: string;
    maxLoss?: string;
    profitSplit?: string;
    platform?: string;
  };

  if (!body.accountSize || !body.priceUsd || !body.title) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const [listing] = await db.insert(ftmoListingsTable).values(body).returning();
  res.json(listing);
});

export default router;
