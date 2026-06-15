import { useState } from "react";
import { useAppContext } from "@/lib/AppContext";
import {
  useGetPriceAlerts,
  useCreatePriceAlert,
  useDeletePriceAlert,
  getGetPriceAlertsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, Plus, Trash2, TrendingUp, TrendingDown, X } from "lucide-react";
import { toast } from "sonner";

const PAIRS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD", "USD/CHF", "NZD/USD",
  "EUR/GBP", "EUR/JPY", "GBP/JPY", "XAU/USD", "BTC/USD",
];

export default function PriceAlerts() {
  const { user } = useAppContext();
  const qc = useQueryClient();
  const userId = user?.id ?? "";

  const [showForm, setShowForm] = useState(false);
  const [pair, setPair] = useState("EUR/USD");
  const [targetPrice, setTargetPrice] = useState("");
  const [condition, setCondition] = useState<"above" | "below">("above");
  const [note, setNote] = useState("");

  const { data: alerts = [], isLoading } = useGetPriceAlerts(userId, {
    query: { queryKey: getGetPriceAlertsQueryKey(userId), enabled: !!userId },
  });

  const createMutation = useCreatePriceAlert({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetPriceAlertsQueryKey(userId) });
        setShowForm(false);
        setPair("EUR/USD");
        setTargetPrice("");
        setCondition("above");
        setNote("");
        toast.success("Alert created!");
      },
      onError: () => toast.error("Failed to create alert"),
    },
  });

  const deleteMutation = useDeletePriceAlert({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetPriceAlertsQueryKey(userId) });
        toast.success("Alert removed");
      },
    },
  });

  const handleCreate = () => {
    if (!targetPrice || isNaN(Number(targetPrice))) {
      toast.error("Enter a valid target price");
      return;
    }
    createMutation.mutate({
      data: {
        userId,
        pair,
        targetPrice: Number(targetPrice),
        direction: condition === "above" ? "bullish" : "bearish",
        condition,
        note: note || null,
      },
    });
  };

  const active = alerts.filter((a) => a.isActive);
  const triggered = alerts.filter((a) => !a.isActive);

  return (
    <div className="px-4 py-5 space-y-5 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#F1F5F9]">Price Alerts</h1>
          <p className="text-[11px] text-[#64748B]">{active.length} active alert{active.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F0B429] text-[#080B14] rounded-lg font-semibold text-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          New Alert
        </button>
      </div>

      {/* Create form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm px-4 pb-4">
          <div className="w-full max-w-[480px] bg-[#0D1117] border border-[#1E2736] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[#F1F5F9]">New Price Alert</h3>
              <button onClick={() => setShowForm(false)} className="text-[#64748B] hover:text-[#F1F5F9]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pair */}
            <div>
              <label className="text-[11px] text-[#64748B] uppercase tracking-wide mb-1 block">Currency Pair</label>
              <select
                value={pair}
                onChange={(e) => setPair(e.target.value)}
                className="w-full bg-[#080B14] border border-[#1E2736] rounded-lg px-3 py-2.5 text-sm text-[#F1F5F9]"
              >
                {PAIRS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* Condition */}
            <div>
              <label className="text-[11px] text-[#64748B] uppercase tracking-wide mb-1 block">Alert When Price Is</label>
              <div className="grid grid-cols-2 gap-2">
                {(["above", "below"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCondition(c)}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold border transition-all ${
                      condition === c
                        ? c === "above" ? "bg-[#10B98133] border-[#10B981] text-[#10B981]" : "bg-[#EF444433] border-[#EF4444] text-[#EF4444]"
                        : "bg-[#080B14] border-[#1E2736] text-[#64748B]"
                    }`}
                  >
                    {c === "above" ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {c === "above" ? "Above" : "Below"}
                  </button>
                ))}
              </div>
            </div>

            {/* Target price */}
            <div>
              <label className="text-[11px] text-[#64748B] uppercase tracking-wide mb-1 block">Target Price</label>
              <input
                type="number"
                step="0.00001"
                placeholder="e.g. 1.08500"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="w-full bg-[#080B14] border border-[#1E2736] rounded-lg px-3 py-2.5 text-sm text-[#F1F5F9] placeholder-[#64748B]"
              />
            </div>

            {/* Note */}
            <div>
              <label className="text-[11px] text-[#64748B] uppercase tracking-wide mb-1 block">Note (optional)</label>
              <input
                type="text"
                placeholder="e.g. Key resistance level..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-[#080B14] border border-[#1E2736] rounded-lg px-3 py-2.5 text-sm text-[#F1F5F9] placeholder-[#64748B]"
              />
            </div>

            <button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="w-full py-3 bg-[#F0B429] text-[#080B14] rounded-xl font-bold text-sm disabled:opacity-50"
            >
              {createMutation.isPending ? "Creating..." : "Set Alert"}
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-[#F0B429] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && alerts.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <Bell className="w-12 h-12 text-[#1E2736]" />
          <p className="text-[#64748B] text-sm text-center">No alerts set. Create one to track key price levels.</p>
        </div>
      )}

      {/* Active alerts */}
      {active.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">Active</h3>
          <div className="space-y-2">
            {active.map((alert) => (
              <div key={alert.id} className="bg-[#0D1117] border border-[#1E2736] rounded-xl p-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${alert.condition === "above" ? "bg-[#10B98122]" : "bg-[#EF444422]"}`}>
                    {alert.condition === "above"
                      ? <TrendingUp className="w-4 h-4 text-[#10B981]" />
                      : <TrendingDown className="w-4 h-4 text-[#EF4444]" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-[#F1F5F9]">{alert.pair}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${alert.condition === "above" ? "bg-[#10B98122] text-[#10B981]" : "bg-[#EF444422] text-[#EF4444]"}`}>
                        {alert.condition} {alert.targetPrice.toFixed(5)}
                      </span>
                    </div>
                    {alert.note && <p className="text-[10px] text-[#64748B] mt-0.5">{alert.note}</p>}
                    <p className="text-[9px] text-[#374151] mt-0.5">{new Date(alert.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <button
                  onClick={() => deleteMutation.mutate({ id: alert.id })}
                  className="text-[#374151] hover:text-[#EF4444] transition-colors p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Triggered alerts */}
      {triggered.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">Triggered</h3>
          <div className="space-y-2">
            {triggered.map((alert) => (
              <div key={alert.id} className="bg-[#0D1117] border border-[#1E2736] rounded-xl p-4 flex items-start justify-between opacity-50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#1E2736]">
                    <BellOff className="w-4 h-4 text-[#64748B]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-[#F1F5F9]">{alert.pair}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-[#1E2736] rounded text-[#64748B]">{alert.condition} {alert.targetPrice.toFixed(5)}</span>
                    </div>
                    {alert.triggeredAt && <p className="text-[9px] text-[#374151] mt-0.5">Triggered {new Date(alert.triggeredAt).toLocaleDateString()}</p>}
                  </div>
                </div>
                <button
                  onClick={() => deleteMutation.mutate({ id: alert.id })}
                  className="text-[#374151] hover:text-[#EF4444] transition-colors p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
