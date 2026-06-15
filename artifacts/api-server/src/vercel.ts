import { setBotWebhook } from "./services/telegramBot";
export { default } from "./app";

const miniappUrl = process.env["MINIAPP_URL"];
if (process.env["TELEGRAM_BOT_TOKEN"] && miniappUrl) {
  const webhookUrl = `${miniappUrl.replace(/\/$/, "")}/api/bot/webhook`;
  setBotWebhook(webhookUrl).catch(() => {});
}
