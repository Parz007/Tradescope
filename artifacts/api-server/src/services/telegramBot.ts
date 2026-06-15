import { logger } from "../lib/logger";
import { getForexNews } from "./newsService";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";

const BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"];
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

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
    // Small delay to avoid Telegram rate limits (30 msgs/sec limit)
    await new Promise((r) => setTimeout(r, 50));
  }

  logger.info({ sent, failed, total: users.length }, "Daily briefing batch complete");
  return { sent, failed };
}

export async function handleWebhook(body: any): Promise<void> {
  const message = body?.message;
  if (!message) return;

  const chatId = String(message.chat?.id);
  const text: string = message.text ?? "";
  const firstName = message.from?.first_name;

  if (text.startsWith("/start")) {
    const welcome = [
      `👋 <b>Welcome to TradeScope Bot${firstName ? `, ${firstName}` : ""}!</b>`,
      "",
      "I'm your daily AI trading briefing assistant. Here's what I can do:",
      "",
      "📅 <b>/briefing</b> — Get today's high-impact news + trading tip",
      "📰 <b>/news</b> — See upcoming forex events right now",
      "💡 <b>/tip</b> — Get today's trading wisdom",
      "ℹ️ <b>/help</b> — Show this menu",
      "",
      "⚡ I'll also send you an automatic briefing every morning at 7:00 AM UTC.",
      "",
      `🚀 <a href="https://t.me/tradescopebot/app">Open TradeScope App →</a>`,
    ].join("\n");
    await sendMessage(chatId, welcome);
  } else if (text.startsWith("/briefing") || text.startsWith("/morning")) {
    const msg = await buildBriefingMessage(firstName);
    await sendMessage(chatId, msg);
  } else if (text.startsWith("/news")) {
    try {
      const events = await getForexNews();
      const upcoming = events.filter((e) => (e.minutesAway ?? 0) >= -30).slice(0, 10);
      if (upcoming.length === 0) {
        await sendMessage(chatId, "✅ No upcoming high-impact events in the next 24h. Clean conditions!");
      } else {
        const lines = upcoming.map((e) => {
          const flag = getCurrencyFlag(e.currency);
          const impact = getImpactEmoji(e.impact);
          const timing = formatMinutesAway(e.minutesAway ?? 0);
          const forecast = e.forecast ? ` · Fcst: ${e.forecast}` : "";
          return `${impact} ${flag} ${e.title} — ${timing}${forecast}`;
        });
        await sendMessage(chatId, `📅 <b>Upcoming High-Impact Events</b>\n\n${lines.join("\n")}`);
      }
    } catch {
      await sendMessage(chatId, "⚠️ Couldn't fetch calendar right now. Try again shortly.");
    }
  } else if (text.startsWith("/tip")) {
    const tip = getDailyTip();
    await sendMessage(chatId, `💡 <b>Today's Trading Tip</b>\n\n<i>"${tip}"</i>`);
  } else if (text.startsWith("/help")) {
    await sendMessage(chatId, [
      "📖 <b>TradeScope Bot Commands</b>",
      "",
      "📅 /briefing — Full morning briefing",
      "📰 /news — Upcoming forex events",
      "💡 /tip — Daily trading tip",
      "ℹ️ /help — This menu",
    ].join("\n"));
  }
}

export async function setBotWebhook(webhookUrl: string): Promise<boolean> {
  if (!BOT_TOKEN) return false;
  try {
    const res = await fetch(`${API_BASE}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl }),
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
