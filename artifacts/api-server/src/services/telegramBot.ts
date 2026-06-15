import { logger } from "../lib/logger";
import { getForexNews } from "./newsService";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";

const BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"];
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
const VERCEL_PROD_URL = process.env["VERCEL_PROJECT_PRODUCTION_URL"] ? `https://${process.env["VERCEL_PROJECT_PRODUCTION_URL"]}` : null;
const MINIAPP_URL = process.env["MINIAPP_URL"] ?? VERCEL_PROD_URL ?? "https://tradescope-henna.vercel.app";
const CHANNEL_URL = "https://t.me/Trade_Scope_Channel";

const TIPS = [
  "The best trade is often no trade. Patience is a position.",
  "Risk management is not optional — it's the only edge that guarantees your survival.",
  "One bad trade doesn't define you. Sticking to your rules does.",
  "A setup without confluence is just gambling. Wait for high-probability.",
  "Your journal is your greatest teacher. Review every trade, win or lose.",
  "Emotions are data, not commands. Feel them, then trade the plan.",
  "The market will always be there tomorrow. Your capital might not be if you overtrade.",
  "Size down when in doubt. You can always add to a winner.",
  "News events are land mines. Know your calendar before you trade.",
  "Discipline compounded over time beats talent every time.",
  "Stop-loss placement should be logical, not emotional. Respect the structure.",
  "The best traders lose gracefully. It's about process, not outcome.",
  "Trade what you see, not what you think. Price is always right.",
  "A great week of trading starts with a great Monday plan. Review your bias.",
  "Never move your stop loss wider once in a trade. That is how accounts die.",
];

// Track users waiting to submit a support message (resets on redeploy)
const awaitingSupport = new Set<string>();

function getDailyTip(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return TIPS[dayOfYear % TIPS.length];
}

function getImpactEmoji(impact: string): string {
  return impact === "high" ? "🔴" : "🟡";
}

function formatMinutesAway(minutes: number): string {
  if (minutes < 0) return "just passed";
  if (minutes < 60) return `in ${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `in ${h}h ${m}m` : `in ${h}h`;
}

function getCurrencyFlag(currency: string): string {
  const flags: Record<string, string> = {
    USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", JPY: "🇯🇵",
    CHF: "🇨🇭", AUD: "🇦🇺", NZD: "🇳🇿", CAD: "🇨🇦",
    CNY: "🇨🇳", SEK: "🇸🇪", NOK: "🇳🇴",
  };
  return flags[currency] ?? "🌐";
}

const mainKeyboard = {
  inline_keyboard: [
    [{ text: "🚀 Open TradeScope", web_app: { url: MINIAPP_URL } }],
    [{ text: "📢 Join TradeScope Channel", url: CHANNEL_URL }],
    [{ text: "💬 Contact Support", callback_data: "support" }],
  ],
};

function buildWelcomeText(firstName?: string): string {
  const personalGreeting = firstName
    ? `👋 Welcome to TradeScope Bot, ${firstName}!`
    : `👋 Welcome to TradeScope Bot!`;

  return [
    `🔭 <b>Welcome to TradeScope Advanced</b> 👋`,
    ``,
    `Your AI-powered forex trading companion is ready.`,
    ``,
    `⚡ <b>What's inside:</b>`,
    `🤖 AI Coach — chart analysis &amp; strategy help`,
    `🧠 AI Trade Analysis — real-time market insights`,
    `🏆 Prop Firm Tracker — FTMO challenge manager`,
    `💼 FTMO Live Accounts — manage funded accounts`,
    `📐 Risk Calculator — precision position sizing`,
    ``,
    `<i>The market rewards the prepared. Let's get to work.</i>`,
    ``,
    personalGreeting,
  ].join("\n");
}

export async function sendMessage(chatId: string, text: string): Promise<boolean> {
  if (!BOT_TOKEN) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — skipping sendMessage");
    return false;
  }
  try {
    const res = await fetch(`${API_BASE}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const err = await res.text();
      logger.warn({ chatId, err }, "Telegram sendMessage failed");
      return false;
    }
    return true;
  } catch (err) {
    logger.warn({ err, chatId }, "Telegram sendMessage threw");
    return false;
  }
}

async function sendMessageWithKeyboard(
  chatId: string,
  text: string,
  replyMarkup: object,
): Promise<boolean> {
  if (!BOT_TOKEN) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — skipping sendMessageWithKeyboard");
    return false;
  }
  try {
    const res = await fetch(`${API_BASE}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        reply_markup: replyMarkup,
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const err = await res.text();
      logger.warn({ chatId, err }, "Telegram sendMessageWithKeyboard failed");
      return false;
    }
    return true;
  } catch (err) {
    logger.warn({ err, chatId }, "Telegram sendMessageWithKeyboard threw");
    return false;
  }
}

async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  if (!BOT_TOKEN) return;
  try {
    await fetch(`${API_BASE}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // best-effort
  }
}

export async function buildBriefingMessage(firstName?: string | null): Promise<string> {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", timeZone: "UTC",
  });
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false,
  });

  const greeting = firstName ? `Good morning, <b>${firstName}</b>! 👋` : `Good morning! 👋`;

  let newsSection = "";
  try {
    const events = await getForexNews();
    const todayEvents = events
      .filter((e) => e.minutesAway >= -60 && e.minutesAway <= 24 * 60)
      .slice(0, 8);

    if (todayEvents.length > 0) {
      const lines = todayEvents.map((e) => {
        const flag = getCurrencyFlag(e.currency);
        const impact = getImpactEmoji(e.impact);
        const timing = formatMinutesAway(e.minutesAway ?? 0);
        const forecast = e.forecast ? ` · Forecast: <b>${e.forecast}</b>` : "";
        return `${impact} ${flag} <b>${e.currency}</b> — ${e.title} <i>(${timing}${forecast})</i>`;
      });
      newsSection = `\n\n📅 <b>Today's High-Impact Events</b>\n${lines.join("\n")}`;
    } else {
      newsSection = "\n\n✅ <b>No high-impact news today</b> — clean trading conditions!";
    }
  } catch {
    newsSection = "\n\n⚠️ Calendar unavailable — check manually before trading.";
  }

  const tip = getDailyTip();

  return [
    `${greeting}`,
    `🌅 <b>Daily Trading Briefing</b> — ${dateStr} · ${timeStr} UTC`,
    newsSection,
    `\n💡 <b>Tip of the Day</b>\n<i>"${tip}"</i>`,
    `\n⚡ <a href="https://t.me/tradescopebot/app">Open TradeScope</a> to analyze your setups`,
  ].join("\n");
}

export async function sendDailyBriefings(): Promise<{ sent: number; failed: number }> {
  if (!BOT_TOKEN) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — skipping daily briefings");
    return { sent: 0, failed: 0 };
  }

  logger.info("Starting daily briefing batch");
  const users = await db.select({
    telegramId: usersTable.telegramId,
    firstName: usersTable.firstName,
  }).from(usersTable);

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    const msg = await buildBriefingMessage(user.firstName);
    const ok = await sendMessage(user.telegramId, msg);
    if (ok) sent++;
    else failed++;
    await new Promise((r) => setTimeout(r, 50));
  }

  logger.info({ sent, failed, total: users.length }, "Daily briefing batch complete");
  return { sent, failed };
}

export async function handleWebhook(body: any): Promise<void> {
  // ── Callback query (inline button taps) ──────────────────
  if (body?.callback_query) {
    const query = body.callback_query;
    const chatId = String(query.message?.chat?.id ?? "");
    if (!chatId) return;

    if (query.data === "support") {
      awaitingSupport.add(chatId);
      await answerCallbackQuery(query.id);
      await sendMessageWithKeyboard(
        chatId,
        `💬 <b>Contact Support</b>\n\nPlease type your message below and our team will get back to you as soon as possible.`,
        { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "cancel_support" }]] },
      );
    }

    if (query.data === "cancel_support") {
      awaitingSupport.delete(chatId);
      await answerCallbackQuery(query.id, "Cancelled.");
      await sendMessageWithKeyboard(chatId, "Support request cancelled.", mainKeyboard);
    }

    return;
  }

  // ── Regular messages ──────────────────────────────────────
  const message = body?.message;
  if (!message) return;

  const chatId = String(message.chat?.id);
  const text: string = message.text ?? "";
  const firstName: string | undefined = message.from?.first_name;
  const user = message.from;

  // ── Support message flow ──────────────────────────────────
  if (!text.startsWith("/") && awaitingSupport.has(chatId) && text) {
    awaitingSupport.delete(chatId);

    const ADMIN_CHANNEL_ID = -1003583233840;
    const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "Unknown";
    const userId = user?.id ?? chatId;
    const userLink = user?.username
      ? `<a href="https://t.me/${user.username}">@${user.username}</a>`
      : `<a href="tg://user?id=${userId}">${name}</a>`;

    const adminMsg =
      `📩 <b>New Support Message</b>\n\n` +
      `👤 <b>From:</b> ${userLink}\n` +
      `🆔 <b>User ID:</b> <code>${userId}</code>\n` +
      `💬 <b>Message:</b>\n${text}\n\n` +
      `━━━━━━━━━━━━━━\n` +
      `📤 <b>To reply:</b>\n<code>/reply ${userId} your message here</code>`;

    try {
      await sendMessage(String(ADMIN_CHANNEL_ID), adminMsg);
      await sendMessageWithKeyboard(
        chatId,
        `✅ <b>Message sent!</b>\n\nOur support team has received your message and will get back to you soon.`,
        mainKeyboard,
      );
    } catch {
      await sendMessageWithKeyboard(
        chatId,
        `✅ <b>Message received!</b>\n\nThank you for reaching out. Our support team will contact you directly via Telegram as soon as possible.`,
        mainKeyboard,
      );
    }
    return;
  }

  // ── Commands ──────────────────────────────────────────────
  if (text.startsWith("/start")) {
    await sendMessageWithKeyboard(chatId, buildWelcomeText(firstName), mainKeyboard);

  } else if (text.startsWith("/briefing") || text.startsWith("/morning")) {
    const msg = await buildBriefingMessage(firstName);
    await sendMessageWithKeyboard(chatId, msg, mainKeyboard);

  } else if (text.startsWith("/news")) {
    try {
      const events = await getForexNews();
      const upcoming = events.filter((e) => (e.minutesAway ?? 0) >= -30).slice(0, 10);
      if (upcoming.length === 0) {
        await sendMessageWithKeyboard(chatId, "✅ No upcoming high-impact events in the next 24h. Clean conditions!", mainKeyboard);
      } else {
        const lines = upcoming.map((e) => {
          const flag = getCurrencyFlag(e.currency);
          const impact = getImpactEmoji(e.impact);
          const timing = formatMinutesAway(e.minutesAway ?? 0);
          const forecast = e.forecast ? ` · Fcst: ${e.forecast}` : "";
          return `${impact} ${flag} ${e.title} — ${timing}${forecast}`;
        });
        await sendMessageWithKeyboard(chatId, `📅 <b>Upcoming High-Impact Events</b>\n\n${lines.join("\n")}`, mainKeyboard);
      }
    } catch {
      await sendMessage(chatId, "⚠️ Couldn't fetch calendar right now. Try again shortly.");
    }

  } else if (text.startsWith("/tip")) {
    const tip = getDailyTip();
    await sendMessageWithKeyboard(chatId, `💡 <b>Today's Trading Tip</b>\n\n<i>"${tip}"</i>`, mainKeyboard);

  } else if (text.startsWith("/support")) {
    awaitingSupport.add(chatId);
    await sendMessageWithKeyboard(
      chatId,
      `💬 <b>Contact Support</b>\n\nPlease type your message below and our team will get back to you as soon as possible.`,
      { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "cancel_support" }]] },
    );

  } else if (text.startsWith("/help")) {
    await sendMessageWithKeyboard(chatId, [
      "📖 <b>TradeScope Bot Commands</b>",
      "",
      "📅 /briefing — Full morning briefing",
      "📰 /news — Upcoming forex events",
      "💡 /tip — Daily trading tip",
      "💬 /support — Contact support",
      "ℹ️ /help — This menu",
    ].join("\n"), mainKeyboard);
  }
}

export async function setBotWebhook(webhookUrl: string): Promise<boolean> {
  if (!BOT_TOKEN) return false;
  try {
    const res = await fetch(`${API_BASE}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message", "callback_query"],
      }),
    });
    const data = await res.json() as any;
    logger.info({ result: data }, "Telegram webhook set");
    return data.ok === true;
  } catch (err) {
    logger.error({ err }, "Failed to set Telegram webhook");
    return false;
  }
}

export async function getBotInfo(): Promise<any> {
  if (!BOT_TOKEN) return null;
  try {
    const res = await fetch(`${API_BASE}/getMe`);
    return await res.json();
  } catch {
    return null;
  }
}
