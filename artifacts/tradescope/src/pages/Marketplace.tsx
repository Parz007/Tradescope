import { useState, useEffect, useRef, useCallback } from "react";
import { useAppContext } from "@/lib/AppContext";
import { ChevronDown, ChevronUp, ChevronLeft, Copy, Check, ShoppingBag, Shield, Zap, ArrowRight, X, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { useLocation } from "wouter";
import { useTelegramBackButton } from "@/hooks/useTelegramBackButton";

interface Listing {
  id: string;
  accountSize: number;
  accountType: string;
  priceUsd: number;
  title: string;
  description: string | null;
  leverage: string | null;
  maxDailyLoss: string | null;
  maxLoss: string | null;
  profitSplit: string | null;
  platform: string | null;
  status: string;
  featured: number;
}

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

function formatAccountSize(size: number): string {
  return size >= 1000 ? `$${size / 1000}K` : `$${size}`;
}

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

function HowItWorksSection() {
  const [open, setOpen] = useState(false);
  const steps = [
    { n: "1", title: "Browse & Select", desc: "Choose an FTMO account that fits your trading style and capital needs." },
    { n: "2", title: "Send Crypto Payment", desc: "Send the exact USD-equivalent amount to the admin's crypto wallet. BTC, ETH, or USDT accepted." },
    { n: "3", title: "Submit Proof", desc: "Share your transaction ID and Telegram contact so admin can verify your payment." },
    { n: "4", title: "Receive Account", desc: "Admin verifies payment on-chain (usually within 1–24hrs) and sends you the FTMO login credentials via Telegram DM." },
    { n: "5", title: "Start Trading", desc: "Log in, verify account details, and start trading your funded account. Admin holds escrow until you confirm receipt." },
  ];

  return (
    <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#10B981]" />
          <span className="text-[#F1F5F9] font-semibold text-sm">How Escrow Works</span>
          <span className="text-xs bg-[#10B981]/20 text-[#10B981] px-2 py-0.5 rounded-full font-medium">Safe</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-[#64748B]" /> : <ChevronDown className="w-4 h-4 text-[#64748B]" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            transition={{ duration: 0.25 }} className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-[#1E2736]">
              <p className="text-[#64748B] text-xs mt-3">Admin acts as middleman — payment is verified before credentials are released.</p>
              {steps.map((s) => (
                <div key={s.n} className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#F0B429]/20 text-[#F0B429] font-bold text-xs flex items-center justify-center shrink-0">{s.n}</div>
                  <div>
                    <p className="text-[#F1F5F9] text-sm font-medium">{s.title}</p>
                    <p className="text-[#64748B] text-xs mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
              <div className="mt-3 p-3 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/20">
                <p className="text-[#F59E0B] text-xs font-semibold">⚠️ Important</p>
                <p className="text-[#F59E0B]/80 text-xs mt-1">Only send payment AFTER submitting your order. Always verify the wallet address before sending. Admin will never ask you to pay outside the app process.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const FTMO_LOGO = "https://i.8upload.com/image/5eab240c30940f0f/unnamed-1.jpg";

function ListingCard({ listing, onBuy }: { listing: Listing; onBuy: (l: Listing) => void }) {
  const isFeatured = listing.featured === 1;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-4 flex flex-col gap-3 ${
        isFeatured
          ? "bg-gradient-to-br from-[#0D1117] to-[#161024] border-[#F0B429]/40"
          : "bg-[#0D1117] border-[#1E2736]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* FTMO Logo */}
          <div className="w-11 h-11 rounded-xl overflow-hidden border border-[#1E2736] shrink-0 bg-white flex items-center justify-center">
            <img
              src={FTMO_LOGO}
              alt="FTMO"
              className="w-full h-full object-contain"
              loading="lazy"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-display font-bold text-2xl text-[#F0B429]">{formatAccountSize(listing.accountSize)}</span>
              {isFeatured && <span className="text-xs bg-[#F0B429]/20 text-[#F0B429] px-2 py-0.5 rounded-full font-semibold">⭐ Popular</span>}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                listing.accountType === "Swing"
                  ? "bg-[#6366F1]/20 text-[#6366F1]"
                  : "bg-[#3B82F6]/20 text-[#3B82F6]"
              }`}>{listing.accountType}</span>
              <span className="text-[#64748B] text-xs">{listing.platform}</span>
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="font-display font-bold text-xl text-[#F1F5F9]">${listing.priceUsd.toLocaleString()}</p>
          <p className="text-[#64748B] text-xs">USD · crypto</p>
        </div>
      </div>

      {listing.description && (
        <p className="text-[#94A3B8] text-xs leading-relaxed">{listing.description}</p>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {[
          { label: "Max Daily Loss", value: listing.maxDailyLoss },
          { label: "Max Loss", value: listing.maxLoss },
          { label: "Profit Split", value: listing.profitSplit },
          { label: "Leverage", value: listing.leverage },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-[#64748B] text-[10px] uppercase tracking-wider">{label}</p>
            <p className="text-[#F1F5F9] text-xs font-semibold">{value}</p>
          </div>
        ))}
      </div>

      {listing.status === "available" ? (
        <button
          onClick={() => onBuy(listing)}
          className="w-full py-3 rounded-[16px] bg-gradient-to-r from-[#F0B429] to-[#D97706] text-[#080B14] font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <ShoppingBag className="w-4 h-4" />
          Buy Account — ${listing.priceUsd.toLocaleString()}
        </button>
      ) : (
        <div className="w-full py-3 rounded-[16px] bg-[#1E2736] text-[#64748B] font-semibold text-center text-sm">
          {listing.status === "reserved" ? "⏳ Reserved" : "✅ Sold"}
        </div>
      )}
    </motion.div>
  );
}

function PurchaseModal({
  listing,
  onClose,
}: {
  listing: Listing;
  onClose: () => void;
}) {
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
    fetch("/api/marketplace/payment-info")
      .then((r) => r.json())
      .then((d) => setPaymentInfo(d as Record<string, PaymentInfo>))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (step === 2) {
      setTimeLeft(TIMER_SECONDS);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            return 0;
          }
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
  const timerUrgent = timeLeft <= 180;

  const crypto = CRYPTO_OPTIONS.find((c) => c.key === selectedCrypto);
  const wallet = selectedCrypto ? paymentInfo[selectedCrypto] : null;
  const address = wallet?.address ?? "";

  async function handleSubmitOrder() {
    if (!contact.trim()) { setError("Please enter your Telegram username so admin can reach you"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/marketplace/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: listing.id,
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
        {/* Full-screen processing overlay */}
        <AnimatePresence>
          {processingStep && (
            <motion.div
              key="processing-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#080B14] rounded-t-2xl gap-5"
            >
              <div className="relative w-16 h-16">
                <svg className="w-16 h-16 animate-spin" viewBox="0 0 64 64" fill="none">
                  <circle cx="32" cy="32" r="28" stroke="#1E2736" strokeWidth="4" />
                  <path d="M32 4a28 28 0 0128 28" stroke="#F0B429" strokeWidth="4" strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#F0B429]/20 to-[#D97706]/10 border border-[#F0B429]/30 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-[#F0B429]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="text-center">
                <p className="text-[#F1F5F9] font-semibold text-sm">Preparing payment</p>
                <p className="text-[#64748B] text-xs mt-1">Setting up your secure session…</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#1E2736]" />
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#64748B] text-xs uppercase tracking-wider">Purchasing</p>
              <p className="font-display font-bold text-lg text-[#F1F5F9]">{listing.title}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#1E2736] flex items-center justify-center">
              <X className="w-4 h-4 text-[#64748B]" />
            </button>
          </div>

          {/* Steps */}
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-all ${s <= step ? "bg-[#F0B429]" : "bg-[#1E2736]"}`} />
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* Step 1: Select Crypto */}
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-3">
                <p className="text-[#F1F5F9] font-semibold">Select Payment Method</p>
                <p className="text-[#64748B] text-xs">All payments handled in crypto. You'll send the USD equivalent to admin's wallet.</p>
                {CRYPTO_OPTIONS.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setSelectedCrypto(c.key)}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      selectedCrypto === c.key ? "border-[#F0B429] bg-[#F0B429]/5" : "border-[#1E2736] bg-[#0D1117]"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full overflow-hidden" style={{ backgroundColor: `${c.color}22` }}>
                      <img src={c.logo} alt={c.label} className="w-full h-full object-cover rounded-full" />
                    </div>
                    <div className="text-left">
                      <p className="text-[#F1F5F9] font-semibold text-sm">{c.label}</p>
                      <p className="text-[#64748B] text-xs">{c.symbol}</p>
                    </div>
                    {selectedCrypto === c.key && <Check className="w-4 h-4 text-[#F0B429] ml-auto" />}
                  </button>
                ))}
                <button
                  onClick={() => {
                    if (!selectedCrypto) { setError("Please select a payment method"); return; }
                    setProcessingStep(true);
                    setTimeout(() => { setProcessingStep(false); setStep(2); }, 1800);
                  }}
                  disabled={!selectedCrypto || processingStep}
                  className="w-full py-3.5 rounded-[16px] bg-[#F0B429] text-[#080B14] font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-40 mt-2"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
                {error && <p className="text-[#EF4444] text-xs text-center">{error}</p>}
              </motion.div>
            )}

            {/* Step 2: Payment Instructions */}
            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full overflow-hidden" style={{ backgroundColor: `${crypto?.color}22` }}>
                      <img src={crypto?.logo} alt={crypto?.label} className="w-full h-full object-cover rounded-full" />
                    </div>
                    <div>
                      <p className="text-[#F1F5F9] font-semibold text-sm">Send Payment</p>
                      <p className="text-[#64748B] text-xs">{wallet?.network}</p>
                    </div>
                  </div>
                  {/* Countdown Timer */}
                  <motion.div
                    animate={timerUrgent ? { scale: [1, 1.05, 1] } : { scale: 1 }}
                    transition={timerUrgent ? { repeat: Infinity, duration: 0.8 } : { duration: 0 }}
                    className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 border"
                    style={{ backgroundColor: `${timerColor}15`, borderColor: `${timerColor}40` }}
                  >
                    <Clock className="w-3.5 h-3.5" style={{ color: timerColor }} />
                    <span className="font-mono text-sm font-bold" style={{ color: timerColor }}>
                      {timerExpired ? "EXPIRED" : `${timerMins}:${timerSecs}`}
                    </span>
                  </motion.div>
                </div>

                {/* Expired warning */}
                {timerExpired && (
                  <div className="rounded-xl border border-[#EF4444]/40 bg-[#EF4444]/10 p-4 text-center">
                    <p className="text-[#EF4444] font-semibold text-sm">⏰ Payment window expired</p>
                    <p className="text-[#EF4444]/70 text-xs mt-1">Go back and start a new purchase to get a fresh 45-minute window.</p>
                    <button onClick={() => setStep(1)} className="mt-3 px-4 py-2 rounded-xl bg-[#EF4444]/20 text-[#EF4444] text-xs font-semibold">
                      Go Back
                    </button>
                  </div>
                )}

                {/* Amount */}
                <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-4 text-center">
                  <p className="text-[#64748B] text-xs mb-1">Amount to Send (USD equivalent)</p>
                  <p className="font-display font-bold text-3xl text-[#F0B429]">${listing.priceUsd.toLocaleString()}</p>
                  <p className="text-[#64748B] text-xs mt-1">Send ${listing.priceUsd.toLocaleString()} worth of {crypto?.symbol} at current rate</p>
                </div>

                {/* Address + QR */}
                <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[#64748B] text-xs uppercase tracking-wider">Send To Address</p>
                    {address && <CopyButton text={address} />}
                  </div>
                  {address ? (
                    <>
                      {/* QR Code */}
                      <div className="flex justify-center mb-3">
                        <div className="p-3 rounded-xl bg-white shadow-lg">
                          <QRCodeSVG
                            value={address}
                            size={160}
                            bgColor="#ffffff"
                            fgColor="#080B14"
                            level="M"
                            includeMargin={false}
                          />
                        </div>
                      </div>
                      <p className="text-[#64748B] text-xs text-center mb-2">Scan with your crypto wallet app</p>
                      {/* Address text */}
                      <div className="rounded-lg bg-[#161B27] border border-[#1E2736] p-3">
                        <p className="text-[#F1F5F9] text-xs font-mono break-all leading-relaxed text-center">{address}</p>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-[#64748B] text-sm">Contact admin for payment address</p>
                      <p className="text-[#64748B] text-xs mt-1">Admin hasn't configured the wallet address yet. DM admin on Telegram to proceed.</p>
                    </div>
                  )}
                </div>

                <div className="rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/20 p-3">
                  <p className="text-[#F59E0B] text-xs">⚠️ Only send to this address. Double-check before confirming. Crypto payments are irreversible.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setStep(1)} className="py-3 rounded-[16px] border border-[#1E2736] text-[#64748B] font-semibold text-sm active:scale-95 transition-transform">
                    Back
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    disabled={timerExpired}
                    className="py-3 rounded-[16px] font-bold text-sm transition-all flex items-center justify-center gap-1"
                    style={timerExpired
                      ? { backgroundColor: "#1E2736", color: "#64748B", cursor: "not-allowed" }
                      : { backgroundColor: "#F0B429", color: "#080B14" }
                    }
                  >
                    I've Sent It <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Submit Proof */}
            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-4">
                <div>
                  <p className="text-[#F1F5F9] font-semibold">Submit Your Order</p>
                  <p className="text-[#64748B] text-xs mt-1">Provide your contact and transaction details so admin can verify and complete your order.</p>
                </div>

                <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-4 space-y-3">
                  <div>
                    <label className="text-[#F1F5F9] text-sm font-medium block mb-1.5">Your Telegram Username <span className="text-[#EF4444]">*</span></label>
                    <input
                      type="text"
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      placeholder="@yourusername"
                      className="w-full bg-[#161B27] border border-[#1E2736] text-[#F1F5F9] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#F0B429]"
                    />
                    <p className="text-[#64748B] text-xs mt-1">Admin will DM you on Telegram to deliver the account credentials</p>
                  </div>
                  <div>
                    <label className="text-[#F1F5F9] text-sm font-medium block mb-1.5">Transaction Hash <span className="text-[#64748B] text-xs font-normal">(optional)</span></label>
                    <input
                      type="text"
                      value={txHash}
                      onChange={(e) => setTxHash(e.target.value)}
                      placeholder="0x... or txid..."
                      className="w-full bg-[#161B27] border border-[#1E2736] text-[#F1F5F9] rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#F0B429]"
                    />
                    <p className="text-[#64748B] text-xs mt-1">Speeds up verification — paste your transaction ID from your crypto wallet</p>
                  </div>
                </div>

                {/* Order Summary */}
                <div className="rounded-xl bg-[#0D1117] border border-[#1E2736] p-4 space-y-2">
                  <p className="text-[#64748B] text-xs uppercase tracking-wider font-medium">Order Summary</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#94A3B8]">Account</span>
                    <span className="text-[#F1F5F9] font-semibold">{listing.title}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#94A3B8]">Payment</span>
                    <span className="text-[#F1F5F9] font-semibold">{crypto?.label}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#94A3B8]">Amount</span>
                    <span className="text-[#F0B429] font-bold">${listing.priceUsd.toLocaleString()} USD</span>
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

            {/* Step 4: Confirmation */}
            {step === 4 && (
              <motion.div key="s4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="w-16 h-16 rounded-full bg-[#10B981]/20 flex items-center justify-center">
                  <Check className="w-8 h-8 text-[#10B981]" />
                </div>
                <div>
                  <p className="font-display font-bold text-xl text-[#F1F5F9]">Order Submitted!</p>
                  <p className="text-[#64748B] text-sm mt-1">Your order is being reviewed</p>
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
                    "Admin reviews your payment on-chain",
                    "Verification typically takes 1–24 hours",
                    "Admin will DM you on Telegram with credentials",
                    "Confirm receipt before admin releases escrow",
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

const SIZE_FILTERS = ["All", "10K", "25K", "50K", "100K", "200K"];

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Marketplace() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [sizeFilter, setSizeFilter] = useState("All");
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [, setLocation] = useLocation();
  const handleBack = useCallback(() => setLocation("/"), [setLocation]);
  useTelegramBackButton(handleBack);

  const loadListings = useCallback(() => {
    setLoading(true);
    setFetchError(false);
    fetch(`${BASE_URL}/api/marketplace/listings`)
      .then((r) => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then((d) => { setListings(d as Listing[]); setLoading(false); })
      .catch(() => { setFetchError(true); setLoading(false); });
  }, []);

  useEffect(() => { loadListings(); }, [loadListings]);

  const filtered = listings.filter((l) => {
    if (sizeFilter === "All") return true;
    const size = parseInt(sizeFilter) * 1000;
    return l.accountSize === size;
  });

  const available = filtered.filter((l) => l.status === "available");
  const unavailable = filtered.filter((l) => l.status !== "available");

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
          <div className="w-10 h-10 rounded-xl bg-[#F0B429]/20 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-5 h-5 text-[#F0B429]" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-[#F1F5F9]">FTMO Accounts</h1>
            <p className="text-[#64748B] text-xs">Live funded accounts · Crypto payments</p>
          </div>
        </div>

        {/* How It Works */}
        <HowItWorksSection />

        {/* Filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {SIZE_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setSizeFilter(f)}
              className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap shrink-0 transition-all active:scale-95 ${
                sizeFilter === f ? "bg-[#F0B429] text-[#080B14]" : "bg-[#0D1117] border border-[#1E2736] text-[#64748B]"
              }`}
            >
              {f === "All" ? "All Sizes" : `$${f}`}
            </button>
          ))}
        </div>

        {/* Listings */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-[#F0B429]/30 border-t-[#F0B429] animate-spin" />
          </div>
        ) : fetchError ? (
          <div className="text-center py-12">
            <Zap className="w-10 h-10 text-[#EF4444]/60 mx-auto mb-3" />
            <p className="text-[#64748B] text-sm mb-4">Couldn't load accounts</p>
            <button
              onClick={loadListings}
              className="px-5 py-2.5 rounded-xl bg-[#F0B429] text-[#080B14] text-sm font-bold active:scale-95 transition-transform"
            >
              Try again
            </button>
          </div>
        ) : available.length === 0 && unavailable.length === 0 ? (
          <div className="text-center py-12">
            <Zap className="w-10 h-10 text-[#64748B] mx-auto mb-3" />
            <p className="text-[#64748B]">No accounts available in this size</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {available.map((l) => <ListingCard key={l.id} listing={l} onBuy={setSelectedListing} />)}
            {unavailable.length > 0 && (
              <>
                <p className="text-[#64748B] text-xs uppercase tracking-wider font-medium mt-2">Sold / Reserved</p>
                {unavailable.map((l) => <ListingCard key={l.id} listing={l} onBuy={() => {}} />)}
              </>
            )}
          </div>
        )}

        <div className="pb-8" />
      </div>

      <AnimatePresence>
        {selectedListing && (
          <PurchaseModal listing={selectedListing} onClose={() => setSelectedListing(null)} />
        )}
      </AnimatePresence>
    </>
  );
}
