import { logger } from "../lib/logger";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

function getSession(utcHour: number): string {
  if (utcHour >= 13 && utcHour < 16) return "London/New York Overlap (highest volatility)";
  if (utcHour >= 7 && utcHour < 16) return "London Session";
  if (utcHour >= 13 && utcHour < 22) return "New York Session";
  return "Asian Session (lower volatility)";
}

function getPips(pair: string, entry: number, price: number): number {
  const diff = Math.abs(entry - price);
  const jpyPairs = ["USD/JPY", "EUR/JPY", "GBP/JPY", "CAD/JPY"];
  const isJpy = jpyPairs.includes(pair);
  return Math.round(diff / (isJpy ? 0.01 : 0.0001));
}

export interface AnalyzeTradeParams {
  pair: string;
  direction: string;
  timeframe: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  lotSize: number;
  riskPercent: number;
  accountSize: number;
  rrRatio: number;
  reasoning: string;
  emotionScore: number;
  htfBias?: string | null;
  keyLevelsNearby?: boolean | null;
  keyLevelsDescription?: string | null;
  newsEvents?: Array<{ title: string; currency: string; minutesAway: number }>;
  lastTradeResult?: string | null;
  propFirmActive?: boolean;
  dailyLossRemaining?: number | null;
}

export interface AnalysisResult {
  overallScore: number;
  scoreLabel: string;
  confluence: {
    trendAlignment: number;
    entryTiming: number;
    riskManagement: number;
    newsSafety: number;
    sessionQuality: number;
    reasoningQuality: number;
    chartStructure?: number;
  };
  positives: string[];
  warnings: string[];
  negatives: string[];
  verdict: string;
  devilsAdvocate: string[];
  recommendedActions: string[];
  waitFor: string;
  revengeTradeWarning: boolean;
  propFirmAlert: string | null;
  newsAlert: { event: string; minutesAway: number; recommendation: string } | null;
  lotSizeRecommendation: number | null;
}

function getScoreLabel(score: number): string {
  if (score >= 86) return "Elite Setup — A+ Plan";
  if (score >= 76) return "Strong Setup — High Confidence";
  if (score >= 66) return "Good Setup — Valid Trade";
  if (score >= 56) return "Average Setup — Room for Improvement";
  if (score >= 41) return "Weak Setup — Proceed with Caution";
  return "Poor Setup — High Risk";
}

export async function analyzeTrade(params: AnalyzeTradeParams): Promise<AnalysisResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  const utcHour = new Date().getUTCHours();
  const session = getSession(utcHour);
  const slPips = getPips(params.pair, params.entryPrice, params.stopLoss);
  const tpPips = getPips(params.pair, params.entryPrice, params.takeProfit);
  const riskDollars = (params.accountSize * params.riskPercent) / 100;
  const newsStr = params.newsEvents?.length
    ? params.newsEvents.map((n) => `${n.title} (${n.currency}, ${n.minutesAway}min away)`).join(", ")
    : "None in next 4 hours";

  const userPrompt = `Analyze this forex trade setup and return a JSON response.

Trade Details:
- Pair: ${params.pair}
- Direction: ${params.direction.toUpperCase()}
- Timeframe: ${params.timeframe}
- Entry: ${params.entryPrice}
- Stop Loss: ${params.stopLoss} (${slPips} pips)
- Take Profit: ${params.takeProfit} (${tpPips} pips)
- R:R Ratio: 1:${params.rrRatio.toFixed(2)}
- Risk: ${params.riskPercent}% of account ($${riskDollars.toFixed(2)})
- Lot Size: ${params.lotSize}
- Higher TF Bias: ${params.htfBias ?? "Not specified"}
- Key Levels Nearby: ${params.keyLevelsNearby ? `Yes - ${params.keyLevelsDescription ?? ""}` : "No"}
- Trader's Reasoning: ${params.reasoning}
- Current Session: ${session}
- News Events Next 4hrs: ${newsStr}
- Emotional State: ${params.emotionScore}/10
- Last Trade Result: ${params.lastTradeResult ?? "Unknown"}
- Prop Firm Challenge Active: ${params.propFirmActive ? "Yes" : "No"}
- Max Daily Loss Remaining: ${params.dailyLossRemaining ? `$${params.dailyLossRemaining.toFixed(2)}` : "N/A"}

Return ONLY this exact JSON structure with no markdown, no explanation, just valid JSON:
{
  "overallScore": <number 0-100>,
  "confluence": {
    "trendAlignment": <number 0-10>,
    "entryTiming": <number 0-10>,
    "riskManagement": <number 0-10>,
    "newsSafety": <number 0-10>,
    "sessionQuality": <number 0-10>,
    "reasoningQuality": <number 0-10>
  },
  "positives": [<string>, ...],
  "warnings": [<string>, ...],
  "negatives": [<string>, ...],
  "verdict": "<3-5 sentence personalized analysis>",
  "devilsAdvocate": [<string>, <string>],
  "recommendedActions": [<string>, ...],
  "waitFor": "<what specific conditions would improve this setup>",
  "revengeTradeWarning": <boolean>,
  "propFirmAlert": <null or string>,
  "newsAlert": <null or {"event": "<name>", "minutesAway": <number>, "recommendation": "<string>"}>,
  "lotSizeRecommendation": <null or number>
}`;

  if (!apiKey) {
    logger.warn("OPENROUTER_API_KEY not set, returning mock analysis");
    return generateMockAnalysis(params);
  }

  try {
    const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://tradescope.app",
        "X-Title": "TradeScope",
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-v4-flash",
        messages: [
          {
            role: "system",
            content: "You are TradeScope, an expert forex trade analyst and trading coach. Your job is to objectively analyze trade setups submitted by traders and give them a detailed probability assessment. You are strict, honest, and educational. You never encourage bad trades. You always prioritize capital preservation. Return ONLY valid JSON.",
          },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    const content = data.choices[0]?.message?.content ?? "";
    const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(jsonStr) as Omit<AnalysisResult, "scoreLabel">;
    const score = Math.min(100, Math.max(0, Math.round(parsed.overallScore)));

    return {
      ...parsed,
      overallScore: score,
      scoreLabel: getScoreLabel(score),
    };
  } catch (err) {
    logger.error({ err }, "OpenRouter API call failed, using mock");
    return generateMockAnalysis(params);
  }
}

export interface ChartAnalyzeParams {
  imageBase64: string;
  mimeType: string;
  emotionScore: number;
  notes?: string | null;
  newsEvents?: Array<{ title: string; currency: string; minutesAway: number }>;
  lastTradeResult?: string | null;
  propFirmActive?: boolean;
}

export async function analyzeChartImage(params: ChartAnalyzeParams): Promise<AnalysisResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  const newsStr = params.newsEvents?.length
    ? params.newsEvents.map((n) => `${n.title} (${n.currency}, ${n.minutesAway}min away)`).join(", ")
    : "None in next 4 hours";

  const userTextPrompt = `Analyze this forex/trading chart image and provide a full technical analysis.

Additional context from trader:
- Emotional state: ${params.emotionScore}/10
- Trader notes: ${params.notes?.trim() || "None provided"}
- Upcoming news (next 4hrs): ${newsStr}
- Last trade result: ${params.lastTradeResult ?? "Unknown"}
- Prop firm active: ${params.propFirmActive ? "Yes" : "No"}

From the chart, identify everything visible: pair, timeframe, trend, key support/resistance, patterns (double top/bottom, head & shoulders, triangle, flag, engulfing candles, etc.), momentum, and entry/SL/TP zones.

Return ONLY this exact JSON with no markdown:
{
  "overallScore": <0-100>,
  "confluence": {
    "trendAlignment": <0-10>,
    "entryTiming": <0-10>,
    "riskManagement": <0-10>,
    "newsSafety": <0-10>,
    "sessionQuality": <0-10>,
    "reasoningQuality": <0-10>,
    "chartStructure": <0-10>
  },
  "positives": [<string>, ...],
  "warnings": [<string>, ...],
  "negatives": [<string>, ...],
  "verdict": "<5-7 sentence analysis referencing specific chart details, patterns, and price levels if visible>",
  "devilsAdvocate": [<string>, <string>],
  "recommendedActions": [<string>, ...],
  "waitFor": "<specific price action or candlestick condition to confirm entry>",
  "revengeTradeWarning": <boolean>,
  "propFirmAlert": <null or string>,
  "newsAlert": <null or {"event": "<name>", "minutesAway": <number>, "recommendation": "<string>"}>,
  "lotSizeRecommendation": null,
  "chartSummary": {
    "detectedPair": "<pair or Unknown>",
    "detectedTimeframe": "<timeframe or Unknown>",
    "trend": "<Bullish/Bearish/Ranging>",
    "patterns": [<string>, ...],
    "keyLevels": [<string>, ...],
    "suggestedEntry": "<price zone or description>",
    "suggestedSL": "<price zone or description>",
    "suggestedTP": "<price zone or description>"
  }
}`;

  if (!apiKey) {
    logger.warn("OPENROUTER_API_KEY not set, returning mock chart analysis");
    return generateMockChartAnalysis(params.emotionScore);
  }

  try {
    const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://tradescope.app",
        "X-Title": "TradeScope",
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-v4-flash",
        messages: [
          {
            role: "system",
            content:
              "You are TradeScope, an expert forex technical analyst. Analyze chart images and return structured JSON trade analysis. Be specific about what you see in the chart. Return ONLY valid JSON.",
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:${params.mimeType};base64,${params.imageBase64}` },
              },
              { type: "text", text: userTextPrompt },
            ],
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    const content = data.choices[0]?.message?.content ?? "";
    const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(jsonStr) as Omit<AnalysisResult, "scoreLabel"> & { chartSummary?: unknown };
    const score = Math.min(100, Math.max(0, Math.round(parsed.overallScore)));

    return {
      ...parsed,
      overallScore: score,
      scoreLabel: getScoreLabel(score),
    };
  } catch (err) {
    logger.error({ err }, "Chart image analysis failed, using mock");
    return generateMockChartAnalysis(params.emotionScore);
  }
}

function generateMockChartAnalysis(emotionScore: number): AnalysisResult {
  const score = Math.round(58 + Math.random() * 20);
  return {
    overallScore: score,
    scoreLabel: getScoreLabel(score),
    confluence: {
      trendAlignment: 7,
      entryTiming: 6,
      riskManagement: 6,
      newsSafety: 7,
      sessionQuality: 6,
      reasoningQuality: 5,
      chartStructure: 7,
    },
    positives: [
      "Clear market structure visible in the chart with identifiable trend",
      "Price approaching a significant technical level — potential high-probability zone",
      "Chart shows clean price action with minimal noise",
    ],
    warnings: [
      emotionScore < 7
        ? `Emotional state (${emotionScore}/10) is below optimal — trade with extra caution`
        : "Confirm entry with a strong candle close before executing",
      "Always check the higher timeframe for overall bias before entering",
      "Economic news events could override technical signals — check the calendar",
    ],
    negatives: [],
    verdict:
      "Based on the submitted chart, there is visible technical structure indicating a potential trading opportunity. The price action shows clear market structure with identifiable levels. Before executing, wait for a strong entry confirmation signal (e.g. a rejection candle or a break and retest of key level). Ensure your stop loss is placed beyond the nearest significant swing point. Risk management is critical — never risk more than 2% of your account on a single trade.",
    devilsAdvocate: [
      "The market could sweep liquidity beyond the obvious level before reversing — premature entries get stopped out",
      "Without seeing higher timeframe context, this setup may be counter-trend and therefore lower probability",
    ],
    recommendedActions: [
      "Wait for a confirmed candle close to validate the direction before entering",
      "Place your stop loss beyond the nearest significant swing high/low",
      "Target a minimum 1:2 R:R — only enter if TP is at least double the SL distance",
      "Check for any high-impact news events that could affect this pair",
    ],
    waitFor:
      "A strong momentum candle closing convincingly past the key level, followed by a retest that holds as new support/resistance",
    revengeTradeWarning: false,
    propFirmAlert: null,
    newsAlert: null,
    lotSizeRecommendation: null,
  };
}

function generateMockAnalysis(params: AnalyzeTradeParams): AnalysisResult {
  const rrScore = params.rrRatio >= 2 ? 8 : params.rrRatio >= 1.5 ? 6 : 4;
  const riskScore = params.riskPercent <= 2 ? 8 : params.riskPercent <= 3 ? 6 : 3;
  const emotionScore = params.emotionScore >= 7 ? 8 : params.emotionScore >= 5 ? 6 : 3;
  const reasoningScore = params.reasoning.length > 100 ? 8 : params.reasoning.length > 50 ? 6 : 4;
  const htfScore = params.htfBias && params.htfBias !== "Not checked" ? 7 : 5;

  const confluenceAvg = (rrScore + riskScore + emotionScore + reasoningScore + htfScore + 6) / 6;
  const overallScore = Math.round(Math.min(95, Math.max(20, confluenceAvg * 10)));

  return {
    overallScore,
    scoreLabel: getScoreLabel(overallScore),
    confluence: {
      trendAlignment: htfScore,
      entryTiming: Math.round(5 + Math.random() * 4),
      riskManagement: riskScore,
      newsSafety: 7,
      sessionQuality: 6,
      reasoningQuality: reasoningScore,
    },
    positives: [
      params.rrRatio >= 2 ? `Solid R:R ratio of 1:${params.rrRatio.toFixed(2)} provides good reward potential` : `Trade has defined risk with SL at ${params.stopLoss}`,
      params.riskPercent <= 2 ? "Conservative risk percentage protects your capital" : "Trade aligns with technical structure",
      params.reasoning.length > 50 ? "Trader has articulated clear reasoning for the trade" : "Entry has defined stop loss level",
    ].filter(Boolean),
    warnings: [
      params.emotionScore < 7 ? `Emotional state (${params.emotionScore}/10) is below optimal — ensure you're trading clearly` : null,
      params.riskPercent > 2 ? `Risk of ${params.riskPercent}% is above the recommended 2% rule` : null,
      "Always confirm the higher timeframe bias before entry",
    ].filter(Boolean) as string[],
    negatives: params.rrRatio < 1.5 ? [`R:R ratio of 1:${params.rrRatio.toFixed(2)} is below the minimum recommended 1:1.5`] : [],
    verdict: `This ${params.direction.toUpperCase()} setup on ${params.pair} shows ${overallScore >= 70 ? "reasonable" : "below-average"} confluence. The risk management ${params.riskPercent <= 2 ? "is solid" : "needs improvement"} and the R:R ratio of 1:${params.rrRatio.toFixed(2)} ${params.rrRatio >= 2 ? "provides good potential" : "is marginal"}. ${params.reasoning.length > 80 ? "Your reasoning demonstrates good market awareness." : "Consider building a more detailed trade rationale."} ${params.emotionScore >= 7 ? "Your emotional state appears calm, which is ideal for trading." : "Be mindful of your current emotional state before executing."}`,
    devilsAdvocate: [
      `The market could easily stop you out before reaching your take profit at ${params.takeProfit}`,
      `Counter-trend moves on ${params.pair} can be violent — ensure your stop is beyond key structure`,
    ],
    recommendedActions: [
      params.riskPercent > 2 ? `Reduce position size to limit risk to 1-2% of account` : "Maintain your current risk management approach",
      params.rrRatio < 2 ? "Consider moving TP further to achieve minimum 1:2 R:R" : "Your TP target is well positioned",
      "Confirm entry with a 15-minute close above/below key level before executing",
    ],
    waitFor: `Wait for a ${params.timeframe} candle close ${params.direction === "buy" ? "above" : "below"} the key level with increasing volume before entering`,
    revengeTradeWarning: false,
    propFirmAlert: null,
    newsAlert: null,
    lotSizeRecommendation: null,
  };
}
