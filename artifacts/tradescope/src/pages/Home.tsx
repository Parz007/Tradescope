import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useAppContext } from "@/lib/AppContext";
import {
  useGetUser,
  useGetNews,
  useListAnalyses,
  getGetUserQueryKey,
  getListAnalysesQueryKey,
  getGetNewsQueryKey,
} from "@workspace/api-client-react";
import {
  TrendingUp,
  TrendingDown,
  Flame,
  Zap,
  Clock,
  AlertTriangle,
  ShoppingBag,
  BarChart2,
  Calculator,
  Bell,
  Trophy,
  ChevronRight,
  BrainCircuit,
} from "lucide-react";

const QUOTES = [
  "The goal of a successful trader is to make the best trades. Money is secondary.",
  "Plan the trade. Trade the plan. Then trade some more.",
  "Risk management is not about fear — it's about survival.",
  "Patience is the most underrated trading skill.",
  "Discipline separates professionals from amateurs.",
  "The market rewards those who wait for high-probability setups.",
];

const PAIR_FLAGS: Record<string, string> = {
  EUR: "🇪🇺", USD: "🇺🇸", GBP: "🇬🇧", JPY: "🇯🇵",
  CHF: "🇨🇭", AUD: "🇦🇺", NZD: "🇳🇿", CAD: "🇨🇦",
  XAU: "🥇", XAG: "🪙", BTC: "₿", OIL: "🛢️",
  US30: "🇺🇸", NAS100: "🇺🇸", SPX500: "🇺🇸",
};

function getPairFlag(pair: string) {
  const parts = pair.split("/");
  if (parts.length === 2) {
    return `${PAIR_FLAGS[parts[0]] ?? ""} ${PAIR_FLAGS[parts[1]] ?? ""}`;
  }
  return PAIR_FLAGS[pair] ?? "";
}

function getSession(): { name: string; emoji: string; color: string } {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 6=Sat
  const hour = now.getUTCHours();

  // Forex market closed: all Sunday, Saturday after 21:00 UTC, and before Sunday 21:00 UTC
  const isSunday = day === 0;
  const isSaturday = day === 6;
  // Market opens Sunday 21:00 UTC, closes Saturday 21:00 UTC
  if (isSunday && hour < 21) return { name: "Markets Closed · Weekend", emoji: "🔴", color: "#EF4444" };
  if (isSaturday && hour >= 21) return { name: "Markets Closed · Weekend", emoji: "🔴", color: "#EF4444" };
  if (isSaturday) return { name: "Markets Closed · Weekend", emoji: "🔴", color: "#EF4444" };

  if (hour >= 13 && hour < 16) return { name: "London/NY Overlap", emoji: "⚡", color: "#F0B429" };
  if (hour >= 7 && hour < 16) return { name: "London Session", emoji: "🇬🇧", color: "#3B82F6" };
  if (hour >= 13 && hour < 22) return { name: "New York Session", emoji: "🇺🇸", color: "#10B981" };
  return { name: "Asian Session", emoji: "🌏", color: "#6366F1" };
}

function getScoreColor(score: number): string {
  if (score >= 86) return "#F0B429";
  if (score >= 66) return "#3B82F6";
  if (score >= 41) return "#F59E0B";
  return "#EF4444";
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

interface QuickToolProps {
  icon: React.ElementType;
  label: string;
  sub: string;
  color: string;
  href: string;
  onClick: () => void;
}

function QuickTool({ icon: Icon, label, sub, color, onClick }: QuickToolProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-3 rounded-xl bg-[#0D1117] border border-[#1E2736] active:scale-[0.97] transition-transform text-left"
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${color}22` }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[#F1F5F9] text-sm font-semibold leading-tight">{label}</p>
        <p className="text-[#64748B] text-[10px] leading-tight mt-0.5 truncate">{sub}</p>
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-[#374151] shrink-0" />
    </button>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { user, telegramUser } = useAppContext();
  const now = useNow();
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  const session = getSession();

  const userId = user?.id ?? "";
  const telegramId = user?.telegramId ?? "";

  const { data: profile } = useGetUser(telegramId, {
    query: { enabled: !!telegramId, queryKey: getGetUserQueryKey(telegramId) },
  });
  const { data: newsEvents } = useGetNews({ query: { queryKey: getGetNewsQueryKey() } });
  const { data: historyPage } = useListAnalyses(userId, {
    query: { enabled: !!userId, queryKey: getListAnalysesQueryKey(userId) },
  });

  const recentAnalyses = historyPage?.analyses?.slice(0, 3) ?? profile?.recentAnalyses?.slice(0, 3) ?? [];
  const stats = profile?.quickStats;
  const userData = profile?.user ?? user;

  const upcomingNews = newsEvents?.filter((e) => (e.minutesAway ?? 0) >= 0 && (e.minutesAway ?? 999) <= 240) ?? [];

  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });

  return (
    <div className="flex flex-col gap-4 p-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[#64748B] text-sm">{getGreeting()},</p>
          <h1 className="font-display text-2xl font-bold text-[#F1F5F9]">
            {telegramUser?.first_name ?? userData?.firstName ?? "Trader"}
          </h1>
        </div>
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#F0B429] to-[#D97706] flex items-center justify-center text-[#080B14] font-bold text-lg">
          {(telegramUser?.first_name ?? userData?.firstName ?? "T")[0].toUpperCase()}
        </div>
      </div>

      {/* Session Card */}
      <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{session.emoji}</span>
            <div>
              <p className="text-[#64748B] text-xs uppercase tracking-wider">Active Session</p>
              <p className="font-display font-semibold" style={{ color: session.color }}>
                {session.name}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 text-[#64748B]">
              <Clock className="w-3 h-3" />
              <span className="text-xs">UTC</span>
            </div>
            <p className="font-mono text-[#F1F5F9] font-semibold text-sm">{timeStr}</p>
          </div>
        </div>
      </div>

      {/* Upcoming News */}
      {upcomingNews.length > 0 && (
        <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" />
            <p className="text-[#F1F5F9] font-semibold text-sm">Upcoming High-Impact News</p>
          </div>
          <div className="flex flex-col gap-2">
            {upcomingNews.slice(0, 3).map((event) => (
              <div key={event.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{PAIR_FLAGS[event.currency] ?? "🌐"}</span>
                  <span className="text-[#F1F5F9] text-sm">{event.title}</span>
                </div>
                <span className="text-[#F59E0B] text-xs font-mono">
                  {(event.minutesAway ?? 0) < 60
                    ? `${event.minutesAway ?? 0}m`
                    : `${Math.floor((event.minutesAway ?? 0) / 60)}h ${(event.minutesAway ?? 0) % 60}m`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Streak Card */}
      <div className="rounded-xl border border-[#F0B429]/30 bg-gradient-to-r from-[#F0B429]/10 to-transparent p-4">
        <div className="flex items-center gap-3">
          <Flame className="w-8 h-8 text-[#F0B429]" />
          <div>
            <p className="font-display font-bold text-[#F0B429] text-lg">
              {userData?.currentStreak ?? 0} day{(userData?.currentStreak ?? 0) !== 1 ? "s" : ""} streak
            </p>
            <p className="text-[#64748B] text-sm">of disciplined trading</p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-3 text-center">
          <p className="font-display font-bold text-[#F1F5F9] text-xl">
            {stats?.totalAnalyses ?? 0}
          </p>
          <p className="text-[#64748B] text-xs mt-1">Analyses</p>
        </div>
        <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-3 text-center">
          <p className="font-display font-bold text-[#3B82F6] text-xl">
            {stats?.avgScoreThisWeek != null ? Math.round(stats.avgScoreThisWeek) : "-"}
          </p>
          <p className="text-[#64748B] text-xs mt-1">Avg This Week</p>
        </div>
        <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-3 text-center">
          <p className="font-display font-bold text-[#F0B429] text-xl">
            {stats?.bestScoreEver ?? "-"}
          </p>
          <p className="text-[#64748B] text-xs mt-1">Best Score</p>
        </div>
      </div>

      {/* Quick Tools */}
      <div>
        <p className="text-[#64748B] text-xs font-medium uppercase tracking-wider mb-2">Quick Tools</p>
        <div className="grid grid-cols-2 gap-2">
          <QuickTool
            icon={ShoppingBag}
            label="FTMO Accounts"
            sub="Buy live funded accounts"
            color="#F0B429"
            href="/marketplace"
            onClick={() => setLocation("/marketplace")}
          />
          <QuickTool
            icon={BarChart2}
            label="Analytics"
            sub="Pair heatmap & trends"
            color="#3B82F6"
            href="/analytics"
            onClick={() => setLocation("/analytics")}
          />
          <QuickTool
            icon={Calculator}
            label="Risk Calc"
            sub="Position size & pip value"
            color="#10B981"
            href="/risk"
            onClick={() => setLocation("/risk")}
          />
          <QuickTool
            icon={BrainCircuit}
            label="AI Coach"
            sub="Ask trading questions"
            color="#F0B429"
            href="/coach"
            onClick={() => setLocation("/coach")}
          />
          <QuickTool
            icon={Trophy}
            label="Prop Firm"
            sub="Challenge tracker"
            color="#F59E0B"
            href="/propfirm"
            onClick={() => setLocation("/propfirm")}
          />
          <QuickTool
            icon={TrendingUp}
            label="Trade History"
            sub="Review past setups"
            color="#06B6D4"
            href="/history"
            onClick={() => setLocation("/history")}
          />
        </div>
      </div>

      {/* Recent Analyses */}
      {recentAnalyses.length > 0 && (
        <div>
          <p className="text-[#64748B] text-sm font-medium mb-3 uppercase tracking-wider">Recent Analyses</p>
          <div className="flex flex-col gap-2">
            {recentAnalyses.map((a) => (
              <div
                key={a.id}
                className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-3 flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer"
                onClick={() => setLocation("/history")}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm">{getPairFlag(a.pair)}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#F1F5F9] text-sm">{a.pair}</span>
                      <span
                        className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          a.direction === "buy"
                            ? "bg-[#10B981]/20 text-[#10B981]"
                            : "bg-[#EF4444]/20 text-[#EF4444]"
                        }`}
                      >
                        {a.direction.toUpperCase()}
                      </span>
                      <span className="text-[#64748B] text-xs">{a.timeframe}</span>
                    </div>
                    <p className="text-[#64748B] text-xs mt-0.5">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    backgroundColor: `${getScoreColor(a.overallScore)}20`,
                    color: getScoreColor(a.overallScore),
                    border: `2px solid ${getScoreColor(a.overallScore)}40`,
                  }}
                >
                  {a.overallScore}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA Button */}
      <button
        onClick={() => setLocation("/analyze")}
        className="w-full py-4 rounded-[20px] font-display font-bold text-lg text-[#080B14] bg-gradient-to-r from-[#F0B429] to-[#D97706] active:scale-[0.97] transition-transform flex items-center justify-center gap-2 shadow-lg shadow-[#F0B429]/20"
      >
        <Zap className="w-5 h-5" />
        Analyze New Trade
      </button>

      {/* Motivational Quote */}
      <div className="rounded-xl bg-[#0D1117]/50 border border-[#1E2736]/50 p-4 text-center">
        <p className="text-[#64748B] text-sm italic">"{quote}"</p>
      </div>
    </div>
  );
}
