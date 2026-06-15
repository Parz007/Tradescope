import { useState } from "react";
import { useAppContext } from "@/lib/AppContext";
import {
  useGetUserStats,
  useGetWeeklyReport,
  getGetUserStatsQueryKey,
  getGetWeeklyReportQueryKey,
} from "@workspace/api-client-react";
import { Flame, TrendingUp, TrendingDown, Star, Lock, X, Check, Zap, Crown } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";

function GradeColor(grade: string | null | undefined): string {
  if (!grade) return "#64748B";
  const g = grade.toUpperCase();
  if (g === "A" || g === "A+") return "#F0B429";
  if (g === "B") return "#10B981";
  if (g === "C") return "#3B82F6";
  if (g === "D") return "#F59E0B";
  return "#EF4444";
}

const PLANS = [
  {
    id: "pro",
    name: "Pro",
    price: "$9.99",
    period: "/month",
    color: "#3B82F6",
    icon: Zap,
    features: [
      "Unlimited analyses per month",
      "Full confluence breakdown",
      "AI devil's advocate",
      "Trade history & tracking",
      "Prop firm challenge tracker",
    ],
  },
  {
    id: "elite",
    name: "Elite",
    price: "$24.99",
    period: "/month",
    color: "#F0B429",
    icon: Crown,
    popular: true,
    features: [
      "Everything in Pro",
      "Weekly AI performance report",
      "Trading DNA analysis",
      "Priority AI responses",
      "Mistake heatmap & streaks",
      "Early access to new features",
    ],
  },
];

function UpgradeModal({ currentTier, onClose }: { currentTier: string; onClose: () => void }) {
  const [selected, setSelected] = useState<"pro" | "elite">("elite");

  function handleUpgrade() {
    const msg = encodeURIComponent(
      `Hi! I'd like to upgrade my TradeScope account to the ${selected.toUpperCase()} plan. My current tier is: ${currentTier}.`
    );
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.openTelegramLink(`https://t.me/tradescope_support?text=${msg}`);
    } else {
      window.open(`https://t.me/tradescope_support?text=${msg}`, "_blank");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-[#0D1117] border-t border-[#1E2736] rounded-t-2xl p-5 pb-8 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-[#F1F5F9]">Upgrade Your Plan</h2>
            <p className="text-[#64748B] text-sm mt-0.5">Unlock your full trading potential</p>
          </div>
          <button onClick={onClose} className="text-[#64748B] hover:text-[#F1F5F9] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const isSelected = selected === plan.id;
            return (
              <button
                key={plan.id}
                onClick={() => setSelected(plan.id as "pro" | "elite")}
                className={`relative rounded-xl p-4 text-left border-2 transition-all ${
                  isSelected
                    ? "border-[var(--plan-color)] bg-[var(--plan-color)]/10"
                    : "border-[#1E2736] bg-[#161B27]"
                }`}
                style={{ "--plan-color": plan.color } as React.CSSProperties}
              >
                {plan.popular && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-[#F0B429] text-[#080B14] text-[10px] font-bold rounded-full whitespace-nowrap">
                    MOST POPULAR
                  </div>
                )}
                <Icon className="w-5 h-5 mb-2" style={{ color: plan.color }} />
                <p className="font-display font-bold text-[#F1F5F9]">{plan.name}</p>
                <div className="flex items-baseline gap-0.5 mt-1">
                  <span className="text-lg font-bold" style={{ color: plan.color }}>{plan.price}</span>
                  <span className="text-[#64748B] text-xs">{plan.period}</span>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-[#94A3B8]">
                      <Check className="w-3 h-3 mt-0.5 shrink-0" style={{ color: plan.color }} />
                      {f}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        <button
          onClick={handleUpgrade}
          className="w-full py-3.5 rounded-[20px] font-bold text-[#080B14] text-base active:scale-95 transition-transform bg-gradient-to-r from-[#F0B429] to-[#D97706]"
        >
          Upgrade to {selected.charAt(0).toUpperCase() + selected.slice(1)} →
        </button>
        <p className="text-[#64748B] text-xs text-center">
          You'll be connected to our support team to complete payment securely.
        </p>
      </div>
    </div>
  );
}

export default function Profile() {
  const { user } = useAppContext();
  const telegramId = user?.telegramId ?? "";
  const [showUpgrade, setShowUpgrade] = useState(false);

  const { data: stats, isLoading } = useGetUserStats(telegramId, {
    query: { enabled: !!telegramId, queryKey: getGetUserStatsQueryKey(telegramId) },
  });
  const { data: report } = useGetWeeklyReport(telegramId, {
    query: { enabled: !!telegramId, queryKey: getGetWeeklyReportQueryKey(telegramId) },
  });

  const dna = stats?.tradingDna;
  const streaks = stats?.streaks;
  const personal = stats?.personalStats;
  const scoreHistory = stats?.scoreHistory ?? [];
  const heatmap = stats?.mistakeHeatmap ?? [];

  const weekDiff = personal ? personal.avgScoreThisWeek - personal.avgScoreLastWeek : 0;

  return (
    <div className="flex flex-col gap-4 p-4 pt-6">
      {showUpgrade && (
        <UpgradeModal
          currentTier={user?.subscriptionTier ?? "free"}
          onClose={() => setShowUpgrade(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#F0B429] to-[#D97706] flex items-center justify-center text-[#080B14] font-bold text-2xl">
          {(user?.firstName ?? "T")[0].toUpperCase()}
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-[#F1F5F9]">
            {user?.firstName} {user?.lastName}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              user?.subscriptionTier === "elite" ? "bg-[#F0B429]/20 text-[#F0B429]" :
              user?.subscriptionTier === "pro" ? "bg-[#3B82F6]/20 text-[#3B82F6]" :
              "bg-[#64748B]/20 text-[#64748B]"
            }`}>
              {(user?.subscriptionTier ?? "free").toUpperCase()}
            </span>
            {user?.username && <span className="text-[#64748B] text-xs">@{user.username}</span>}
          </div>
        </div>
      </div>

      {/* Trading DNA */}
      <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] overflow-hidden">
        <div className="p-4 flex items-center justify-between border-b border-[#1E2736]">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-[#F0B429]" />
            <p className="font-display font-semibold text-[#F1F5F9]">Trading DNA</p>
          </div>
          {dna?.unlocked === false && (
            <div className="flex items-center gap-1.5 text-[#64748B] text-xs">
              <Lock className="w-3 h-3" />
              <span>Unlock after 10 analyses</span>
            </div>
          )}
        </div>
        {isLoading ? (
          <div className="p-4 animate-pulse space-y-2">
            {[1,2,3,4].map((i) => <div key={i} className="h-4 bg-[#1E2736] rounded" />)}
          </div>
        ) : dna?.unlocked === false ? (
          <div className="p-8 text-center">
            <Lock className="w-10 h-10 text-[#1E2736] mx-auto mb-3" />
            <p className="text-[#64748B] text-sm">Complete 10 analyses to unlock your Trading DNA profile</p>
            <p className="text-[#64748B] text-xs mt-1">
              {personal?.totalAnalyses ?? 0} / 10 completed
            </p>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-2 gap-3">
            {[
              { label: "Strongest Pair", value: dna?.strongestPair, color: "#F0B429" },
              { label: "Best Timeframe", value: dna?.bestTimeframe, color: "#3B82F6" },
              { label: "Best Session", value: dna?.bestSession, color: "#10B981" },
              { label: "Worst Habit", value: dna?.worstHabit, color: "#EF4444" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-[#161B27] rounded-lg p-3">
                <p className="text-[#64748B] text-xs">{label}</p>
                <p className="font-semibold mt-1 text-sm" style={{ color }}>{value ?? "N/A"}</p>
              </div>
            ))}
            <div className="col-span-2 bg-[#161B27] rounded-lg p-3 flex items-center justify-between">
              <p className="text-[#64748B] text-sm">Consistency Grade</p>
              <span className="font-display font-bold text-2xl" style={{ color: GradeColor(dna?.consistencyGrade) }}>
                {dna?.consistencyGrade ?? "-"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Streaks */}
      {streaks && (
        <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-4 h-4 text-[#F0B429]" />
            <p className="font-display font-semibold text-[#F1F5F9]">Streaks</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Current", value: streaks.currentStreak, color: "#F0B429" },
              { label: "Longest", value: streaks.longestStreak, color: "#10B981" },
              { label: "Discipline", value: streaks.disciplineStreak, color: "#3B82F6" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-[#161B27] rounded-lg p-3 text-center">
                <p className="font-display font-bold text-xl" style={{ color }}>{value}</p>
                <p className="text-[#64748B] text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Score Chart */}
      {scoreHistory.length > 0 && (
        <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-[#3B82F6]" />
            <p className="font-display font-semibold text-[#F1F5F9]">Score Trend</p>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={scoreHistory} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F0B429" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F0B429" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: "#64748B", fontSize: 10 }} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: "#64748B", fontSize: 10 }} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: "#0D1117", border: "1px solid #1E2736", borderRadius: "8px", color: "#F1F5F9" }} />
              <Area type="monotone" dataKey="score" stroke="#F0B429" strokeWidth={2} fill="url(#scoreGrad)" dot={{ fill: "#F0B429", r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Personal Stats */}
      {personal && (
        <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-4">
          <p className="font-display font-semibold text-[#F1F5F9] mb-3">Personal Stats</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#161B27] rounded-lg p-3">
              <p className="text-[#64748B] text-xs">Total Analyses</p>
              <p className="font-display font-bold text-xl text-[#F1F5F9] mt-1">{personal.totalAnalyses}</p>
            </div>
            <div className="bg-[#161B27] rounded-lg p-3">
              <p className="text-[#64748B] text-xs">Avg Score (All Time)</p>
              <p className="font-display font-bold text-xl text-[#3B82F6] mt-1">
                {personal.avgScoreAllTime ? Math.round(personal.avgScoreAllTime) : "-"}
              </p>
            </div>
            <div className="bg-[#161B27] rounded-lg p-3">
              <p className="text-[#64748B] text-xs">This Week vs Last</p>
              <div className="flex items-center gap-1 mt-1">
                <p className="font-display font-bold text-xl text-[#F1F5F9]">
                  {personal.avgScoreThisWeek ? Math.round(personal.avgScoreThisWeek) : "-"}
                </p>
                {weekDiff !== 0 && (
                  <div className={`flex items-center text-xs ${weekDiff > 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                    {weekDiff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {Math.abs(weekDiff).toFixed(1)}
                  </div>
                )}
              </div>
            </div>
            <div className="bg-[#161B27] rounded-lg p-3">
              <p className="text-[#64748B] text-xs">Win Rate</p>
              <p className="font-display font-bold text-xl text-[#10B981] mt-1">
                {personal.winRate != null ? `${Math.round(personal.winRate * 100)}%` : "-"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mistake Heatmap */}
      {heatmap.length > 0 && (
        <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-4">
          <p className="font-display font-semibold text-[#F1F5F9] mb-3">Mistake Heatmap</p>
          <div className="grid grid-cols-7 gap-1">
            {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
              <p key={d} className="text-[#64748B] text-[10px] text-center">{d}</p>
            ))}
            {Array.from({ length: 28 }, (_, idx) => {
              const day = idx % 7;
              const hour = Math.floor(idx / 7);
              const cell = heatmap.find((h) => h.day === day && h.hour === hour);
              const intensity = cell ? Math.max(0, Math.min(1, 1 - cell.avgScore / 100)) : 0;
              return (
                <div key={idx} className="aspect-square rounded-sm" style={{ backgroundColor: `rgba(239, 68, 68, ${intensity * 0.8 + 0.05})` }} title={cell ? `Score: ${cell.avgScore.toFixed(0)}` : ""} />
              );
            })}
          </div>
          <p className="text-[#64748B] text-xs mt-2 text-center">Darker = lower scoring setups</p>
        </div>
      )}

      {/* Weekly Report */}
      {report && (
        <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-4 space-y-3">
          <p className="font-display font-semibold text-[#F1F5F9]">Weekly AI Report</p>
          <p className="text-[#F1F5F9] text-sm leading-relaxed">{report.summary}</p>
          <div>
            <p className="text-[#10B981] text-xs font-semibold uppercase tracking-wider mb-2">Top Strengths</p>
            {report.strengths.map((s, i) => (
              <div key={i} className="flex items-start gap-2 mb-1">
                <span className="text-[#10B981] text-xs mt-0.5">•</span>
                <p className="text-[#F1F5F9] text-sm">{s}</p>
              </div>
            ))}
          </div>
          <div>
            <p className="text-[#F59E0B] text-xs font-semibold uppercase tracking-wider mb-2">Areas to Improve</p>
            {report.improvements.map((imp, i) => (
              <div key={i} className="flex items-start gap-2 mb-1">
                <span className="text-[#F59E0B] text-xs mt-0.5">•</span>
                <p className="text-[#F1F5F9] text-sm">{imp}</p>
              </div>
            ))}
          </div>
          <div className="rounded-lg bg-[#3B82F6]/10 border border-[#3B82F6]/20 p-3">
            <p className="text-[#3B82F6] text-xs font-semibold mb-1">Tip for This Week</p>
            <p className="text-[#F1F5F9] text-sm">{report.tip}</p>
          </div>
          <p className="text-[#64748B] text-xs text-center">Report refreshes every Monday</p>
        </div>
      )}

      {/* Subscription */}
      <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-4">
        <p className="font-display font-semibold text-[#F1F5F9] mb-3">Subscription</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[#F1F5F9] font-medium capitalize">{user?.subscriptionTier ?? "free"} Plan</p>
            <p className="text-[#64748B] text-xs mt-0.5">
              {user?.subscriptionTier === "free" ? "5 analyses/month" :
               user?.subscriptionTier === "pro" ? "Unlimited analyses + full breakdown" :
               "Everything + AI reports + DNA analysis"}
            </p>
          </div>
          {user?.subscriptionTier !== "elite" && (
            <button
              onClick={() => setShowUpgrade(true)}
              className="px-4 py-2 bg-gradient-to-r from-[#F0B429] to-[#D97706] text-[#080B14] rounded-lg text-sm font-bold active:scale-95 transition-transform"
            >
              Upgrade
            </button>
          )}
        </div>
      </div>

      <div className="pb-8" />
    </div>
  );
}
