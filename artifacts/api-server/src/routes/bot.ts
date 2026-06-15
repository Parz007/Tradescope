import { Router } from "express";
import {
  handleWebhook,
  sendDailyBriefings,
  setBotWebhook,
  getBotInfo,
  buildBriefingMessage,
  sendMessage,
} from "../services/telegramBot";

const router = Router();

const ADMIN_PASSWORD = process.env["ADMIN_PASSWORD"] ?? "admin123";

function checkAdmin(req: any, res: any): boolean {
  const auth = req.headers["authorization"] ?? "";
  const token = auth.replace("Bearer ", "").trim();
  if (token !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

// Telegram webhook — receives updates from Telegram
router.post("/bot/webhook", async (req, res) => {
  try {
    await handleWebhook(req.body);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Webhook handler error");
    res.json({ ok: true }); // Always return 200 to Telegram
  }
});

// Register webhook URL with Telegram (call once after deploy)
router.post("/bot/webhook/set", async (req, res) => {
  if (!checkAdmin(req, res)) return;
  const { url } = req.body as { url?: string };
  if (!url) {
    res.status(400).json({ error: "url required" });
    return;
  }
  const ok = await setBotWebhook(url);
  res.json({ ok });
});

// Get bot info
router.get("/bot/status", async (req, res) => {
  const info = await getBotInfo();
  res.json({
    configured: !!process.env["TELEGRAM_BOT_TOKEN"],
    bot: info,
  });
});

// Manually trigger daily briefing to all users (admin only)
router.post("/bot/briefing/trigger", async (req, res) => {
  if (!checkAdmin(req, res)) return;
  const result = await sendDailyBriefings();
  res.json({ ok: true, ...result });
});

// Preview briefing message (admin only)
router.get("/bot/briefing/preview", async (req, res) => {
  if (!checkAdmin(req, res)) return;
  const msg = await buildBriefingMessage("Alex");
  res.json({ message: msg });
});

// Send a test message to a specific chat (admin only)
router.post("/bot/send", async (req, res) => {
  if (!checkAdmin(req, res)) return;
  const { chatId, text } = req.body as { chatId?: string; text?: string };
  if (!chatId || !text) {
    res.status(400).json({ error: "chatId and text required" });
    return;
  }
  const ok = await sendMessage(chatId, text);
  res.json({ ok });
});

export default router;
