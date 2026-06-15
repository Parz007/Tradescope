import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, ftmoListingsTable, ftmoOrdersTable, usersTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const DEFAULT_LISTINGS = [
  {
    accountSize: 10000,
    accountType: "Normal",
    priceUsd: 199,
    title: "FTMO $10,000 Live Account",
    description: "Fully funded FTMO account — no challenge required. Start trading immediately.",
    leverage: "1:100",
    maxDailyLoss: "5% ($500)",
    maxLoss: "10% ($1,000)",
    profitSplit: "80%",
    platform: "MT4 / MT5",
    featured: 0,
  },
  {
    accountSize: 25000,
    accountType: "Normal",
    priceUsd: 369,
    title: "FTMO $25,000 Live Account",
    description: "Mid-tier funded account ideal for experienced traders ready to scale.",
    leverage: "1:100",
    maxDailyLoss: "5% ($1,250)",
    maxLoss: "10% ($2,500)",
    profitSplit: "80%",
    platform: "MT4 / MT5",
    featured: 0,
  },
  {
    accountSize: 50000,
    accountType: "Normal",
    priceUsd: 599,
    title: "FTMO $50,000 Live Account",
    description: "Professional-level account. Best value for serious traders.",
    leverage: "1:100",
    maxDailyLoss: "5% ($2,500)",
    maxLoss: "10% ($5,000)",
    profitSplit: "80%",
    platform: "MT4 / MT5",
    featured: 1,
  },
  {
    accountSize: 100000,
    accountType: "Normal",
    priceUsd: 999,
    title: "FTMO $100,000 Live Account",
    description: "Elite funded account for high-performance traders.",
    leverage: "1:100",
    maxDailyLoss: "5% ($5,000)",
    maxLoss: "10% ($10,000)",
    profitSplit: "80%",
    platform: "MT4 / MT5",
    featured: 1,
  },
  {
    accountSize: 200000,
    accountType: "Normal",
    priceUsd: 1899,
    title: "FTMO $200,000 Live Account",
    description: "Maximum capital — for consistent, disciplined professionals only.",
    leverage: "1:100",
    maxDailyLoss: "5% ($10,000)",
    maxLoss: "10% ($20,000)",
    profitSplit: "80%",
    platform: "MT4 / MT5",
    featured: 0,
  },
  {
    accountSize: 50000,
    accountType: "Swing",
    priceUsd: 549,
    title: "FTMO $50,000 Swing Account",
    description: "Swing-friendly rules — hold trades over the weekend, no time limits.",
    leverage: "1:30",
    maxDailyLoss: "8% ($4,000)",
    maxLoss: "12% ($6,000)",
    profitSplit: "80%",
    platform: "MT4 / MT5",
    featured: 0,
  },
  {
    accountSize: 100000,
    accountType: "Swing",
    priceUsd: 949,
    title: "FTMO $100,000 Swing Account",
    description: "Large swing account — ideal for position traders and macro strategies.",
    leverage: "1:30",
    maxDailyLoss: "8% ($8,000)",
    maxLoss: "12% ($12,000)",
    profitSplit: "80%",
    platform: "MT4 / MT5",
    featured: 0,
  },
];

async function seedListingsIfEmpty() {
  const existing = await db.select().from(ftmoListingsTable).limit(1);
  if (existing.length === 0) {
    await db.insert(ftmoListingsTable).values(DEFAULT_LISTINGS);
    logger.info("Seeded default FTMO marketplace listings");
  }
}

seedListingsIfEmpty().catch((err) => logger.error({ err }, "Failed to seed marketplace listings"));

router.get("/marketplace/listings", async (_req, res): Promise<void> => {
  try {
    const listings = await db
      .select()
      .from(ftmoListingsTable)
      .orderBy(desc(ftmoListingsTable.featured), ftmoListingsTable.accountSize);
    res.json(listings);
  } catch (err) {
    logger.error({ err }, "Failed to fetch listings");
    res.status(500).json({ error: "Failed to fetch listings" });
  }
});

router.post("/marketplace/order", async (req, res): Promise<void> => {
  const body = req.body as {
    listingId: string;
    buyerUserId: string;
    buyerContact?: string;
    cryptoType: string;
    txHash?: string;
  };

  if (!body.listingId || !body.buyerUserId || !body.cryptoType) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const allowed = ["USDT_ERC20", "USDT_TRC20", "USDT_BEP20", "USDC_ERC20"];
  if (!allowed.includes(body.cryptoType)) {
    res.status(400).json({ error: "Invalid crypto type" });
    return;
  }

  const [listing] = await db
    .select()
    .from(ftmoListingsTable)
    .where(eq(ftmoListingsTable.id, body.listingId))
    .limit(1);

  if (!listing) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }

  if (listing.status !== "available") {
    res.status(400).json({ error: "This account is no longer available" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, body.buyerUserId))
    .limit(1);

  const [order] = await db
    .insert(ftmoOrdersTable)
    .values({
      listingId: body.listingId,
      accountSize: listing.accountSize,
      buyerUserId: body.buyerUserId,
      buyerUsername: user?.username ?? null,
      buyerContact: body.buyerContact ?? null,
      cryptoType: body.cryptoType,
      amountUsd: listing.priceUsd,
      txHash: body.txHash ?? null,
      status: "pending",
    })
    .returning();

  await db
    .update(ftmoListingsTable)
    .set({ status: "reserved" })
    .where(eq(ftmoListingsTable.id, body.listingId));

  req.log.info({ orderId: order.id, listingId: body.listingId }, "Marketplace order created");
  res.json(order);
});

router.get("/marketplace/payment-info", (_req, res): void => {
  res.json({
    USDT_ERC20: { address: "0xb1584a0e0ea8b01e57d6caa238ac76512ef87fd7", network: "Ethereum (ERC-20)", symbol: "USDT" },
    USDT_TRC20: { address: "TFRDatJUdNQLYiF7BqQKQi8YFKQ1FBuAGn", network: "TRON (TRC-20)", symbol: "USDT" },
    USDT_BEP20: { address: "0xb1584a0e0ea8b01e57d6caa238ac76512ef87fd7", network: "BNB Smart Chain (BEP-20)", symbol: "USDT" },
    USDC_ERC20: { address: "0xb1584a0e0ea8b01e57d6caa238ac76512ef87fd7", network: "Ethereum (ERC-20)", symbol: "USDC" },
  });
});

export default router;
