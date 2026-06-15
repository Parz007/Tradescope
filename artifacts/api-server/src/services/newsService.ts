import { logger } from "../lib/logger";

export interface NewsEvent {
  id: string;
  title: string;
  currency: string;
  impact: "high" | "medium" | "low";
  date: string;
  time: string;
  forecast: string | null;
  previous: string | null;
  minutesAway: number;
}

let newsCache: NewsEvent[] | null = null;
let cacheTime: number = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

interface ForexFactoryEvent {
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast: string;
  previous: string;
}

const CURRENCY_MAP: Record<string, string> = {
  USD: "USD", EUR: "EUR", GBP: "GBP", JPY: "JPY",
  CAD: "CAD", AUD: "AUD", NZD: "NZD", CHF: "CHF",
  CNY: "CNY", SEK: "SEK", NOK: "NOK", DKK: "DKK",
};

export async function getForexNews(): Promise<NewsEvent[]> {
  if (newsCache && Date.now() - cacheTime < CACHE_TTL) {
    return newsCache;
  }

  try {
    const res = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json", {
      headers: {
        "Accept": "application/json",
        "User-Agent": "TradeScope/1.0",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`ForexFactory returned ${res.status}`);

    const data = await res.json() as ForexFactoryEvent[];
    const nowMs = Date.now();

    const events: NewsEvent[] = data
      .filter((item) => {
        const impact = item.impact?.toLowerCase();
        return impact === "high" || impact === "medium";
      })
      .map((item, idx) => {
        const eventDate = new Date(item.date);
        const minutesAway = Math.round((eventDate.getTime() - nowMs) / 60000);
        const currency = CURRENCY_MAP[item.country] ?? item.country;
        return {
          id: `ff-${idx}-${item.country}-${eventDate.getTime()}`,
          title: item.title,
          currency,
          impact: item.impact?.toLowerCase() === "high" ? "high" : "medium",
          date: eventDate.toISOString().split("T")[0],
          time: eventDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false }),
          forecast: item.forecast || null,
          previous: item.previous || null,
          minutesAway,
        } as NewsEvent;
      })
      .filter((e) => e.minutesAway >= -60) // include events up to 60 min past
      .sort((a, b) => a.minutesAway - b.minutesAway);

    logger.info({ count: events.length }, "Loaded ForexFactory calendar events");
    newsCache = events;
    cacheTime = Date.now();
    return events;
  } catch (err) {
    logger.warn({ err }, "ForexFactory calendar fetch failed, using fallback");
    // Try next-week feed as fallback
    try {
      const res2 = await fetch("https://nfs.faireconomy.media/ff_calendar_nextweek.json", {
        headers: { "Accept": "application/json", "User-Agent": "TradeScope/1.0" },
        signal: AbortSignal.timeout(5000),
      });
      if (res2.ok) {
        const data2 = await res2.json() as ForexFactoryEvent[];
        const nowMs = Date.now();
        const events = data2
          .filter((item) => item.impact?.toLowerCase() === "high" || item.impact?.toLowerCase() === "medium")
          .map((item, idx) => {
            const eventDate = new Date(item.date);
            const minutesAway = Math.round((eventDate.getTime() - nowMs) / 60000);
            return {
              id: `ff-nw-${idx}`,
              title: item.title,
              currency: CURRENCY_MAP[item.country] ?? item.country,
              impact: item.impact?.toLowerCase() === "high" ? "high" as const : "medium" as const,
              date: eventDate.toISOString().split("T")[0],
              time: eventDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false }),
              forecast: item.forecast || null,
              previous: item.previous || null,
              minutesAway,
            };
          });
        newsCache = events;
        cacheTime = Date.now();
        return events;
      }
    } catch {}
    // Static fallback — empty rather than fake data
    return newsCache ?? [];
  }
}
