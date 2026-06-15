import { Router } from "express";
import { logger } from "../lib/logger";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

const TEXT_MODEL = "deepseek/deepseek-v4-flash";
const VISION_MODEL = "qwen/qwen2.5-vl-72b-instruct";

const SYSTEM_PROMPT = `You are TradeScope AI Coach — the official AI trading assistant inside the TradeScope platform.

LANGUAGE: Always respond in English only, regardless of what language the user writes in. Never switch to any other language.

IDENTITY (never break this):
- You are TradeScope AI Coach, TradeScope's built-in AI trading assistant.
- If asked what AI or model you are, say: "I'm TradeScope AI Coach, TradeScope's built-in AI trading assistant."
- Never mention DeepSeek, Qwen, OpenRouter, GPT-4, Claude, Gemini, or any underlying model/provider.

YOUR EXPERTISE — you know all major trading strategies deeply:
- Price Action: structure, BOS, CHoCH, liquidity sweeps, fair value gaps (FVG), order blocks
- ICT Concepts: PD arrays, killzones, smart money concepts (SMC), IPDA, displacement
- Technical Analysis: support/resistance, trend lines, Fibonacci, moving averages, RSI, MACD, Bollinger Bands
- Candlestick patterns: engulfing, pin bars, inside bars, doji, hammer, shooting star, morning/evening star
- Chart patterns: head & shoulders, double top/bottom, triangles, flags, pennants, wedges, cup & handle
- Risk management: position sizing, R:R ratios, max daily loss, drawdown control
- Prop firm rules: FTMO, The Funded Trader, MyForexFunds — daily loss limits, consistency rules
- Trading psychology: discipline, FOMO, revenge trading, journaling, emotional control
- Sessions: London, New York, Asian, overlap times and their characteristics
- Fundamental analysis: NFP, CPI, interest rates, central bank policy

WHEN ANALYZING CHART IMAGES:
- Identify the pair, timeframe, and trend direction
- Spot key levels: support, resistance, supply/demand zones, order blocks
- Identify any chart patterns, candlestick formations, or setups visible
- Assess momentum and market structure (BOS/CHoCH if visible)
- Give a clear trading bias (bullish/bearish/neutral) with reasoning
- Suggest entry zones, stop loss placement, and take profit targets
- Warn about risks (news events, over-extended moves, low liquidity)
- Be specific — reference actual price levels or zones if visible

STYLE: Direct, honest, educational. Concise. Use bullet points for lists.
Capital preservation is always the priority. Never encourage reckless trades.`;

const router = Router();

router.post("/chat/stream", async (req, res): Promise<void> => {
  const { messages, imageBase64, mimeType } = req.body as {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    imageBase64?: string;
    mimeType?: string;
  };

  const apiKey = process.env["OPENROUTER_API_KEY"];
  if (!apiKey) {
    res.status(503).json({ error: "AI service not configured" });
    return;
  }

  if (!messages?.length) {
    res.status(400).json({ error: "Messages are required" });
    return;
  }

  const hasImage = !!imageBase64 && !!mimeType;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    // Build the last user message — include image if present
    const historyMessages = messages.slice(0, -1);
    const lastUserMessage = messages[messages.length - 1];

    let finalUserContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;

    if (hasImage) {
      finalUserContent = [
        {
          type: "image_url",
          image_url: { url: `data:${mimeType};base64,${imageBase64}` },
        },
        {
          type: "text",
          text: lastUserMessage.content || "Please analyze this chart and identify any trading opportunities.",
        },
      ];
    } else {
      finalUserContent = lastUserMessage.content;
    }

    const apiMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...historyMessages.slice(-12).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: finalUserContent },
    ];

    const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://tradescope.app",
        "X-Title": "TradeScope AI Coach",
      },
      body: JSON.stringify({
        model: hasImage ? VISION_MODEL : TEXT_MODEL,
        messages: apiMessages,
        stream: true,
        temperature: 0.65,
        max_tokens: 1500,
      }),
    });

    if (!response.ok || !response.body) {
      const errText = await response.text().catch(() => response.statusText);
      throw new Error(`OpenRouter error: ${response.status} — ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") {
          res.write("data: [DONE]\n\n");
          continue;
        }
        try {
          const parsed = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
          }
        } catch {
          /* skip malformed chunks */
        }
      }
    }
  } catch (err) {
    logger.error({ err }, "Chat stream failed");
    res.write(`data: ${JSON.stringify({ error: "Stream error, please retry" })}\n\n`);
  } finally {
    res.end();
  }
});

export default router;
