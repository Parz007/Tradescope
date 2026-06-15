import { useAppContext } from "@/lib/AppContext";
import { useGetAdvancedAnalytics } from "@workspace/api-client-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  Cell,
} from "recharts";
import { TrendingUp, Award, Target, Clock, Download, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";

const GOLD = "#F0B429";
const BLUE = "#3B82F6";
const GREEN = "#10B981";
const RED = "#EF4444";
const PURPLE = "#8B5CF6";

const PAIR_COLORS = [GOLD, BLUE, GREEN, PURPLE, "#F472B6", "#06B6D4", "#F97316", "#84CC16"];

function ScoreGauge({ score }: { score: number }) {
  const angle = -135 + (score / 100) * 270;
  const color = score >= 80 ? GREEN : score >= 60 ? GOLD : score >= 40 ? "#F59E0B" : RED;
  return (
    <div className="relative w-28 h-28 flex items-center justify-center">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-0">
        <circle cx="60" cy="60" r="50" fill="none" stroke="#1E2736" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${270 * 0.01745329 * 50} ${360 * 0.01745329 * 50}`}
          strokeDashoffset={-((45 / 360) * Math.PI * 2 * 50)}
          transform="rotate(-135 60 60)"
        />
        <circle cx="60" cy="60" r="50" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${(score / 100) * 270 * 0.01745329 * 50} ${360 * 0.01745329 * 50}`}
          strokeDashoffset={-((45 / 360) * Math.PI * 2 * 50)}
          transform="rotate(-135 60 60)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>{score}</span>
        <span className="text-[9px] text-[#64748B]">avg score</span>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="bg-[#0D1117] border border-[#1E2736] rounded-xl p-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${color}22` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div>
        <p className="text-[10px] text-[#64748B] uppercase tracking-wide">{label}</p>
        <p className="text-sm font-bold text-[#F1F5F9]">{value}</p>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0D1117] border border-[#1E2736] rounded-lg p-2 text-xs">
      <p className="text-[#64748B] mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color ?? GOLD }}>{p.name}: <span className="font-bold">{typeof p.value === "number" ? p.value.toFixed(0) : p.value}</span></p>
      ))}
    </div>
  );
};

export default function Analytics() {
  const { user } = useAppContext();
  const [, setLocation] = useLocation();
  const userId = user?.id ?? "demo";

  const { data: analytics, isLoading } = useGetAdvancedAnalytics(userId, {
    query: { queryKey: ["analytics", userId], enabled: !!userId },
  });

  const totalTrades = analytics?.pairPerformance.reduce((s, p) => s + p.totalTrades, 0) ?? 0;
  const overallWinRate = analytics?.pairPerformance.reduce((s, p) => s + p.winRate * p.totalTrades, 0)
    ? Math.round((analytics?.pairPerformance.reduce((s, p) => s + p.winRate * p.totalTrades, 0) ?? 0) / (totalTrades || 1))
    : 0;
  const avgScore = analytics?.scoreTrend.length
    ? Math.round(analytics.scoreTrend.reduce((s, d) => s + d.avgScore, 0) / analytics.scoreTrend.length)
    : 0;
  const bestPair = analytics?.pairPerformance[0];

  const handleExport = () => {
    window.open(`/api/analytics/${userId}/export`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#F0B429] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!analytics || totalTrades === 0) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-64 gap-4">
        <TrendingUp className="w-12 h-12 text-[#1E2736]" />
        <p className="text-[#64748B] text-center text-sm">No trade data yet. Submit your first analysis to unlock advanced analytics.</p>
        <button onClick={() => setLocation("/analyze")}
          className="flex items-center gap-2 px-4 py-2 bg-[#F0B429] text-[#080B14] rounded-lg font-semibold text-sm">
          Start Analyzing <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-5 space-y-5 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#F1F5F9]">Advanced Analytics</h1>
          <p className="text-[11px] text-[#64748B]">{totalTrades} trades analyzed</p>
        </div>
        <button onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1E2736] border border-[#2D3748] rounded-lg text-xs text-[#F1F5F9] hover:bg-[#2D3748] transition-colors">
          <Download className="w-3 h-3" />
          CSV Export
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard icon={TrendingUp} label="Win Rate" value={`${overallWinRate}%`} color={GREEN} />
        <StatCard icon={Target} label="Avg Score" value={String(avgScore)} color={GOLD} />
        <StatCard icon={Award} label="Best Pair" value={bestPair?.pair ?? "—"} color={BLUE} />
        <StatCard icon={Clock} label="Total Trades" value={String(totalTrades)} color={PURPLE} />
      </div>

      {/* Score trend */}
      {analytics.scoreTrend.length > 1 && (
        <div className="bg-[#0D1117] border border-[#1E2736] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-[#F1F5F9] mb-3">Score Trend</h3>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={analytics.scoreTrend} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={GOLD} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2736" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#64748B" }} tickFormatter={(v) => v.slice(5)} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#64748B" }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="avgScore" name="Avg Score" stroke={GOLD} strokeWidth={2} fill="url(#scoreGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Pair performance */}
      {analytics.pairPerformance.length > 0 && (
        <div className="bg-[#0D1117] border border-[#1E2736] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-[#F1F5F9] mb-3">Pair Performance</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={analytics.pairPerformance.slice(0, 8)} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2736" />
              <XAxis dataKey="pair" tick={{ fontSize: 8, fill: "#64748B" }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#64748B" }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="avgScore" name="Avg Score" radius={[4, 4, 0, 0]}>
                {analytics.pairPerformance.slice(0, 8).map((_, i) => (
                  <Cell key={i} fill={PAIR_COLORS[i % PAIR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Pair heatmap */}
      {analytics.pairPerformance.length > 0 && (
        <div className="bg-[#0D1117] border border-[#1E2736] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-[#F1F5F9] mb-3">Pair Heatmap</h3>
          <div className="grid grid-cols-2 gap-2">
            {analytics.pairPerformance.slice(0, 8).map((p, i) => {
              const pct = p.avgScore / 100;
              const bg = p.avgScore >= 80 ? "#10B98133" : p.avgScore >= 60 ? "#F0B42933" : p.avgScore >= 40 ? "#F59E0B33" : "#EF444433";
              const col = p.avgScore >= 80 ? GREEN : p.avgScore >= 60 ? GOLD : p.avgScore >= 40 ? "#F59E0B" : RED;
              return (
                <div key={p.pair} className="rounded-lg p-3 flex justify-between items-center" style={{ background: bg }}>
                  <div>
                    <p className="text-xs font-bold text-[#F1F5F9]">{p.pair}</p>
                    <p className="text-[9px] text-[#64748B]">{p.totalTrades} trades · {p.winRate}% win</p>
                  </div>
                  <span className="text-lg font-black" style={{ color: col }}>{p.avgScore}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Session breakdown */}
      {analytics.sessionBreakdown.length > 0 && (
        <div className="bg-[#0D1117] border border-[#1E2736] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-[#F1F5F9] mb-3">Session Breakdown</h3>
          <div className="space-y-2">
            {analytics.sessionBreakdown.map((s) => (
              <div key={s.session} className="flex items-center gap-3">
                <span className="text-[11px] text-[#64748B] w-28 shrink-0">{s.session}</span>
                <div className="flex-1 bg-[#1E2736] rounded-full h-2">
                  <div className="h-2 rounded-full transition-all" style={{ width: `${s.avgScore}%`, background: BLUE }} />
                </div>
                <span className="text-[11px] font-bold text-[#F1F5F9] w-8 text-right">{s.avgScore}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Direction breakdown */}
      {analytics.directionBreakdown.length > 0 && (
        <div className="bg-[#0D1117] border border-[#1E2736] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-[#F1F5F9] mb-3">Long vs Short</h3>
          <div className="flex gap-3">
            {analytics.directionBreakdown.map((d) => {
              const col = d.direction === "long" ? GREEN : d.direction === "short" ? RED : GOLD;
              return (
                <div key={d.direction} className="flex-1 rounded-xl p-3 text-center" style={{ background: `${col}22` }}>
                  <p className="text-lg font-black" style={{ color: col }}>{d.avgScore}</p>
                  <p className="text-[10px] text-[#F1F5F9] capitalize font-semibold">{d.direction}</p>
                  <p className="text-[9px] text-[#64748B]">{d.count} trades</p>
                  <p className="text-[9px] text-[#64748B]">{d.winRate}% win</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Emotion impact */}
      {analytics.emotionImpact.length > 0 && (
        <div className="bg-[#0D1117] border border-[#1E2736] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-[#F1F5F9] mb-3">Emotion Impact on Score</h3>
          <div className="space-y-2">
            {analytics.emotionImpact.map((e: any) => (
              <div key={e.label} className="flex items-center gap-3">
                <span className="text-[10px] text-[#64748B] w-36 shrink-0">{e.label}</span>
                <div className="flex-1 bg-[#1E2736] rounded-full h-2">
                  <div className="h-2 rounded-full" style={{ width: `${e.avgScore}%`, background: PURPLE }} />
                </div>
                <span className="text-[11px] font-bold text-[#F1F5F9] w-8 text-right">{e.avgScore}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top mistakes */}
      {analytics.topMistakes.length > 0 && (
        <div className="bg-[#0D1117] border border-[#1E2736] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-[#F1F5F9] mb-3">⚠️ Top Weak Areas</h3>
          <div className="space-y-2">
            {analytics.topMistakes.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#EF444422] flex items-center justify-center text-[9px] font-bold text-[#EF4444]">{i + 1}</span>
                <span className="text-xs text-[#F1F5F9] capitalize">{m}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
