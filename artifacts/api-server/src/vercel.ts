import { setBotWebhook } from "./services/telegramBot";
export { default } from "./app";

const VERCEL_PRODUCTION_URL = "https://tradescope-henna.vercel.app";

if (process.env["TELEGRAM_BOT_TOKEN"]) {
  const webhookUrl = `${VERCEL_PRODUCTION_URL}/api/bot/webhook`;
  setBotWebhook(webhookUrl).catch(() => {});
}
