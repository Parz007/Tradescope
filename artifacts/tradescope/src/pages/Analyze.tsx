import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useAppContext } from "@/lib/AppContext";
import { useAnalyzeTrade, useGetNews, getGetNewsQueryKey, TradeInputTimeframe } from "@workspace/api-client-react";
import { ChevronLeft, CheckCircle, AlertTriangle, ImageIcon, X, Camera } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Analysis } from "@workspace/api-client-react";
import { useTelegramBackButton } from "@/hooks/useTelegramBackButton";

const PAIRS = [
  "EUR/USD","GBP/USD","USD/JPY","USD/CHF","AUD/USD","NZD/USD","USD/CAD",
  "EUR/GBP","EUR/JPY","GBP/JPY","XAU/USD","XAG/USD","US30","NAS100",
  "SPX500","BTC/USD","OIL/USD","EUR/CHF","GBP/CHF","CAD/JPY",
];
const TIMEFRAMES = ["M5","M15","M30","H1","H4","D1","W1"];
const HTF_BIAS = ["Bullish","Bearish","Ranging","Not Checked"];

const FORM_LOADING_STEPS = [
  "Calculating risk metrics...",
  "Checking economic calendar...",
  "Detecting trading session...",
  "Analyzing reasoning quality...",
  "Checking confluence factors...",
  "Generating score...",
];

const CHART_LOADING_STEPS = [
  "Reading chart structure...",
  "Identifying key levels...",
  "Detecting patterns...",
  "Checking economic calendar...",
  "Evaluating trade quality...",
  "Generating AI analysis...",
];

function ScoreRing({ score, color }: { score: number; color: string }) {
  const [displayed, setDisplayed] = useState(0);
  const [ringValue, setRingValue] = useState(0);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    let current = 0;
    const step = score / 60;
    const id = setInterval(() => {
      current = Math.min(current + step, score);
      setDisplayed(Math.round(current));
      setRingValue(current);
      if (current >= score) clearInterval(id);
    }, 25);
    return () => clearInterval(id);
  }, [score]);

  const dashoffset = circumference - (ringValue / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center w-40 h-40">
      <svg className="absolute" width="160" height="160" viewBox="0 0 160 160" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="80" cy="80" r={radius} fill="none" stroke="#1E2736" strokeWidth="10" />
        <circle
          cx="80" cy="80" r={radius} fill="none"
          stroke={color} strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          style={{ transition: "stroke-dashoffset 0.05s linear" }}
        />
      </svg>
      <div className="text-center z-10">
        <p className="font-display font-bold text-4xl" style={{ color }}>{displayed}</p>
        <p className="text-[#64748B] text-xs">/ 100</p>
      </div>
    </div>
  );
}

function ConfluenceBar({ label, value, delay }: { label: string; value: number; delay: number }) {
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFilled(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  const color = value >= 7 ? "#10B981" : value >= 5 ? "#F59E0B" : "#EF4444";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-[#F1F5F9]">{label}</span>
        <span className="font-semibold" style={{ color }}>{value}/10</span>
      </div>
      <div className="h-2 bg-[#1E2736] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: filled ? `${(value / 10) * 100}%` : "0%", backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function getScoreColor(score: number) {
  if (score >= 86) return "#F0B429";
  if (score >= 66) return "#3B82F6";
  if (score >= 41) return "#F59E0B";
  return "#EF4444";
}

function ResultsScreen({
  result,
  onReset,
  chartImageUrl,
}: {
  result: Analysis;
  onReset: () => void;
  chartImageUrl?: string | null;
}) {
  const [, setLocation] = useLocation();
  const color = getScoreColor(result.overallScore);
  const confluence = result.confluenceData as unknown as Record<string, number>;
  const confluenceLabels: Record<string, string> = {
    trendAlignment: "Trend Alignment",
    entryTiming: "Entry Timing",
    riskManagement: "Risk Management",
    newsSafety: "News Safety",
    sessionQuality: "Session Quality",
    reasoningQuality: "Reasoning Quality",
    chartStructure: "Chart Structure",
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 p-4">
      {chartImageUrl && (
        <div className="rounded-xl overflow-hidden border border-[#1E2736]">
          <p className="text-[#64748B] text-xs px-3 pt-2 pb-1 uppercase tracking-wider font-medium">Submitted Chart</p>
          <img
            src={chartImageUrl}
            alt="Submitted chart"
            className="w-full max-h-48 object-contain bg-[#0D1117]"
          />
        </div>
      )}

      <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-6 flex flex-col items-center gap-3">
        <ScoreRing score={result.overallScore} color={color} />
        <p className="font-display font-bold text-lg text-center" style={{ color }}>
          {result.scoreLabel}
        </p>
      </div>

      {result.revengeTradeWarning && (
        <div className="rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#F59E0B] shrink-0 mt-0.5" />
          <p className="text-[#F59E0B] text-sm">Your last trade was a loss. Make sure this isn't an emotional reaction before entering.</p>
        </div>
      )}
      {result.newsAlert && (
        <div className="rounded-xl border border-[#EF4444]/40 bg-[#EF4444]/10 p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" />
            <p className="text-[#EF4444] font-semibold text-sm">News Event: {result.newsAlert.event}</p>
          </div>
          <p className="text-[#EF4444]/80 text-xs">{result.newsAlert.minutesAway} minutes away — {result.newsAlert.recommendation}</p>
        </div>
      )}
      {result.propFirmAlert && (
        <div className="rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-4">
          <p className="text-[#F59E0B] text-sm font-semibold">Prop Firm Warning</p>
          <p className="text-[#F59E0B]/80 text-sm mt-1">{result.propFirmAlert}</p>
        </div>
      )}

      <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-4 space-y-3">
        <p className="font-display font-semibold text-[#F1F5F9]">Confluence Breakdown</p>
        {Object.entries(confluence).map(([key, val], i) => (
          confluenceLabels[key] ? (
            <ConfluenceBar key={key} label={confluenceLabels[key]} value={val} delay={i * 100} />
          ) : null
        ))}
      </div>

      <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-4 space-y-3">
        <p className="font-display font-semibold text-[#F1F5F9]">Key Findings</p>
        {(result.positives as string[]).map((p, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-[#10B981] mt-0.5">✅</span>
            <p className="text-[#F1F5F9] text-sm">{p}</p>
          </div>
        ))}
        {(result.warnings as string[]).map((w, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-[#F59E0B] mt-0.5">⚠️</span>
            <p className="text-[#F1F5F9] text-sm">{w}</p>
          </div>
        ))}
        {(result.negatives as string[]).map((n, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-[#EF4444] mt-0.5">❌</span>
            <p className="text-[#F1F5F9] text-sm">{n}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-[#0D1117] border-l-4 border border-[#3B82F6] pl-4 p-4">
        <p className="font-display font-semibold text-[#F1F5F9] mb-2">AI Verdict</p>
        <p className="text-[#F1F5F9] text-sm leading-relaxed">{result.verdict}</p>
      </div>

      <div className="rounded-xl bg-[#EF4444]/5 border border-[#EF4444]/20 p-4">
        <p className="font-display font-semibold text-[#EF4444] mb-2">Devil's Advocate</p>
        <p className="text-[#64748B] text-xs mb-2">Here's why this trade could fail:</p>
        {(result.devilsAdvocate as string[]).map((d, i) => (
          <div key={i} className="flex items-start gap-2 mb-1">
            <span className="text-[#EF4444] text-xs mt-0.5">•</span>
            <p className="text-[#F1F5F9] text-sm">{d}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-[#3B82F6]/5 border border-[#3B82F6]/20 p-4">
        <p className="font-display font-semibold text-[#3B82F6] mb-2">Recommended Actions</p>
        {(result.recommendations as string[]).map((r, i) => (
          <div key={i} className="flex items-start gap-2 mb-1">
            <CheckCircle className="w-3.5 h-3.5 text-[#3B82F6] mt-0.5 shrink-0" />
            <p className="text-[#F1F5F9] text-sm">{r}</p>
          </div>
        ))}
        {result.waitFor && (
          <div className="mt-3 pt-3 border-t border-[#3B82F6]/20">
            <p className="text-[#64748B] text-xs mb-1">Wait For:</p>
            <p className="text-[#F1F5F9] text-sm">{result.waitFor}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onReset}
          className="py-3 rounded-[20px] border border-[#1E2736] text-[#F1F5F9] font-semibold active:scale-95 transition-transform"
        >
          New Analysis
        </button>
        <button
          onClick={() => setLocation("/history")}
          className="py-3 rounded-[20px] bg-[#F0B429] text-[#080B14] font-bold active:scale-95 transition-transform"
        >
          View History
        </button>
      </div>
      <div className="pb-8" />
    </motion.div>
  );
}

function LoadingScreen({ steps }: { steps: string[] }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setStep((s) => Math.min(s + 1, steps.length));
    }, 700);
    return () => clearInterval(id);
  }, [steps.length]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8 p-8">
      <div className="relative w-24 h-24">
        <div className="absolute inset-0 rounded-full border-4 border-[#F0B429]/20 animate-ping" />
        <div className="absolute inset-2 rounded-full border-4 border-[#F0B429]/40 animate-pulse" />
        <div className="absolute inset-4 rounded-full bg-gradient-to-br from-[#F0B429] to-[#D97706] animate-spin" style={{ animationDuration: "2s" }} />
      </div>
      <div className="w-full space-y-3">
        {steps.map((step_label, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: i <= step ? 1 : 0.3, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-3"
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${i < step ? "bg-[#10B981]" : i === step ? "bg-[#F0B429] animate-pulse" : "bg-[#1E2736]"}`}>
              {i < step && <CheckCircle className="w-3 h-3 text-white" />}
            </div>
            <span className={`text-sm ${i < step ? "text-[#10B981]" : i === step ? "text-[#F0B429]" : "text-[#64748B]"}`}>
              {step_label}
            </span>
          </motion.div>
        ))}
      </div>
      <p className="text-[#64748B] text-sm animate-pulse">AI is analysing your chart...</p>
    </div>
  );
}

export default function Analyze() {
  const [, setLocation] = useLocation();
  const { user } = useAppContext();
  const analyzeTrade = useAnalyzeTrade();
  const { data: newsEvents } = useGetNews({ query: { queryKey: getGetNewsQueryKey() } });

  const [currentStep, setCurrentStep] = useState(0);
  const handleBack = useCallback(() => {
    if (currentStep === 0) {
      setLocation("/");
    } else {
      setCurrentStep((s) => Math.max(0, s - 1));
    }
  }, [currentStep, setLocation]);
  useTelegramBackButton(handleBack);
  const [result, setResult] = useState<Analysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<"form" | "chart">("form");

  const [emotionScore, setEmotionScore] = useState(7);

  const [pair, setPair] = useState("EUR/USD");
  const [direction, setDirection] = useState<"buy" | "sell">("buy");
  const [timeframe, setTimeframe] = useState<TradeInputTimeframe>(TradeInputTimeframe.H1);
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [accountSize, setAccountSize] = useState(user?.accountSize?.toString() ?? "10000");
  const [riskPercent, setRiskPercent] = useState(1);
  const [reasoning, setReasoning] = useState("");
  const [htfBias, setHtfBias] = useState("Not Checked");
  const [keyLevels, setKeyLevels] = useState(false);
  const [keyLevelsDesc, setKeyLevelsDesc] = useState("");
  const [formError, setFormError] = useState("");

  // Chart mode state — base64 is read immediately on file select to avoid
  // iOS/Safari "file could not be read" errors when reading a stale File ref later
  const [chartBase64, setChartBase64] = useState<string | null>(null);
  const [chartMimeType, setChartMimeType] = useState<string>("image/jpeg");
  const [chartFileName, setChartFileName] = useState<string | null>(null);
  const [chartPreview, setChartPreview] = useState<string | null>(null);
  const [chartNotes, setChartNotes] = useState("");
  const [chartError, setChartError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reasoningRef = useRef<HTMLTextAreaElement>(null);

  const entry = parseFloat(entryPrice);
  const sl = parseFloat(stopLoss);
  const tp = parseFloat(takeProfit);
  const account = parseFloat(accountSize) || 10000;
  const riskDollars = (account * riskPercent) / 100;

  const jpyPairs = ["USD/JPY","EUR/JPY","GBP/JPY","CAD/JPY"];
  const isJpy = jpyPairs.includes(pair);
  const pipSize = isJpy ? 0.01 : 0.0001;

  const slPips = !isNaN(entry) && !isNaN(sl) ? Math.abs(Math.round((entry - sl) / pipSize)) : 0;
  const tpPips = !isNaN(entry) && !isNaN(tp) ? Math.abs(Math.round((tp - entry) / pipSize)) : 0;
  const rrRatio = slPips > 0 ? tpPips / slPips : 0;
  const lotSize = slPips > 0 ? parseFloat((riskDollars / (slPips * (isJpy ? 1 : 10))).toFixed(2)) : 0;

  const emotionLabel = emotionScore <= 3 ? "Stressed / Emotional" : emotionScore <= 6 ? "Neutral" : "Focused & Calm";
  const emotionColor = emotionScore <= 3 ? "#EF4444" : emotionScore <= 6 ? "#F59E0B" : "#10B981";
  const riskColor = riskPercent < 2 ? "#10B981" : riskPercent <= 3 ? "#F59E0B" : "#EF4444";

  function validateForm(): boolean {
    if (!entryPrice || isNaN(entry)) { setFormError("Enter a valid entry price"); return false; }
    if (!stopLoss || isNaN(sl)) { setFormError("Enter a valid stop loss"); return false; }
    if (!takeProfit || isNaN(tp)) { setFormError("Enter a valid take profit"); return false; }
    if (reasoning.trim().length < 30) { setFormError("Reasoning must be at least 30 characters"); return false; }
    if (rrRatio < 0.5) { setFormError("R:R ratio is too low — check your price levels"); return false; }
    setFormError("");
    return true;
  }

  function handleChartFileChange(file: File) {
    if (!file.type.startsWith("image/")) {
      setChartError("Please upload an image file (JPG, PNG, or WebP)");
      return;
    }
    if (file.size > 8_000_000) {
      setChartError("Image must be under 8MB");
      return;
    }
    setChartError("");
    setChartFileName(file.name);
    setChartMimeType(file.type);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setChartPreview(dataUrl);
      setChartBase64(dataUrl.split(",")[1]);
    };
    reader.onerror = () => {
      setChartError("Failed to read image. Please try again.");
    };
    reader.readAsDataURL(file);
  }

  async function handleFormSubmit() {
    if (!validateForm()) return;
    setIsLoading(true);
    setCurrentStep(2);

    const upcomingNews = newsEvents?.filter((n) => (n.minutesAway ?? 0) >= 0 && (n.minutesAway ?? 999) <= 240).slice(0, 5) ?? [];

    const startTime = Date.now();
    try {
      const res = await analyzeTrade.mutateAsync({
        data: {
          userId: user?.id ?? "demo",
          pair,
          direction,
          timeframe,
          entryPrice: entry,
          stopLoss: sl,
          takeProfit: tp,
          lotSize,
          riskPercent,
          accountSize: account,
          rrRatio,
          reasoning,
          emotionScore,
          htfBias: htfBias !== "Not Checked" ? htfBias : null,
          keyLevelsNearby: keyLevels,
          keyLevelsDescription: keyLevels ? keyLevelsDesc : null,
        },
      });

      const elapsed = Date.now() - startTime;
      if (elapsed < 3000) await new Promise((r) => setTimeout(r, 3000 - elapsed));

      setResult(res);
      setCurrentStep(3);
    } catch {
      setFormError("Analysis failed. Please try again.");
      setCurrentStep(1);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleChartSubmit() {
    if (!chartBase64) { setChartError("Please upload a chart image first"); return; }
    setIsLoading(true);
    setCurrentStep(2);

    const startTime = Date.now();
    try {
      const upcomingNews = newsEvents?.filter((n) => (n.minutesAway ?? 0) >= 0 && (n.minutesAway ?? 999) <= 240).slice(0, 5) ?? [];

      const res = await fetch("/api/analyze/chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id ?? "demo",
          imageBase64: chartBase64,
          mimeType: chartMimeType,
          emotionScore,
          notes: chartNotes.trim() || null,
          newsEvents: upcomingNews,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Analysis failed");
      }

      const data = await res.json() as Analysis;
      const elapsed = Date.now() - startTime;
      if (elapsed < 3000) await new Promise((r) => setTimeout(r, 3000 - elapsed));

      setResult(data);
      setCurrentStep(3);
    } catch (err) {
      setChartError(err instanceof Error ? err.message : "Analysis failed. Please try again.");
      setCurrentStep(1);
    } finally {
      setIsLoading(false);
    }
  }

  function handleReset() {
    setResult(null);
    setCurrentStep(0);
    setEmotionScore(7);
    setPair("EUR/USD");
    setDirection("buy");
    setTimeframe(TradeInputTimeframe.H1 as TradeInputTimeframe);
    setEntryPrice(""); setStopLoss(""); setTakeProfit("");
    setReasoning(""); setHtfBias("Not Checked");
    setKeyLevels(false); setKeyLevelsDesc("");
    setFormError("");
    setChartBase64(null);
    setChartFileName(null);
    setChartPreview(null);
    setChartNotes(""); setChartError("");
  }

  const loadingSteps = analysisMode === "chart" ? CHART_LOADING_STEPS : FORM_LOADING_STEPS;
  if (currentStep === 2 && isLoading) return <LoadingScreen steps={loadingSteps} />;
  if (currentStep === 3 && result) return (
    <ResultsScreen
      result={result}
      onReset={handleReset}
      chartImageUrl={analysisMode === "chart" ? chartPreview : null}
    />
  );

  if (currentStep === 0) return (
    <div className="flex flex-col min-h-[80vh] p-6 gap-6">
      <button
        onClick={() => setLocation("/")}
        className="self-start flex items-center gap-1 text-[#64748B] hover:text-[#F1F5F9] transition-colors active:scale-95"
      >
        <ChevronLeft className="w-5 h-5" />
        <span className="text-sm">Back</span>
      </button>
      <div className="flex-1 flex flex-col justify-center gap-6">
        <div className="text-center">
          <h2 className="font-display text-2xl font-bold text-[#F1F5F9]">Before You Trade</h2>
          <p className="text-[#64748B] mt-2">Your mindset matters as much as your analysis</p>
        </div>
        <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-6 space-y-6">
          <div className="text-center">
            <p className="text-[#F1F5F9] font-semibold mb-1">How are you feeling right now?</p>
            <p className="font-display font-bold text-4xl" style={{ color: emotionColor }}>{emotionScore}/10</p>
            <p className="text-sm mt-1" style={{ color: emotionColor }}>{emotionLabel}</p>
          </div>
          <input
            type="range" min={1} max={10} value={emotionScore}
            onChange={(e) => setEmotionScore(parseInt(e.target.value))}
            className="w-full accent-[#F0B429]"
            style={{ accentColor: emotionColor }}
          />
          <div className="flex justify-between text-xs text-[#64748B]">
            <span>Stressed</span><span>Neutral</span><span>Focused</span>
          </div>
          {emotionScore < 5 && (
            <div className="rounded-lg border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#F59E0B] shrink-0 mt-0.5" />
              <p className="text-[#F59E0B] text-sm">Trading while emotional often leads to poor decisions. Consider waiting for a calmer mindset.</p>
            </div>
          )}
          {emotionScore >= 5 && (
            <div className="rounded-lg border border-[#10B981]/30 bg-[#10B981]/10 p-3 text-center">
              <p className="text-[#10B981] text-sm font-medium">Looking good! Let's analyse your trade.</p>
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setLocation("/")}
            className="flex-1 py-3 rounded-[20px] border border-[#1E2736] text-[#64748B] font-semibold active:scale-97 transition-transform"
          >
            Come Back Later
          </button>
          <button
            onClick={() => setCurrentStep(1)}
            className="flex-1 py-3 rounded-[20px] bg-[#F0B429] text-[#080B14] font-bold active:scale-97 transition-transform"
          >
            {emotionScore < 5 ? "Continue Anyway" : "Let's Go"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 p-4 pt-4">
      <div className="flex items-center gap-2">
        <button onClick={() => setCurrentStep(0)} className="text-[#64748B] hover:text-[#F1F5F9]">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex gap-1.5 flex-1">
          {[0,1,2,3].map((i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= currentStep ? "bg-[#F0B429]" : "bg-[#1E2736]"}`} />
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-1 flex">
        <button
          onClick={() => { setAnalysisMode("form"); setChartError(""); }}
          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${analysisMode === "form" ? "bg-[#F0B429] text-[#080B14]" : "text-[#64748B]"}`}
        >
          Fill Form
        </button>
        <button
          onClick={() => { setAnalysisMode("chart"); setFormError(""); }}
          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${analysisMode === "chart" ? "bg-[#F0B429] text-[#080B14]" : "text-[#64748B]"}`}
        >
          <Camera className="w-4 h-4" />
          Send Chart
        </button>
      </div>

      <AnimatePresence mode="wait">
        {analysisMode === "chart" ? (
          <motion.div
            key="chart-mode"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-4"
          >
            <div>
              <h2 className="font-display text-xl font-bold text-[#F1F5F9]">Chart Analysis</h2>
              <p className="text-[#64748B] text-sm mt-1">Upload your chart screenshot and let AI read the setup for you</p>
            </div>

            <div
              className={`rounded-xl border-2 border-dashed transition-all cursor-pointer relative overflow-hidden ${
                chartPreview ? "border-[#F0B429]/40 bg-[#0D1117]" : "border-[#1E2736] bg-[#0D1117] hover:border-[#F0B429]/40"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleChartFileChange(file);
              }}
            >
              {chartPreview ? (
                <div className="relative">
                  <img
                    src={chartPreview}
                    alt="Chart preview"
                    className="w-full max-h-64 object-contain bg-black"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setChartBase64(null);
                      setChartFileName(null);
                      setChartPreview(null);
                    }}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 flex items-center justify-center text-white hover:bg-black/90"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="px-3 pb-2 pt-1 flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
                    <p className="text-[#10B981] text-xs">{chartFileName}</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 px-6 gap-3">
                  <div className="w-14 h-14 rounded-full bg-[#1E2736] flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-[#F0B429]" />
                  </div>
                  <p className="text-[#F1F5F9] font-semibold text-center">Tap to upload chart</p>
                  <p className="text-[#64748B] text-xs text-center">JPG, PNG or WebP · Max 8MB<br/>Take a screenshot of your chart in any trading app</p>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleChartFileChange(file);
              }}
            />

            <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-4">
              <div className="flex justify-between items-center mb-2">
                <p className="text-[#F1F5F9] text-sm font-medium">Your thoughts (optional)</p>
                <span className="text-[#64748B] text-xs">{chartNotes.length} chars</span>
              </div>
              <textarea
                value={chartNotes}
                onChange={(e) => setChartNotes(e.target.value)}
                rows={3}
                placeholder="e.g. I see a potential bullish breakout on H4, price is near resistance..."
                className="w-full bg-[#161B27] border border-[#1E2736] text-[#F1F5F9] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#F0B429] resize-none"
              />
              <p className="text-[#64748B] text-xs mt-1">
                Tell the AI what you're seeing — it uses this alongside the chart visual
              </p>
            </div>

            <div className="rounded-xl bg-[#161B27] border border-[#1E2736] p-4">
              <p className="text-[#64748B] text-xs uppercase tracking-wider font-medium mb-3">AI will auto-detect</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  "Trend direction","Chart patterns","Key S/R levels","Entry zone",
                  "Stop loss area","Take profit targets","Market structure","Trade quality score",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#F0B429]" />
                    <span className="text-[#94A3B8] text-xs">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {chartError && (
              <div className="rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/10 p-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#EF4444] shrink-0" />
                <p className="text-[#EF4444] text-sm">{chartError}</p>
              </div>
            )}

            <button
              onClick={handleChartSubmit}
              disabled={!chartBase64 || isLoading}
              className="w-full py-4 rounded-[20px] bg-gradient-to-r from-[#F0B429] to-[#D97706] text-[#080B14] font-display font-bold text-lg active:scale-97 transition-transform shadow-lg shadow-[#F0B429]/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {chartBase64 ? "Analyse Chart" : "Upload a Chart First"}
            </button>
            <div className="pb-4" />
          </motion.div>
        ) : (
          <motion.div
            key="form-mode"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-4"
          >
            <h2 className="font-display text-xl font-bold text-[#F1F5F9]">Trade Details</h2>

            <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-4 space-y-3">
              <p className="text-[#64748B] text-xs uppercase tracking-wider font-medium">Instrument & Direction</p>
              <select
                value={pair}
                onChange={(e) => setPair(e.target.value)}
                className="w-full bg-[#161B27] border border-[#1E2736] text-[#F1F5F9] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#F0B429]"
              >
                {PAIRS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                {(["buy","sell"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDirection(d)}
                    className={`py-3 rounded-lg font-bold text-sm transition-all active:scale-95 ${
                      direction === d
                        ? d === "buy" ? "bg-[#10B981] text-white" : "bg-[#EF4444] text-white"
                        : "bg-[#161B27] border border-[#1E2736] text-[#64748B]"
                    }`}
                  >
                    {d.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-4">
              <p className="text-[#64748B] text-xs uppercase tracking-wider font-medium mb-3">Timeframe</p>
              <div className="flex gap-2 flex-wrap">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf as TradeInputTimeframe)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all active:scale-95 ${
                      timeframe === tf ? "bg-[#F0B429] text-[#080B14]" : "bg-[#161B27] border border-[#1E2736] text-[#64748B]"
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-4 space-y-3">
              <p className="text-[#64748B] text-xs uppercase tracking-wider font-medium">Price Levels</p>
              {[
                { label: "Entry Price", value: entryPrice, set: setEntryPrice },
                { label: "Stop Loss", value: stopLoss, set: setStopLoss },
                { label: "Take Profit", value: takeProfit, set: setTakeProfit },
              ].map(({ label, value, set }) => (
                <div key={label}>
                  <label className="text-[#F1F5F9] text-sm mb-1 block">{label}</label>
                  <input
                    type="number" step="any"
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    className="w-full bg-[#161B27] border border-[#1E2736] text-[#F1F5F9] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#F0B429]"
                    placeholder="0.00000"
                  />
                </div>
              ))}
              {slPips > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-[#64748B]">SL: <span className="text-[#EF4444]">{slPips} pips</span></span>
                  <span className="text-[#64748B]">TP: <span className="text-[#10B981]">{tpPips} pips</span></span>
                  <span className="text-[#64748B]">R:R: <span className={rrRatio >= 2 ? "text-[#10B981]" : rrRatio >= 1 ? "text-[#F59E0B]" : "text-[#EF4444]"} style={{ fontWeight: 600 }}>1:{rrRatio.toFixed(2)}</span></span>
                </div>
              )}
            </div>

            <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-4 space-y-3">
              <p className="text-[#64748B] text-xs uppercase tracking-wider font-medium">Position Size</p>
              <div>
                <label className="text-[#F1F5F9] text-sm mb-1 block">Account Size ($)</label>
                <input type="number" value={accountSize} onChange={(e) => setAccountSize(e.target.value)}
                  className="w-full bg-[#161B27] border border-[#1E2736] text-[#F1F5F9] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#F0B429]" placeholder="10000" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-[#F1F5F9]">Risk %</span>
                  <span className="font-semibold" style={{ color: riskColor }}>{riskPercent}%</span>
                </div>
                <input type="range" min={0.5} max={5} step={0.5} value={riskPercent}
                  onChange={(e) => setRiskPercent(parseFloat(e.target.value))}
                  className="w-full" style={{ accentColor: riskColor }} />
                <div className="flex justify-between text-xs text-[#64748B] mt-1">
                  <span>0.5%</span><span>Safe zone</span><span>5%</span>
                </div>
              </div>
              {lotSize > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-[#64748B]">Risk: <span className="text-[#F1F5F9] font-semibold">${riskDollars.toFixed(2)}</span></span>
                  <span className="text-[#64748B]">Lot Size: <span className="text-[#F0B429] font-semibold">{lotSize}</span></span>
                </div>
              )}
            </div>

            <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-4 space-y-3">
              <p className="text-[#64748B] text-xs uppercase tracking-wider font-medium">Trade Context</p>
              <div>
                <p className="text-[#F1F5F9] text-sm mb-2">Higher TF Bias</p>
                <div className="grid grid-cols-2 gap-2">
                  {HTF_BIAS.map((b) => (
                    <button key={b} onClick={() => setHtfBias(b)}
                      className={`py-2 rounded-lg text-sm transition-all active:scale-95 ${htfBias === b ? "bg-[#F0B429] text-[#080B14] font-semibold" : "bg-[#161B27] border border-[#1E2736] text-[#64748B]"}`}>
                      {b}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[#F1F5F9] text-sm">Key Levels Nearby?</p>
                  <button onClick={() => setKeyLevels(!keyLevels)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${keyLevels ? "bg-[#F0B429]" : "bg-[#1E2736]"}`}>
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${keyLevels ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                </div>
                {keyLevels && (
                  <input type="text" value={keyLevelsDesc} onChange={(e) => setKeyLevelsDesc(e.target.value)}
                    placeholder="e.g. Major resistance at 1.0950, previous day high"
                    className="w-full bg-[#161B27] border border-[#1E2736] text-[#F1F5F9] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#F0B429]" />
                )}
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[#F1F5F9] text-sm">Your Reasoning</label>
                  <span className={`text-xs ${reasoning.length >= 30 ? "text-[#10B981]" : "text-[#64748B]"}`}>{reasoning.length}/30 min</span>
                </div>
                <textarea
                  ref={reasoningRef}
                  value={reasoning}
                  onChange={(e) => setReasoning(e.target.value)}
                  rows={4}
                  placeholder="Why are you taking this trade? What's your setup? What are the key confluences..."
                  className="w-full bg-[#161B27] border border-[#1E2736] text-[#F1F5F9] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#F0B429] resize-none"
                />
              </div>
            </div>

            {formError && (
              <div className="rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/10 p-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#EF4444] shrink-0" />
                <p className="text-[#EF4444] text-sm">{formError}</p>
              </div>
            )}

            <button
              onClick={handleFormSubmit}
              disabled={analyzeTrade.isPending}
              className="w-full py-4 rounded-[20px] bg-gradient-to-r from-[#F0B429] to-[#D97706] text-[#080B14] font-display font-bold text-lg active:scale-97 transition-transform shadow-lg shadow-[#F0B429]/20 disabled:opacity-50"
            >
              Analyse Trade
            </button>
            <div className="pb-4" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
