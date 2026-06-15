import { useState } from "react";
import { useAppContext } from "@/lib/AppContext";
import {
  useCalculateRisk,
  useGetRiskScenarios,
  useSaveRiskScenario,
  getGetRiskScenariosQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Calculator, Save, ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";

const PAIRS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD", "USD/CHF", "NZD/USD",
  "EUR/GBP", "EUR/JPY", "GBP/JPY", "XAU/USD", "BTC/USD", "US30", "NAS100",
];

function InputField({ label, value, onChange, placeholder, type = "number", step = "any" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; step?: string;
}) {
  return (
    <div>
      <label className="text-[11px] text-[#64748B] uppercase tracking-wide mb-1 block">{label}</label>
      <input
        type={type}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#080B14] border border-[#1E2736] rounded-lg px-3 py-2.5 text-sm text-[#F1F5F9] placeholder-[#64748B] focus:border-[#F0B429] outline-none"
      />
    </div>
  );
}

function ResultCard({ label, value, color = "#F0B429", sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div className="bg-[#080B14] rounded-xl p-3 text-center">
      <p className="text-[10px] text-[#64748B] uppercase tracking-wide">{label}</p>
      <p className="text-xl font-black mt-0.5" style={{ color }}>{value}</p>
      {sub && <p className="text-[9px] text-[#374151] mt-0.5">{sub}</p>}
    </div>
  );
}

export default function RiskCalculator() {
  const { user } = useAppContext();
  const qc = useQueryClient();
  const userId = user?.id ?? "";

  const [accountSize, setAccountSize] = useState(user?.accountSize?.toString() ?? "10000");
  const [riskPercent, setRiskPercent] = useState(user?.defaultRisk?.toString() ?? "1");
  const [pair, setPair] = useState("EUR/USD");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [leverage, setLeverage] = useState("100");
  const [scenarioName, setScenarioName] = useState("");
  const [showScenarios, setShowScenarios] = useState(false);

  const calcMutation = useCalculateRisk();
  const saveMutation = useSaveRiskScenario();
  const { data: scenarios = [] } = useGetRiskScenarios(userId, {
    query: { queryKey: getGetRiskScenariosQueryKey(userId), enabled: !!userId && showScenarios },
  });

  const result = calcMutation.data;

  const handleCalculate = () => {
    const fields = { accountSize, riskPercent, pair, entryPrice, stopLoss, takeProfit };
    for (const [k, v] of Object.entries(fields)) {
      if (!v || (k !== "pair" && isNaN(Number(v)))) {
        toast.error(`Please enter a valid ${k.replace(/([A-Z])/g, " $1").toLowerCase()}`);
        return;
      }
    }
    calcMutation.mutate({
      data: {
        accountSize: Number(accountSize),
        riskPercent: Number(riskPercent),
        pair,
        entryPrice: Number(entryPrice),
        stopLoss: Number(stopLoss),
        takeProfit: Number(takeProfit),
        leverage: leverage ? Number(leverage) : null,
      },
    });
  };

  const handleSave = () => {
    if (!result) return;
    if (!scenarioName) { toast.error("Enter a scenario name"); return; }
    saveMutation.mutate({
      userId,
      data: {
        name: scenarioName,
        accountSize: Number(accountSize),
        riskPercent: Number(riskPercent),
        pair,
        entryPrice: Number(entryPrice),
        stopLoss: Number(stopLoss),
        takeProfit: Number(takeProfit),
        lotSize: result.lotSize,
        pipValue: result.pipValue,
        riskDollars: result.riskDollars,
        rewardDollars: result.rewardDollars,
        rrRatio: result.rrRatio,
      },
    }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetRiskScenariosQueryKey(userId) });
        setScenarioName("");
        toast.success("Scenario saved!");
      },
      onError: () => toast.error("Failed to save scenario"),
    });
  };

  const loadScenario = (s: any) => {
    setAccountSize(String(s.accountSize));
    setRiskPercent(String(s.riskPercent));
    setPair(s.pair);
    setEntryPrice(String(s.entryPrice));
    setStopLoss(String(s.stopLoss));
    setTakeProfit(String(s.takeProfit));
    setShowScenarios(false);
    toast.info(`Loaded: ${s.name}`);
  };

  const isLong = entryPrice && stopLoss ? Number(entryPrice) > Number(stopLoss) : null;

  return (
    <div className="px-4 py-5 space-y-5 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#F1F5F9]">Risk Calculator</h1>
          <p className="text-[11px] text-[#64748B]">Advanced position sizing & risk analysis</p>
        </div>
        <button
          onClick={() => setShowScenarios(!showScenarios)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1E2736] border border-[#2D3748] rounded-lg text-xs text-[#F1F5F9] hover:bg-[#2D3748] transition-colors"
        >
          <Save className="w-3 h-3" />
          Saved
        </button>
      </div>

      {/* Saved scenarios */}
      {showScenarios && (
        <div className="bg-[#0D1117] border border-[#1E2736] rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-semibold text-[#F1F5F9]">Saved Scenarios</h3>
          {scenarios.length === 0
            ? <p className="text-[#64748B] text-xs">No saved scenarios yet</p>
            : scenarios.map((s) => (
              <button key={s.id} onClick={() => loadScenario(s)}
                className="w-full text-left flex items-center justify-between p-3 bg-[#080B14] rounded-lg hover:bg-[#1E2736] transition-colors">
                <div>
                  <p className="text-sm font-semibold text-[#F1F5F9]">{s.name}</p>
                  <p className="text-[10px] text-[#64748B]">{s.pair} · ${s.accountSize.toLocaleString()} · {s.riskPercent}% risk</p>
                </div>
                <span className="text-[11px] text-[#F0B429] font-bold">{s.rrRatio?.toFixed(2) ?? "—"}:1</span>
              </button>
            ))}
        </div>
      )}

      {/* Calculator inputs */}
      <div className="bg-[#0D1117] border border-[#1E2736] rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-semibold text-[#F1F5F9]">Position Parameters</h3>

        <div className="grid grid-cols-2 gap-3">
          <InputField label="Account Size ($)" value={accountSize} onChange={setAccountSize} placeholder="10000" />
          <InputField label="Risk (%)" value={riskPercent} onChange={setRiskPercent} placeholder="1" step="0.1" />
        </div>

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

        <div className="grid grid-cols-3 gap-2">
          <InputField label="Entry" value={entryPrice} onChange={setEntryPrice} placeholder="1.08500" step="0.00001" />
          <InputField label="Stop Loss" value={stopLoss} onChange={setStopLoss} placeholder="1.08000" step="0.00001" />
          <InputField label="Take Profit" value={takeProfit} onChange={setTakeProfit} placeholder="1.09500" step="0.00001" />
        </div>

        {isLong !== null && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${isLong ? "bg-[#10B98122] text-[#10B981]" : "bg-[#EF444422] text-[#EF4444]"}`}>
            {isLong ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {isLong ? "Long trade detected" : "Short trade detected"}
          </div>
        )}

        <InputField label="Leverage (optional)" value={leverage} onChange={setLeverage} placeholder="100" />

        <button
          onClick={handleCalculate}
          disabled={calcMutation.isPending}
          className="w-full py-3 bg-[#F0B429] text-[#080B14] rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Calculator className="w-4 h-4" />
          {calcMutation.isPending ? "Calculating..." : "Calculate"}
        </button>
      </div>

      {/* Results */}
      {result && (
        <>
          <div className="bg-[#0D1117] border border-[#1E2736] rounded-xl p-4 space-y-4">
            <h3 className="text-sm font-semibold text-[#F1F5F9]">Position Summary</h3>
            <div className="grid grid-cols-3 gap-2">
              <ResultCard label="Lot Size" value={result.lotSize.toFixed(2)} color="#F0B429" />
              <ResultCard label="R:R Ratio" value={`${result.rrRatio.toFixed(2)}:1`}
                color={result.rrRatio >= 2 ? "#10B981" : result.rrRatio >= 1 ? "#F0B429" : "#EF4444"} />
              <ResultCard label="Risk $" value={`$${result.riskDollars.toFixed(0)}`} color="#EF4444" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <ResultCard label="Reward $" value={`$${result.rewardDollars.toFixed(0)}`} color="#10B981" />
              <ResultCard label="Stop Pips" value={`${result.stopPips}`} color="#64748B" />
              <ResultCard label="TP Pips" value={`${result.takeProfitPips}`} color="#64748B" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ResultCard label="Pip Value" value={`$${result.pipValue.toFixed(2)}`} sub="per pip" color="#3B82F6" />
              {result.marginRequired && (
                <ResultCard label="Margin Required" value={`$${result.marginRequired.toFixed(0)}`} color="#8B5CF6" />
              )}
            </div>
          </div>

          {/* Max loss scenarios */}
          <div className="bg-[#0D1117] border border-[#1E2736] rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-[#F1F5F9] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#F59E0B]" /> Max Loss Scenarios
            </h3>
            {result.maxLossScenarios.map((s: any) => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="text-xs text-[#64748B]">{s.label}</span>
                <div className="text-right">
                  <span className={`text-xs font-bold ${s.remainingBalance < 0 ? "text-[#EF4444]" : "text-[#F1F5F9]"}`}>
                    ${Math.max(0, s.remainingBalance).toLocaleString()}
                  </span>
                  <span className="text-[10px] text-[#EF4444] ml-2">{s.percent.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>

          {/* Save scenario */}
          <div className="bg-[#0D1117] border border-[#1E2736] rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-[#F1F5F9]">Save Scenario</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                placeholder="Scenario name..."
                className="flex-1 bg-[#080B14] border border-[#1E2736] rounded-lg px-3 py-2 text-sm text-[#F1F5F9] placeholder-[#64748B] outline-none focus:border-[#F0B429]"
              />
              <button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#3B82F6] text-white rounded-lg font-semibold text-sm disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saveMutation.isPending ? "..." : "Save"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
