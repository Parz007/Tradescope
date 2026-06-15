import { useState } from "react";
import { useAppContext } from "@/lib/AppContext";
import {
  useGetChallenges,
  useCreateChallenge,
  useLogChallengeTrade,
  useSimulateChallengeLoss,
  useDeleteChallenge,
  getGetChallengesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trophy, TrendingUp, TrendingDown, Trash2, X, Target, ExternalLink } from "lucide-react";
import type { PropChallenge } from "@workspace/api-client-react";

const FIRMS = ["FTMO", "MyFundedFX", "The5ers", "Funded Next", "True Forex Funds", "Alpha Capital", "Custom"];
const PHASES = ["Challenge Phase 1", "Challenge Phase 2", "Funded Account"];

const PROP_FIRM_DEALS = [
  {
    name: "FTMO",
    flag: "🇨🇿",
    desc: "Most recognized prop firm globally",
    discount: "10% OFF",
    url: "https://ftmo.com/?affiliates=tradescope",
    color: "#F0B429",
  },
  {
    name: "MyFundedFX",
    flag: "🇺🇸",
    desc: "No time limits, fast payouts",
    discount: "15% OFF",
    url: "https://myfundedfx.tech/?ref=tradescope",
    color: "#3B82F6",
  },
  {
    name: "The5ers",
    flag: "🇮🇱",
    desc: "Instant funding available",
    discount: "10% OFF",
    url: "https://the5ers.com/?ref=tradescope",
    color: "#10B981",
  },
  {
    name: "Funded Next",
    flag: "🇦🇪",
    desc: "Up to 90% profit split",
    discount: "20% OFF",
    url: "https://fundednext.com/?ref=tradescope",
    color: "#6366F1",
  },
];

function DealsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-[#0D1117] border-t border-[#1E2736] rounded-t-2xl p-5 pb-8 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-[#F1F5F9]">Exclusive Prop Firm Deals</h2>
            <p className="text-[#64748B] text-sm mt-0.5">Special discounts for TradeScope members</p>
          </div>
          <button onClick={onClose} className="text-[#64748B] hover:text-[#F1F5F9] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          {PROP_FIRM_DEALS.map((firm) => (
            <button
              key={firm.name}
              onClick={() => {
                const tg = (window as any).Telegram?.WebApp;
                if (tg) {
                  tg.openLink(firm.url);
                } else {
                  window.open(firm.url, "_blank");
                }
              }}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-[#161B27] border border-[#1E2736] active:scale-95 transition-transform"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{firm.flag}</span>
                <div className="text-left">
                  <p className="font-semibold text-[#F1F5F9]">{firm.name}</p>
                  <p className="text-[#64748B] text-xs">{firm.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ backgroundColor: firm.color + "20", color: firm.color }}>
                  {firm.discount}
                </span>
                <ExternalLink className="w-3.5 h-3.5 text-[#64748B]" />
              </div>
            </button>
          ))}
        </div>
        <p className="text-[#64748B] text-xs text-center">Affiliate links — we may earn a commission at no extra cost to you.</p>
      </div>
    </div>
  );
}

function MeterBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = pct < 50 ? "#10B981" : pct < 75 ? "#F59E0B" : "#EF4444";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-[#64748B]">{label}</span>
        <span style={{ color }}>{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-[#1E2736] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case "active": return { text: "#10B981", bg: "#10B98120" };
    case "at_risk": return { text: "#F59E0B", bg: "#F59E0B20" };
    case "danger": return { text: "#EF4444", bg: "#EF444420" };
    case "passed": return { text: "#F0B429", bg: "#F0B42920" };
    case "failed": return { text: "#EF4444", bg: "#EF444420" };
    default: return { text: "#64748B", bg: "#64748B20" };
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "active": return "On Track";
    case "at_risk": return "At Risk";
    case "danger": return "Danger Zone";
    case "passed": return "Passed!";
    case "failed": return "Failed";
    default: return status;
  }
}

function ChallengeCard({ challenge, userId }: { challenge: PropChallenge; userId: string }) {
  const queryClient = useQueryClient();
  const logTrade = useLogChallengeTrade();
  const simulate = useSimulateChallengeLoss();
  const deleteChallenge = useDeleteChallenge();
  const [pnlInput, setPnlInput] = useState("");
  const [simInput, setSimInput] = useState("");
  const [simResult, setSimResult] = useState<any>(null);
  const [showLog, setShowLog] = useState(false);
  const [showSim, setShowSim] = useState(false);

  const statusColors = getStatusColor(challenge.status);
  const profitPct = (challenge.currentProfit / challenge.accountSize) * 100;
  const targetPct = challenge.profitTarget;

  function handleLog() {
    const pnl = parseFloat(pnlInput);
    if (isNaN(pnl)) return;
    logTrade.mutate(
      { id: challenge.id, data: { pnl } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetChallengesQueryKey(userId) });
          setPnlInput("");
          setShowLog(false);
        },
      }
    );
  }

  function handleSimulate() {
    const loss = parseFloat(simInput);
    if (isNaN(loss)) return;
    simulate.mutate(
      { id: challenge.id, data: { lossAmount: Math.abs(loss) } },
      { onSuccess: (result) => setSimResult(result) }
    );
  }

  function handleDelete() {
    if (!confirm("Delete this challenge?")) return;
    deleteChallenge.mutate({ id: challenge.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetChallengesQueryKey(userId) });
      }
    });
  }

  return (
    <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#F0B429]" />
            <span className="font-display font-bold text-[#F1F5F9]">{challenge.firmName}</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: statusColors.bg, color: statusColors.text }}>
              {getStatusLabel(challenge.status)}
            </span>
          </div>
          <p className="text-[#64748B] text-sm mt-0.5">{challenge.phase} · ${challenge.accountSize.toLocaleString()}</p>
        </div>
        <button onClick={handleDelete} className="text-[#64748B] hover:text-[#EF4444] transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Metrics */}
      <div className="px-4 pb-4 space-y-3">
        {/* Profit progress */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-[#64748B]">Profit Progress</span>
            <span className="text-[#10B981] font-semibold">
              ${challenge.currentProfit.toFixed(2)} / ${(challenge.accountSize * targetPct / 100).toFixed(2)}
            </span>
          </div>
          <div className="h-2 bg-[#1E2736] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-[#10B981] to-[#F0B429]"
              style={{ width: `${Math.min((profitPct / targetPct) * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-[#64748B]">{profitPct.toFixed(2)}% profit</span>
            <span className="text-[#64748B]">Target: {targetPct}%</span>
          </div>
        </div>

        <MeterBar value={challenge.currentDrawdown} max={(challenge.accountSize * challenge.maxDrawdown) / 100} label="Max Drawdown Used" />
        <MeterBar value={challenge.todayLoss} max={(challenge.accountSize * challenge.maxDailyLoss) / 100} label="Daily Loss Used" />

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="bg-[#161B27] rounded-lg p-2.5 text-center">
            <p className="text-[#F0B429] font-bold">{challenge.passingProbability?.toFixed(0) ?? "-"}%</p>
            <p className="text-[#64748B] text-xs">Pass Probability</p>
          </div>
          <div className="bg-[#161B27] rounded-lg p-2.5 text-center">
            <p className="text-[#3B82F6] font-bold">{challenge.daysRemaining ?? "∞"}</p>
            <p className="text-[#64748B] text-xs">Days Remaining</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => { setShowLog(!showLog); setShowSim(false); }}
            className="py-2.5 rounded-lg bg-[#3B82F6]/10 border border-[#3B82F6]/30 text-[#3B82F6] text-sm font-medium active:scale-95 transition-transform flex items-center justify-center gap-1.5"
          >
            <TrendingUp className="w-4 h-4" /> Log Trade
          </button>
          <button
            onClick={() => { setShowSim(!showSim); setShowLog(false); setSimResult(null); }}
            className="py-2.5 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B] text-sm font-medium active:scale-95 transition-transform flex items-center justify-center gap-1.5"
          >
            <Target className="w-4 h-4" /> Simulate
          </button>
        </div>

        {/* Log trade form */}
        {showLog && (
          <div className="bg-[#161B27] rounded-lg p-3 space-y-2">
            <p className="text-[#F1F5F9] text-sm font-medium">Log P&L (positive = profit, negative = loss)</p>
            <div className="flex gap-2">
              <input
                type="number"
                value={pnlInput}
                onChange={(e) => setPnlInput(e.target.value)}
                placeholder="e.g. -150 or 320"
                className="flex-1 bg-[#0D1117] border border-[#1E2736] text-[#F1F5F9] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#F0B429]"
              />
              <button
                onClick={handleLog}
                disabled={logTrade.isPending}
                className="px-4 py-2 bg-[#F0B429] text-[#080B14] rounded-lg text-sm font-bold active:scale-95 transition-transform"
              >
                {logTrade.isPending ? "..." : "Log"}
              </button>
            </div>
          </div>
        )}

        {/* Simulate form */}
        {showSim && (
          <div className="bg-[#161B27] rounded-lg p-3 space-y-2">
            <p className="text-[#F1F5F9] text-sm font-medium">Simulate hypothetical loss amount ($)</p>
            <div className="flex gap-2">
              <input
                type="number"
                value={simInput}
                onChange={(e) => setSimInput(e.target.value)}
                placeholder="e.g. 500"
                className="flex-1 bg-[#0D1117] border border-[#1E2736] text-[#F1F5F9] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#F0B429]"
              />
              <button
                onClick={handleSimulate}
                disabled={simulate.isPending}
                className="px-4 py-2 bg-[#F59E0B] text-[#080B14] rounded-lg text-sm font-bold active:scale-95 transition-transform"
              >
                {simulate.isPending ? "..." : "Run"}
              </button>
            </div>
            {simResult && (
              <div className={`rounded-lg p-3 border ${simResult.wouldBreachDrawdown || simResult.wouldBreachDailyLoss ? "border-[#EF4444]/40 bg-[#EF4444]/10" : "border-[#10B981]/40 bg-[#10B981]/10"}`}>
                <p className={`text-sm font-medium ${simResult.wouldBreachDrawdown || simResult.wouldBreachDailyLoss ? "text-[#EF4444]" : "text-[#10B981]"}`}>
                  {simResult.message}
                </p>
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                  <span className="text-[#64748B]">New Drawdown: <span className="text-[#F1F5F9]">{simResult.drawdownPercent?.toFixed(1)}%</span></span>
                  <span className="text-[#64748B]">Daily Loss: <span className="text-[#F1F5F9]">{simResult.dailyLossPercent?.toFixed(1)}%</span></span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PropFirm() {
  const { user } = useAppContext();
  const queryClient = useQueryClient();
  const userId = user?.id ?? "";
  const { data: challenges, isLoading } = useGetChallenges(userId, {
    query: { enabled: !!userId, queryKey: getGetChallengesQueryKey(userId) },
  });
  const createChallenge = useCreateChallenge();
  const [showForm, setShowForm] = useState(false);
  const [showDeals, setShowDeals] = useState(false);
  const [form, setForm] = useState({
    firmName: "FTMO",
    accountSize: "10000",
    maxDrawdown: "10",
    maxDailyLoss: "5",
    profitTarget: "10",
    startDate: new Date().toISOString().split("T")[0],
    phase: "Challenge Phase 1",
  });

  function handleCreate() {
    createChallenge.mutate(
      {
        data: {
          userId,
          firmName: form.firmName,
          accountSize: parseFloat(form.accountSize),
          maxDrawdown: parseFloat(form.maxDrawdown),
          maxDailyLoss: parseFloat(form.maxDailyLoss),
          profitTarget: parseFloat(form.profitTarget),
          startDate: form.startDate,
          phase: form.phase,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetChallengesQueryKey(userId) });
          setShowForm(false);
        },
      }
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 pt-6">
      {showDeals && <DealsModal onClose={() => setShowDeals(false)} />}

      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-[#F1F5F9]">Prop Firm Tracker</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#F0B429] text-[#080B14] rounded-[20px] text-sm font-bold active:scale-95 transition-transform"
        >
          <Plus className="w-4 h-4" />
          Add Challenge
        </button>
      </div>

      {/* Add Challenge Form */}
      {showForm && (
        <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-[#F1F5F9]">New Challenge</p>
            <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-[#64748B]" /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Firm", field: "firmName", type: "select", options: FIRMS },
              { label: "Phase", field: "phase", type: "select", options: PHASES },
            ].map(({ label, field, options }) => (
              <div key={field}>
                <p className="text-[#64748B] text-xs mb-1">{label}</p>
                <select
                  value={form[field as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  className="w-full bg-[#161B27] border border-[#1E2736] text-[#F1F5F9] rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-[#F0B429]"
                >
                  {options!.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
            {[
              { label: "Account Size ($)", field: "accountSize" },
              { label: "Max Drawdown (%)", field: "maxDrawdown" },
              { label: "Max Daily Loss (%)", field: "maxDailyLoss" },
              { label: "Profit Target (%)", field: "profitTarget" },
            ].map(({ label, field }) => (
              <div key={field}>
                <p className="text-[#64748B] text-xs mb-1">{label}</p>
                <input
                  type="number"
                  value={form[field as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  className="w-full bg-[#161B27] border border-[#1E2736] text-[#F1F5F9] rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-[#F0B429]"
                />
              </div>
            ))}
            <div className="col-span-2">
              <p className="text-[#64748B] text-xs mb-1">Start Date</p>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full bg-[#161B27] border border-[#1E2736] text-[#F1F5F9] rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-[#F0B429]"
              />
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={createChallenge.isPending}
            className="w-full py-3 bg-[#F0B429] text-[#080B14] rounded-[20px] font-bold active:scale-95 transition-transform"
          >
            {createChallenge.isPending ? "Creating..." : "Create Challenge"}
          </button>
        </div>
      )}

      {/* Challenges */}
      {isLoading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-48 bg-[#0D1117] rounded-xl" />)}
        </div>
      ) : !challenges || challenges.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-[#1E2736] flex items-center justify-center mb-4">
            <Trophy className="w-8 h-8 text-[#64748B]" />
          </div>
          <p className="text-[#F1F5F9] font-semibold">No active challenges</p>
          <p className="text-[#64748B] text-sm mt-1">Add your first prop firm challenge to start tracking</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {challenges.map((c) => (
            <ChallengeCard key={c.id} challenge={c} userId={userId} />
          ))}
        </div>
      )}

      {/* Affiliate */}
      <div className="rounded-xl bg-gradient-to-r from-[#F0B429]/10 to-transparent border border-[#F0B429]/20 p-4 text-center">
        <p className="text-[#F1F5F9] font-semibold text-sm">Need a funded account?</p>
        <p className="text-[#64748B] text-xs mt-1">Get exclusive discounts on top prop firms</p>
        <button
          onClick={() => setShowDeals(true)}
          className="mt-3 px-4 py-2 bg-[#F0B429]/20 border border-[#F0B429]/40 text-[#F0B429] rounded-lg text-sm font-medium active:scale-95 transition-transform"
        >
          View Deals
        </button>
      </div>

      <div className="pb-8" />
    </div>
  );
}
