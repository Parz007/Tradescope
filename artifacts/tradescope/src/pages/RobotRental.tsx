import { useState, useEffect, useRef, useCallback } from "react";
import { useAppContext } from "@/lib/AppContext";
import { ChevronLeft, Copy, Check, Bot, Shield, Zap, X, Clock, Star, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { useLocation } from "wouter";
import { useTelegramBackButton } from "@/hooks/useTelegramBackButton";

interface PaymentInfo {
  address: string;
  network: string;
  symbol: string;
}

const CRYPTO_OPTIONS = [
  { key: "USDT_ERC20", label: "USDT (ERC-20)", symbol: "USDT", color: "#26A17B", logo: "https://i.8upload.com/image/6319dcd20d5f79a6/1849.webp" },
  { key: "USDT_TRC20", label: "USDT (TRC-20)", symbol: "USDT", color: "#E84142", logo: "https://i.8upload.com/image/5e6101a0499b0a16/1848.webp" },
  { key: "USDT_BEP20", label: "USDT (BEP-20)", symbol: "USDT", color: "#F0B90B", logo: "https://i.8upload.com/image/24168f02a32d673e/1852.webp" },
  { key: "USDC_ERC20", label: "USDC (ERC-20)", symbol: "USDC", color: "#2775CA", logo: "https://i.8upload.com/image/3e9376c5eb9ddebb/1854.webp" },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#1E2736] hover:bg-[#263348] text-xs transition-colors"
    >
      {copied ? <Check className="w-3 h-3 text-[#10B981]" /> : <Copy className="w-3 h-3 text-[#F0B429]" />}
      <span className={copied ? "text-[#10B981]" : "text-[#F0B429]"}>{copied ? "Copied!" : "Copy"}</span>
    </button>
  );
}

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

function RentalModal({ onClose }: { onClose: () => void }) {
  const { user } = useAppContext();
  const [step, setStep] = useState(1);
  const [selectedCrypto, setSelectedCrypto] = useState("");
  const [contact, setContact] = useState("");
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [processingStep, setProcessingStep] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [paymentInfo, setPaymentInfo] = useState<Record<string, PaymentInfo>>({});
  const TIMER_SECONDS = 45 * 60;
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch(`${BASE_URL}/api/robot-rental/payment-info`)
      .then((r) => r.json())
      .then((d) => setPaymentInfo(d as Record<string, PaymentInfo>))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (step === 2) {
      setTimeLeft(TIMER_SECONDS);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [step]);

  const timerMins = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const timerSecs = (timeLeft % 60).toString().padStart(2, "0");
  const timerExpired = timeLeft === 0;
  const timerColor = timeLeft > 600 ? "#10B981" : timeLeft > 180 ? "#F59E0B" : "#EF4444";

  const crypto = CRYPTO_OPTIONS.find((c) => c.key === selectedCrypto);
  const wallet = selectedCrypto ? paymentInfo[selectedCrypto] : null;
  const address = wallet?.address ?? "";

  async function handleSubmitOrder() {
    if (!contact.trim()) { setError("Please enter your Telegram username so admin can send the EA file"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${BASE_URL}/api/robot-rental/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerUserId: user?.id ?? "demo",
          buyerContact: contact.trim(),
          cryptoType: selectedCrypto,
          txHash: txHash.trim() || undefined,
        }),
      });
      const data = await res.json() as { id?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Order failed");
      setOrderId(data.id ?? "");
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Order failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9998] flex items-end justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="relative w-full max-w-[480px] bg-[#080B14] border-t border-[#1E2736] rounded-t-2xl max-h-[90dvh] overflow-y-auto"
      >
        <AnimatePresence>
          {processingStep && (
            <motion.div
              key="processing-overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#080B14] rounded-t-2xl gap-5"
            >
              <div className="relative w-16 h-16">
                <svg className="w-16 h-16 animate-spin" viewBox="0 0 64 64" fill="none">
                  <circle cx="32" cy="32" r="28" stroke="#1E2736" strokeWidth="4" />
                  <path d="M32 4a28 28 0 0128 28" stroke="#F0B429" strokeWidth="4" strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Bot className="w-6 h-6 text-[#F0B429]" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-[#F1F5F9] font-semibold text-sm">Preparing payment</p>
                <p className="text-[#64748B] text-xs mt-1">Setting up your secure session…</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#1E2736]" />
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#64748B] text-xs uppercase tracking-wider">Renting</p>
              <p className="font-display font-bold text-lg text-[#F1F5F9]">Tradescope EA · 2 Weeks</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#1E2736] flex items-center justify-center">
              <X className="w-4 h-4 text-[#64748B]" />
            </button>
          </div>

          <div className="flex gap-1">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-all ${s <= step ? "bg-[#F0B429]" : "bg-[#1E2736]"}`} />
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* Step 1 — Select crypto */}
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-3">
                <p className="text-[#F1F5F9] font-semibold">Select Payment Method</p>
                <p className="text-[#64748B] text-xs">Send $15 USD equivalent to admin's wallet. You'll receive the EA file within 1–24 hrs via Telegram.</p>
                {CRYPTO_OPTIONS.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setSelectedCrypto(c.key)}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      selectedCrypto === c.key ? "border-[#F0B429] bg-[#F0B429]/5" : "border-[#1E2736] bg-[#0D1117]"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 flex items-center justify-center" style={{ backgroundColor: `${c.color}22` }}>
                      <img src={c.logo} alt={c.label} className="w-7 h-7 object-contain" />
                    </div>
                    <div className="text-left">
                      <p className="text-[#F1F5F9] text-sm font-semibold">{c.label}</p>
                      <p className="text-[#64748B] text-xs">{c.symbol} stablecoin</p>
                    </div>
                    {selectedCrypto === c.key && (
                      <div className="ml-auto w-5 h-5 rounded-full bg-[#F0B429] flex items-center justify-center">
                        <Check className="w-3 h-3 text-[#080B14]" />
                      </div>
                    )}
                  </button>
                ))}
                <button
                  onClick={() => {
                    if (!selectedCrypto) { setError("Please select a payment method"); return; }
                    setError("");
                    setProcessingStep(true);
                    setTimeout(() => { setProcessingStep(false); setStep(2); }, 1200);
                  }}
                  className="w-full py-3.5 rounded-[16px] bg-gradient-to-r from-[#F0B429] to-[#D97706] text-[#080B14] font-bold active:scale-95 transition-transform disabled:opacity-50"
                >
                  Continue
                </button>
                {error && <p className="text-[#EF4444] text-sm text-center">{error}</p>}
              </motion.div>
            )}

            {/* Step 2 — Send payment */}
            {step === 2 && wallet && crypto && (
              <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-4">
                <div className="flex items-center justify-between rounded-xl px-4 py-2.5 border" style={{ borderColor: `${timerColor}33`, backgroundColor: `${timerColor}0D` }}>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" style={{ color: timerColor }} />
                    <span className="text-xs font-medium" style={{ color: timerColor }}>
                      {timerExpired ? "Session expired — restart" : "Session expires in"}
                    </span>
                  </div>
                  <span className="font-mono text-sm font-bold" style={{ color: timerColor }}>
                    {timerMins}:{timerSecs}
                  </span>
                </div>

                <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-4 flex flex-col items-center gap-3">
                  <p className="text-[#64748B] text-xs uppercase tracking-wider">Send exactly</p>
                  <p className="font-display font-bold text-3xl text-[#F0B429]">$15.00</p>
                  <p className="text-[#64748B] text-xs">{crypto.label} · {wallet.network}</p>
                  <div className="p-2 rounded-xl bg-white">
                    <QRCodeSVG value={address} size={140} />
                  </div>
                  <div className="w-full">
                    <p className="text-[#64748B] text-xs mb-1">Wallet Address</p>
                    <div className="flex items-center gap-2 bg-[#1E2736] rounded-lg p-2.5">
                      <p className="text-[#F1F5F9] font-mono text-[10px] break-all flex-1">{address}</p>
                      <CopyButton text={address} />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 p-3">
                  <p className="text-[#F59E0B] text-xs font-semibold">⚠️ Important</p>
                  <p className="text-[#F59E0B]/80 text-xs mt-1">Send only {crypto.symbol} on {wallet.network}. Sending any other coin to this address will result in permanent loss.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setStep(1)} className="py-3 rounded-[16px] border border-[#1E2736] text-[#64748B] font-semibold text-sm active:scale-95 transition-transform">
                    Back
                  </button>
                  <button
                    onClick={() => { setError(""); setStep(3); }}
                    className="py-3 rounded-[16px] bg-[#F0B429] text-[#080B14] font-bold text-sm active:scale-95 transition-transform"
                  >
                    I've Sent It
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 3 — Confirm + contact */}
            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-4">
                <p className="text-[#F1F5F9] font-semibold">Confirm Your Order</p>

                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-[#64748B] text-xs mb-1.5 block">Your Telegram Username *</label>
                    <input
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      placeholder="@yourusername"
                      className="w-full bg-[#161B27] border border-[#1E2736] text-[#F1F5F9] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#F0B429]"
                    />
                    <p className="text-[#64748B] text-xs mt-1">Admin will DM you the EA file here</p>
                  </div>
                  <div>
                    <label className="text-[#64748B] text-xs mb-1.5 block">Transaction Hash (optional)</label>
                    <input
                      value={txHash}
                      onChange={(e) => setTxHash(e.target.value)}
                      placeholder="0x... or txid..."
                      className="w-full bg-[#161B27] border border-[#1E2736] text-[#F1F5F9] rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#F0B429]"
                    />
                    <p className="text-[#64748B] text-xs mt-1">Speeds up verification</p>
                  </div>
                </div>

                <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-4 space-y-2">
                  <p className="text-[#64748B] text-xs uppercase tracking-wider font-medium">Order Summary</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#94A3B8]">Product</span>
                    <span className="text-[#F1F5F9] font-semibold">Tradescope EA</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#94A3B8]">Platform</span>
                    <span className="text-[#F1F5F9] font-semibold">MT4 / MT5</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#94A3B8]">Duration</span>
                    <span className="text-[#F1F5F9] font-semibold">14 days</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#94A3B8]">Payment</span>
                    <span className="text-[#F1F5F9] font-semibold">{crypto?.label}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-[#1E2736] pt-2 mt-2">
                    <span className="text-[#94A3B8]">Total</span>
                    <span className="text-[#F0B429] font-bold">$15.00 USD</span>
                  </div>
                </div>

                {error && <p className="text-[#EF4444] text-sm text-center bg-[#EF4444]/10 rounded-lg p-3">{error}</p>}

                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setStep(2)} className="py-3 rounded-[16px] border border-[#1E2736] text-[#64748B] font-semibold text-sm active:scale-95 transition-transform">
                    Back
                  </button>
                  <button
                    onClick={handleSubmitOrder}
                    disabled={loading}
                    className="py-3 rounded-[16px] bg-[#F0B429] text-[#080B14] font-bold text-sm active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    {loading ? "Submitting..." : "Submit Order"}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 4 — Success */}
            {step === 4 && (
              <motion.div key="s4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="w-16 h-16 rounded-full bg-[#10B981]/20 flex items-center justify-center">
                  <Check className="w-8 h-8 text-[#10B981]" />
                </div>
                <div>
                  <p className="font-display font-bold text-xl text-[#F1F5F9]">Rental Order Submitted!</p>
                  <p className="text-[#64748B] text-sm mt-1">Admin is reviewing your payment</p>
                </div>
                {orderId && (
                  <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-4 w-full">
                    <p className="text-[#64748B] text-xs mb-1">Order Reference</p>
                    <p className="text-[#F0B429] font-mono text-xs break-all">{orderId}</p>
                  </div>
                )}
                <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-4 text-left space-y-2 w-full">
                  <p className="text-[#F1F5F9] font-semibold text-sm">What happens next</p>
                  {[
                    "Admin verifies your crypto payment on-chain",
                    "Verification typically takes 1–24 hours",
                    "Admin DMs you the Tradescope EA .ex4/.ex5 file on Telegram",
                    "Attach the file to your MT4 / MT5 platform and start trading",
                    "Your 14-day rental begins from the date of delivery",
                  ].map((t, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-[#F0B429] text-xs mt-0.5">→</span>
                      <p className="text-[#94A3B8] text-xs">{t}</p>
                    </div>
                  ))}
                </div>
                <button onClick={onClose} className="w-full py-3.5 rounded-[16px] bg-[#F0B429] text-[#080B14] font-bold active:scale-95 transition-transform">
                  Done
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="pb-safe" />
      </motion.div>
    </div>
  );
}

const FEATURES = [
  { icon: Zap, label: "Fully Automated", desc: "Trades MT4 & MT5 around the clock — no manual input needed." },
  { icon: Shield, label: "Prop Firm Ready", desc: "Built-in risk rules compatible with FTMO, MyForexFunds & more." },
  { icon: Star, label: "Tradescope Logic", desc: "Powered by the same signals used in Tradescope analyses." },
  { icon: Download, label: "Instant Setup", desc: "Drop the .ex4/.ex5 file into your platform and run." },
];

export default function RobotRental() {
  const [, setLocation] = useLocation();
  const [modalOpen, setModalOpen] = useState(false);
  const handleBack = useCallback(() => setLocation("/"), [setLocation]);
  useTelegramBackButton(handleBack);

  return (
    <>
      <div className="flex flex-col gap-4 p-4 pt-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="text-[#64748B] hover:text-[#F1F5F9] transition-colors active:scale-95 shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-[#6366F1]/20 flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5 text-[#6366F1]" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-[#F1F5F9]">Rent Tradescope EA</h1>
            <p className="text-[#64748B] text-xs">MT4 / MT5 Expert Advisor · 2-Week Rental</p>
          </div>
        </div>

        {/* Hero Card */}
        <div className="rounded-2xl bg-gradient-to-br from-[#0D1117] to-[#161024] border border-[#6366F1]/30 p-5 flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs bg-[#6366F1]/20 text-[#6366F1] px-2 py-0.5 rounded-full font-semibold">Expert Advisor</span>
                <span className="text-xs bg-[#10B981]/20 text-[#10B981] px-2 py-0.5 rounded-full font-semibold">Available</span>
              </div>
              <p className="font-display font-bold text-2xl text-[#F1F5F9]">Tradescope EA</p>
              <p className="text-[#64748B] text-sm mt-1">Automated MT4 / MT5 robot</p>
            </div>
            <div className="text-right">
              <p className="font-display font-bold text-3xl text-[#F0B429]">$15</p>
              <p className="text-[#64748B] text-xs">for 14 days</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {[
              { label: "Platform", value: "MT4 / MT5" },
              { label: "Duration", value: "14 days" },
              { label: "Price", value: "$15 USD" },
              { label: "Payment", value: "Crypto (USDT/USDC)" },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[#64748B] text-[10px] uppercase tracking-wider">{label}</p>
                <p className="text-[#F1F5F9] text-sm font-semibold">{value}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => setModalOpen(true)}
            className="w-full py-3.5 rounded-[16px] bg-gradient-to-r from-[#6366F1] to-[#4F46E5] text-white font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-[#6366F1]/20"
          >
            <Bot className="w-4 h-4" />
            Rent for $15 — 2 Weeks
          </button>
        </div>

        {/* Features */}
        <div>
          <p className="text-[#64748B] text-xs font-medium uppercase tracking-wider mb-3">What's Included</p>
          <div className="flex flex-col gap-2">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3 p-3 rounded-xl bg-[#0D1117] border border-[#1E2736]">
                <div className="w-8 h-8 rounded-xl bg-[#6366F1]/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-[#6366F1]" />
                </div>
                <div>
                  <p className="text-[#F1F5F9] text-sm font-semibold">{label}</p>
                  <p className="text-[#64748B] text-xs mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-4 space-y-3">
          <p className="text-[#F1F5F9] font-semibold text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#10B981]" />
            How It Works
          </p>
          {[
            { n: "1", title: "Select Crypto & Pay", desc: "Choose USDT or USDC and send $15 to admin's wallet." },
            { n: "2", title: "Submit Your Order", desc: "Provide your Telegram username so admin can reach you." },
            { n: "3", title: "Receive EA File", desc: "Admin DMs you the .ex4/.ex5 file within 1–24 hours." },
            { n: "4", title: "Attach & Trade", desc: "Drop the file into MT4/MT5 Expert Advisors and let it run." },
          ].map((s) => (
            <div key={s.n} className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-[#F0B429]/20 text-[#F0B429] font-bold text-xs flex items-center justify-center shrink-0">{s.n}</div>
              <div>
                <p className="text-[#F1F5F9] text-sm font-medium">{s.title}</p>
                <p className="text-[#64748B] text-xs mt-0.5">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 p-3">
          <p className="text-[#F59E0B] text-xs font-semibold">⚠️ Important</p>
          <p className="text-[#F59E0B]/80 text-xs mt-1">Only send payment after submitting your order. Always verify the wallet address before sending. Admin will never ask you to pay outside this process.</p>
        </div>

        <div className="pb-8" />
      </div>

      <AnimatePresence>
        {modalOpen && <RentalModal onClose={() => setModalOpen(false)} />}
      </AnimatePresence>
    </>
  );
}
