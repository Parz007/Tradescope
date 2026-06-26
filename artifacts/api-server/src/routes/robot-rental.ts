import { Router, type IRouter } from "express";
import { db, robotRentalsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/robot-rental/payment-info", (_req, res): void => {
  res.json({
    USDT_ERC20: { address: "0xb1584a0e0ea8b01e57d6caa238ac76512ef87fd7", network: "Ethereum (ERC-20)", symbol: "USDT" },
    USDT_TRC20: { address: "TFRDatJUdNQLYiF7BqQKQi8YFKQ1FBuAGn", network: "TRON (TRC-20)", symbol: "USDT" },
    USDT_BEP20: { address: "0xb1584a0e0ea8b01e57d6caa238ac76512ef87fd7", network: "BNB Smart Chain (BEP-20)", symbol: "USDT" },
    USDC_ERC20: { address: "0xb1584a0e0ea8b01e57d6caa238ac76512ef87fd7", network: "Ethereum (ERC-20)", symbol: "USDC" },
  });
});

router.post("/robot-rental/order", async (req, res): Promise<void> => {
  const body = req.body as {
    buyerUserId: string;
    buyerContact?: string;
    cryptoType: string;
    txHash?: string;
  };

  if (!body.buyerUserId || !body.cryptoType) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const allowed = ["USDT_ERC20", "USDT_TRC20", "USDT_BEP20", "USDC_ERC20"];
  if (!allowed.includes(body.cryptoType)) {
    res.status(400).json({ error: "Invalid crypto type" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, body.buyerUserId))
    .limit(1);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);

  const [rental] = await db
    .insert(robotRentalsTable)
    .values({
      buyerUserId: body.buyerUserId,
      buyerUsername: user?.username ?? null,
      buyerContact: body.buyerContact ?? null,
      cryptoType: body.cryptoType,
      amountUsd: 15,
      durationDays: 14,
      txHash: body.txHash ?? null,
      status: "pending",
      expiresAt,
    })
    .returning();

  req.log.info({ rentalId: rental.id }, "Robot rental order created");
  res.json(rental);
});

export default router;
