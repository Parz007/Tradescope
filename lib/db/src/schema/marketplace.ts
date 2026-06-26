import { pgTable, text, integer, timestamp, uuid } from "drizzle-orm/pg-core";

export const ftmoListingsTable = pgTable("ftmo_listings", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountSize: integer("account_size").notNull(),
  accountType: text("account_type").notNull().default("Normal"),
  priceUsd: integer("price_usd").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  leverage: text("leverage").default("1:100"),
  maxDailyLoss: text("max_daily_loss").default("5%"),
  maxLoss: text("max_loss").default("10%"),
  profitSplit: text("profit_split").default("80%"),
  platform: text("platform").default("MT4/MT5"),
  status: text("status").notNull().default("available"),
  featured: integer("featured").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ftmoOrdersTable = pgTable("ftmo_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  listingId: uuid("listing_id").notNull(),
  accountSize: integer("account_size").notNull(),
  buyerUserId: text("buyer_user_id").notNull(),
  buyerUsername: text("buyer_username"),
  buyerContact: text("buyer_contact"),
  cryptoType: text("crypto_type").notNull(),
  amountUsd: integer("amount_usd").notNull(),
  txHash: text("tx_hash"),
  status: text("status").notNull().default("pending"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const robotRentalsTable = pgTable("robot_rentals", {
  id: uuid("id").primaryKey().defaultRandom(),
  buyerUserId: text("buyer_user_id").notNull(),
  buyerUsername: text("buyer_username"),
  buyerContact: text("buyer_contact"),
  cryptoType: text("crypto_type").notNull(),
  amountUsd: integer("amount_usd").notNull().default(15),
  durationDays: integer("duration_days").notNull().default(14),
  txHash: text("tx_hash"),
  status: text("status").notNull().default("pending"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});
