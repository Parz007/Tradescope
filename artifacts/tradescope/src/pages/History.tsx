import { useState } from "react";
import { useAppContext } from "@/lib/AppContext";
import {
  useListAnalyses,
  useUpdateOutcome,
  useGetAnalysis,
  getListAnalysesQueryKey,
  getGetAnalysisQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, CheckCircle, XCircle, Ban, Clock, AlertTriangle, TrendingUp } from "lucide-react";
import type { Confluence } from "@workspace/api-client-react";

const PAIRS = [
  "All", "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "AUD/USD",
  "NZD/USD", "USD/CAD", "EUR/GBP", "EUR/JPY", "GBP/JPY",
  "XAU/USD", "XAG/USD", "US30", "NAS100", "SPX500",
];

const OUTCOMES = ["All", "pending", "won", "lost", "cancelled"];

function getScoreColor(score: number) {
  if (score >= 86) return { text: "#F0B429", bg: "#F0B42920", border: "#F0B42940" };
  if (score >= 66) return { text: "#3B82F6", bg: "#3B82F620", border: "#3B82F640" };
  if (score >= 41) return { text: "#F59E0B", bg: "#F59E0B20", border: "#F59E0B40" };
  return { text: "#EF4444", bg: "#EF444420", border: "#EF444440" };
}

function getScoreLabel(score: number) {
  if (score >= 86) return "Elite Setup";
  if (score >= 76) return "Strong Setup";
  if (score >= 66) return "Good Setup";
  if (score >= 56) return "Average Setup";
  if (score >= 41) return "Weak Setup";
  return "Poor Setup";
}

function ConfluenceBar({ label, score }: { label: string; score: number }) {
  const color = score >= 70 ? "#10B981" : score >= 40 ? "#F59E0B" : "#EF4444";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-[#94A3B8]">{label}</span>
        <span style={{ color }} className="font-medium">{score}</span>
      </div>
      <div className="h-1.5 bg-[#1E2736] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function ExpandedAnalysis({ analysisId }: { analysisId: string }) {
  const { data: full, isLoading } = useGetAnalysis(analysisId, {
    query: { queryKey: getGetAnalysisQueryKey(analysisId) },
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2 py-2">
        {[1, 2, 3].map((i) => <div key={i} className="h-3 bg-[#1E2736] rounded" />)}
      </div>
    );
  }

  if (!full) return null;

  const confluence = full.confluenceData as Confluence;

  const confluenceItems = confluence ? [
    { label: "Trend Alignment", score: confluence.trendAlignment ?? 0 },
    { label: "Entry Timing", score: confluence.entryTiming ?? 0 },
    { label: "Risk Management", score: confluence.riskManagement ?? 0 },
    { label: "News Safety", score: confluence.newsSafety ?? 0 },
    { label: "Session Quality", score: confluence.sessionQuality ?? 0 },
    { label: "Reasoning Quality", score: confluence.reasoningQuality ?? 0 },
  ] : [];

  return (
    <div className="space-y-4">
      {/* Confluence Breakdown */}
      {confluenceItems.length > 0 && (
        <div>
          <p className="text-[#64748B] text-xs uppercase tracking-wider mb-2">Confluence Breakdown</p>
          <div className="space-y-2">
            {confluenceItems.map((c) => (
              <ConfluenceBar key={c.label} label={c.label} score={c.score} />
            ))}
          </div>
        </div>
      )}

      {/* Verdict */}
      {full.verdict && (
        <div className="border-l-2 border-[#3B82F6] pl-3">
          <p className="text-[#64748B] text-xs uppercase tracking-wider mb-1">Verdict</p>
          <p className="text-[#F1F5F9] text-sm leading-relaxed">{full.verdict}</p>
        </div>
      )}

      {/* Positives */}
      {full.positives?.length > 0 && (
        <div>
          <p className="text-[#10B981] text-xs uppercase tracking-wider font-semibold mb-2">Strengths</p>
          {full.positives.map((p, i) => (
            <div key={i} className="flex items-start gap-2 mb-1">
              <span className="text-[#10B981] text-xs mt-0.5">✓</span>
              <p className="text-[#F1F5F9] text-sm">{p}</p>
            </div>
          ))}
        </div>
      )}

      {/* Negatives / Warnings */}
      {full.negatives?.length > 0 && (
        <div>
          <p className="text-[#EF4444] text-xs uppercase tracking-wider font-semibold mb-2">Weaknesses</p>
          {full.negatives.map((n, i) => (
            <div key={i} className="flex items-start gap-2 mb-1">
              <span className="text-[#EF4444] text-xs mt-0.5">✗</span>
              <p className="text-[#F1F5F9] text-sm">{n}</p>
            </div>
          ))}
        </div>
      )}

      {/* Devil's Advocate */}
      {full.devilsAdvocate?.length > 0 && (
        <div className="rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/20 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B]" />
            <p className="text-[#F59E0B] text-xs font-semibold uppercase tracking-wider">Devil's Advocate</p>
          </div>
          {full.devilsAdvocate.map((d, i) => (
            <p key={i} className="text-[#F1F5F9] text-sm mb-1 last:mb-0">{d}</p>
          ))}
        </div>
      )}

      {/* Recommendations */}
      {full.recommendations?.length > 0 && (
        <div className="rounded-lg bg-[#3B82F6]/10 border border-[#3B82F6]/20 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-[#3B82F6]" />
            <p className="text-[#3B82F6] text-xs font-semibold uppercase tracking-wider">Recommendations</p>
          </div>
          {full.recommendations.map((r, i) => (
            <div key={i} className="flex items-start gap-2 mb-1 last:mb-0">
              <span className="text-[#3B82F6] text-xs mt-0.5">→</span>
              <p className="text-[#F1F5F9] text-sm">{r}</p>
            </div>
          ))}
        </div>
      )}

      {/* Wait For */}
      {full.waitFor && (
        <div className="rounded-lg bg-[#6366F1]/10 border border-[#6366F1]/20 p-3">
          <p className="text-[#6366F1] text-xs font-semibold mb-1">Wait For</p>
          <p className="text-[#F1F5F9] text-sm">{full.waitFor}</p>
        </div>
      )}

      {/* Trade Details */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        {[
          { label: "Entry", value: full.entryPrice?.toFixed(5) },
          { label: "Stop Loss", value: full.stopLoss?.toFixed(5) },
          { label: "Take Profit", value: full.takeProfit?.toFixed(5) },
          { label: "R:R", value: full.rrRatio ? `1:${full.rrRatio.toFixed(1)}` : "-" },
          { label: "Risk", value: full.riskPercent ? `${full.riskPercent}%` : "-" },
          { label: "Lot Size", value: full.lotSize?.toString() },
        ].map((item) => (
          <div key={item.label} className="bg-[#161B27] rounded-lg p-2 text-center">
            <p className="text-[#64748B] text-[10px]">{item.label}</p>
            <p className="text-[#F1F5F9] text-xs font-semibold mt-0.5 truncate">{item.value ?? "-"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function History() {
  const { user } = useAppContext();
  const queryClient = useQueryClient();
  const [pairFilter, setPairFilter] = useState("All");
  const [outcomeFilter, setOutcomeFilter] = useState("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const userId = user?.id ?? "";
  const { data: historyPage, isLoading } = useListAnalyses(userId, {
    query: { enabled: !!userId, queryKey: getListAnalysesQueryKey(userId) },
  });

  const updateOutcome = useUpdateOutcome();

  const analyses = historyPage?.analyses ?? [];
  const filtered = analyses.filter((a) => {
    const pairMatch = pairFilter === "All" || a.pair === pairFilter;
    const outcomeMatch = outcomeFilter === "All" || a.outcome === outcomeFilter;
    return pairMatch && outcomeMatch;
  });

  const wonCount = analyses.filter((a) => a.outcome === "won").length;
  const lostCount = analyses.filter((a) => a.outcome === "lost").length;
  const winRate = wonCount + lostCount > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 100) : 0;
  const avgScore = analyses.length > 0 ? Math.round(analyses.reduce((s, a) => s + a.overallScore, 0) / analyses.length) : 0;

  function handleOutcome(analysisId: string, outcome: "won" | "lost" | "cancelled" | "pending") {
    updateOutcome.mutate(
      { analysisId, data: { outcome } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey(userId) });
        },
      }
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 pt-6">
      <h1 className="font-display text-2xl font-bold text-[#F1F5F9]">Trade History</h1>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Total", value: analyses.length, color: "#F1F5F9" },
          { label: "Avg Score", value: avgScore || "-", color: "#3B82F6" },
          { label: "Won", value: wonCount, color: "#10B981" },
          { label: "Win Rate", value: winRate + "%", color: "#F0B429" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-2 text-center">
            <p className="font-bold text-base" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[#64748B] text-[10px] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <select
          value={pairFilter}
          onChange={(e) => setPairFilter(e.target.value)}
          className="flex-1 bg-[#0D1117] border border-[#1E2736] text-[#F1F5F9] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#F0B429]"
        >
          {PAIRS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          value={outcomeFilter}
          onChange={(e) => setOutcomeFilter(e.target.value)}
          className="flex-1 bg-[#0D1117] border border-[#1E2736] text-[#F1F5F9] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#F0B429] capitalize"
        >
          {OUTCOMES.map((o) => <option key={o} value={o}>{o === "All" ? "All Outcomes" : o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
        </select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-4 animate-pulse">
              <div className="h-4 bg-[#1E2736] rounded w-1/2 mb-2" />
              <div className="h-3 bg-[#1E2736] rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-[#1E2736] flex items-center justify-center mb-4">
            <Clock className="w-8 h-8 text-[#64748B]" />
          </div>
          <p className="text-[#F1F5F9] font-semibold">No analyses yet</p>
          <p className="text-[#64748B] text-sm mt-1">Start your first trade analysis to see it here</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((a) => {
            const colors = getScoreColor(a.overallScore);
            const isExpanded = expandedId === a.id;
            return (
              <div
                key={a.id}
                className="rounded-xl bg-[#0D1117] border border-[#1E2736] overflow-hidden"
              >
                <div
                  className="p-4 cursor-pointer active:bg-[#161B27] transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : a.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                        style={{ backgroundColor: colors.bg, color: colors.text, border: `2px solid ${colors.border}` }}
                      >
                        {a.overallScore}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#F1F5F9]">{a.pair}</span>
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${a.direction === "buy" ? "bg-[#10B981]/20 text-[#10B981]" : "bg-[#EF4444]/20 text-[#EF4444]"}`}>
                            {a.direction.toUpperCase()}
                          </span>
                          <span className="text-[#64748B] text-xs">{a.timeframe}</span>
                        </div>
                        <p className="text-[#64748B] text-xs mt-0.5">
                          {getScoreLabel(a.overallScore)} · {new Date(a.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {a.outcome && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          a.outcome === "won" ? "bg-[#10B981]/20 text-[#10B981]" :
                          a.outcome === "lost" ? "bg-[#EF4444]/20 text-[#EF4444]" :
                          a.outcome === "cancelled" ? "bg-[#64748B]/20 text-[#64748B]" :
                          "bg-[#F59E0B]/20 text-[#F59E0B]"
                        }`}>
                          {a.outcome}
                        </span>
                      )}
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-[#64748B]" /> : <ChevronDown className="w-4 h-4 text-[#64748B]" />}
                    </div>
                  </div>
                  {a.verdict && !isExpanded && (
                    <p className="text-[#64748B] text-sm mt-2 line-clamp-2">{a.verdict.split(".")[0]}.</p>
                  )}
                </div>

                {isExpanded && (
                  <div className="border-t border-[#1E2736] p-4 space-y-4">
                    {/* Full analysis data */}
                    <ExpandedAnalysis analysisId={a.id} />

                    {/* Outcome buttons */}
                    <div>
                      <p className="text-[#64748B] text-xs uppercase tracking-wider mb-2">Log Outcome</p>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => handleOutcome(a.id, "won")}
                          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm font-medium active:scale-95 transition-all ${
                            a.outcome === "won"
                              ? "bg-[#10B981]/30 border-[#10B981] text-[#10B981]"
                              : "bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981]"
                          }`}
                        >
                          <CheckCircle className="w-4 h-4" /> Won
                        </button>
                        <button
                          onClick={() => handleOutcome(a.id, "lost")}
                          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm font-medium active:scale-95 transition-all ${
                            a.outcome === "lost"
                              ? "bg-[#EF4444]/30 border-[#EF4444] text-[#EF4444]"
                              : "bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]"
                          }`}
                        >
                          <XCircle className="w-4 h-4" /> Lost
                        </button>
                        <button
                          onClick={() => handleOutcome(a.id, "cancelled")}
                          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm font-medium active:scale-95 transition-all ${
                            a.outcome === "cancelled"
                              ? "bg-[#64748B]/30 border-[#64748B] text-[#64748B]"
                              : "bg-[#64748B]/10 border-[#64748B]/30 text-[#64748B]"
                          }`}
                        >
                          <Ban className="w-4 h-4" /> Skip
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
