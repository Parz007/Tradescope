import TelegramBot from "node-telegram-bot-api";
import { logger } from "./lib/logger";

const MINIAPP_URL = `https://${process.env["REPLIT_DOMAINS"]?.split(",")[0] ?? ""}`;
const ADMIN_CHANNEL_ID = -1003583233840;

export function startBot(): void {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — Telegram bot disabled");
    return;
  }

  const bot = new TelegramBot(token, { polling: true });
  logger.info("Telegram bot started (polling)");

  // Track users currently waiting to submit a support message
  const awaitingSupport = new Set<number>();

  const keyboard = {
    inline_keyboard: [
      [{ text: "🚀 Open TradeScope", web_app: { url: MINIAPP_URL } }],
      [{ text: "📢 Join TradeScope Channel", url: "https://t.me/Trade_Scope_Channel" }],
      [{ text: "💬 Contact Support", callback_data: "support" }],
    ],
  };

  function buildWelcomeText(firstName?: string): string {
    const personalGreeting = firstName
      ? `👋 Welcome to TradeScope Bot, ${firstName}!`
      : `👋 Welcome to TradeScope Bot!`;

    return `
🔭 *Welcome to TradeScope Advanced* 👋

Your AI-powered forex trading companion is ready.

⚡ *What's inside:*
🤖 AI Coach — chart analysis & strategy help
🧠 AI Trade Analysis — real-time market insights
🏆 Prop Firm Tracker — FTMO challenge manager
💼 FTMO Live Accounts — manage funded accounts
📐 Risk Calculator — precision position sizing

_The market rewards the prepared. Let's get to work._

${personalGreeting}`.trim();
  }

  // ── /start ──────────────────────────────────────────────
  bot.onText(/\/start/, (msg) => {
    const firstName = msg.from?.first_name;
    bot
      .sendMessage(msg.chat.id, buildWelcomeText(firstName), {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      })
      .catch((err: unknown) => logger.error({ err }, "Failed to send /start"));
  });

  // ── /menu ───────────────────────────────────────────────
  bot.onText(/\/menu/, (msg) => {
    bot
      .sendMessage(msg.chat.id, "Tap below to open TradeScope:", {
        reply_markup: keyboard,
      })
      .catch((err: unknown) => logger.error({ err }, "Failed to send /menu"));
  });

  // ── /help ───────────────────────────────────────────────
  bot.onText(/\/help/, (msg) => {
    bot
      .sendMessage(
        msg.chat.id,
        `*Commands:*\n/start — Launch TradeScope\n/menu — Open app button\n/support — Contact support\n/help — This message`,
        { parse_mode: "Markdown", reply_markup: keyboard },
      )
      .catch((err: unknown) => logger.error({ err }, "Failed to send /help"));
  });

  // ── /reply USER_ID message (admin use only) ──────────────
  bot.onText(/\/reply (.+)/, (msg, match) => {
    const args = match?.[1]?.trim() ?? "";
    const spaceIdx = args.indexOf(" ");
    if (spaceIdx === -1) {
      bot.sendMessage(msg.chat.id, "Usage: /reply USER\\_ID your message here", { parse_mode: "Markdown" }).catch(() => {});
      return;
    }
    const targetId = parseInt(args.slice(0, spaceIdx).trim(), 10);
    const replyText = args.slice(spaceIdx + 1).trim();
    if (!targetId || !replyText) {
      bot.sendMessage(msg.chat.id, "Usage: /reply USER\\_ID your message here", { parse_mode: "Markdown" }).catch(() => {});
      return;
    }
    bot
      .sendMessage(
        targetId,
        `💬 *Reply from TradeScope Support:*\n\n${replyText}`,
        { parse_mode: "Markdown", reply_markup: keyboard },
      )
      .then(() => {
        bot.sendMessage(msg.chat.id, `✅ Reply sent to user \`${targetId}\`.`, { parse_mode: "Markdown" }).catch(() => {});
      })
      .catch((err: unknown) => {
        logger.error({ err }, "Failed to send reply to user");
        bot.sendMessage(msg.chat.id, `❌ Could not deliver reply to user \`${targetId}\`. They may not have started the bot.`, { parse_mode: "Markdown" }).catch(() => {});
      });
  });

  // ── /support ─────────────────────────────────────────────
  bot.onText(/\/support/, (msg) => {
    awaitingSupport.add(msg.chat.id);
    bot
      .sendMessage(
        msg.chat.id,
        `💬 *Contact Support*\n\nPlease type your message below and our team will get back to you as soon as possible.`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[{ text: "❌ Cancel", callback_data: "cancel_support" }]],
          },
        },
      )
      .catch((err: unknown) => logger.error({ err }, "Failed to send /support"));
  });

  // ── Inline button callbacks ──────────────────────────────
  bot.on("callback_query", (query) => {
    const chatId = query.message?.chat.id;
    if (!chatId) return;

    if (query.data === "support") {
      awaitingSupport.add(chatId);
      bot
        .answerCallbackQuery(query.id)
        .catch(() => {});
      bot
        .sendMessage(
          chatId,
          `💬 *Contact Support*\n\nPlease type your message below and our team will get back to you as soon as possible.`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [[{ text: "❌ Cancel", callback_data: "cancel_support" }]],
            },
          },
        )
        .catch((err: unknown) => logger.error({ err }, "Failed to send support prompt"));
    }

    if (query.data === "cancel_support") {
      awaitingSupport.delete(chatId);
      bot.answerCallbackQuery(query.id, { text: "Cancelled." }).catch(() => {});
      bot
        .sendMessage(chatId, "Support request cancelled.", { reply_markup: keyboard })
        .catch(() => {});
    }
  });

  // ── Incoming text messages ───────────────────────────────
  bot.on("message", (msg) => {
    const chatId = msg.chat.id;

    // Skip commands
    if (msg.text?.startsWith("/")) return;

    // Handle support messages
    if (awaitingSupport.has(chatId) && msg.text) {
      awaitingSupport.delete(chatId);

      const user = msg.from;
      const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "Unknown";
      const username = user?.username ? `@${user.username}` : "no username";
      const userId = user?.id ?? chatId;

      const userLink = user?.username
        ? `[@${user.username}](https://t.me/${user.username})`
        : `[${name}](tg://user?id=${userId})`;

      const adminMsg =
        `📩 *New Support Message*\n\n` +
        `👤 *From:* ${userLink}\n` +
        `🆔 *User ID:* \`${userId}\`\n` +
        `💬 *Message:*\n${msg.text}\n\n` +
        `━━━━━━━━━━━━━━\n` +
        `📤 *To reply, send this to @TradeScope\\_bot:*\n` +
        `\`/reply ${userId} your message here\``;

      // Forward to admin channel
      bot
        .sendMessage(ADMIN_CHANNEL_ID, adminMsg, { parse_mode: "Markdown" })
        .then(() => {
          // Confirm to user
          bot
            .sendMessage(
              chatId,
              `✅ *Message sent!*\n\nOur support team has received your message and will get back to you soon.`,
              { parse_mode: "Markdown", reply_markup: keyboard },
            )
            .catch(() => {});
        })
        .catch((err: unknown) => {
          logger.error({ err }, "Failed to forward support message to admin channel");
          bot
            .sendMessage(
              chatId,
              `✅ *Message received!*\n\nThank you for reaching out. Our support team will contact you directly via Telegram as soon as possible.\n\n_User ID: \`${userId}\`_`,
              { parse_mode: "Markdown", reply_markup: keyboard },
            )
            .catch(() => {});
        });
    }
  });

  bot.on("polling_error", (err) => {
    logger.error({ err }, "Telegram polling error");
  });
}
