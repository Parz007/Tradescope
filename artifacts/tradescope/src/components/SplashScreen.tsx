import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import logoUrl from "../assets/logo.jpg";

const LOGO = 200;
const CORNER_R = 24;
const GAP = 22;
const RING_R = (LOGO / 2) * Math.SQRT2 + GAP;
const SVG_SIZE = (RING_R + 20) * 2;
const C = SVG_SIZE / 2;
const CIRC = 2 * Math.PI * RING_R;

// Rabbit dimensions (faces RIGHT → which = direction of travel when orbiting CW)
const RAB_W = 52;
const RAB_H = 36;
// Pivot so rabbit center sits exactly on the ring
const PIV_X = RAB_W / 2;
const PIV_Y = RING_R + RAB_H / 2;

// Floating gold dust particles
const DUST = [
  { id: 0, lx: 8,  ty: 18, sz: 1.8, dl: 0.4, dr: 4.0 },
  { id: 1, lx: 85, ty: 12, sz: 1.4, dl: 1.1, dr: 3.7 },
  { id: 2, lx: 72, ty: 80, sz: 2.0, dl: 0.2, dr: 4.6 },
  { id: 3, lx: 15, ty: 68, sz: 1.6, dl: 1.7, dr: 3.5 },
  { id: 4, lx: 92, ty: 50, sz: 1.3, dl: 0.8, dr: 4.2 },
  { id: 5, lx: 45, ty: 90, sz: 1.9, dl: 1.3, dr: 4.0 },
];

// Paw-print trail dots (fixed angular offsets behind the rabbit)
const TRAIL = [
  { id: 0, lag: 18, sz: 5, op: 0.35 },
  { id: 1, lag: 36, sz: 4, op: 0.22 },
  { id: 2, lag: 54, sz: 3, op: 0.12 },
];

function useBar(ms: number) {
  const [v, setV] = useState(0);
  const t0 = useRef<number | null>(null);
  const rf = useRef<number | null>(null);
  useEffect(() => {
    const tick = (now: number) => {
      if (!t0.current) t0.current = now;
      const t = Math.min((now - t0.current) / ms, 1);
      setV(Math.min((1 - Math.pow(1 - t, 2.8)) * 100, 95));
      if (t < 1) rf.current = requestAnimationFrame(tick);
    };
    rf.current = requestAnimationFrame(tick);
    return () => { if (rf.current) cancelAnimationFrame(rf.current); };
  }, [ms]);
  return v;
}

// SVG rabbit facing RIGHT — ear→head→body→tail left to right
// Legs animate externally via Framer motion wrappers
function RabbitBody({ legPhase }: { legPhase: number }) {
  // legPhase oscillates 0→1→0 for leg swing
  const frontY = Math.sin(legPhase * Math.PI * 2) * 4;
  const backY  = -frontY;

  return (
    <svg width={RAB_W} height={RAB_H} viewBox={`0 0 ${RAB_W} ${RAB_H}`} fill="none" style={{ display: "block" }}>
      {/* ── Ears ── */}
      {/* Back ear (slightly desaturated) */}
      <ellipse cx="35" cy="8" rx="4" ry="9" fill="#C78A10"
        transform="rotate(-12 35 8)" />
      {/* Front ear */}
      <ellipse cx="41" cy="6" rx="4" ry="9" fill="#F0B429"
        transform="rotate(8 41 6)" />
      {/* Inner ear pink */}
      <ellipse cx="41" cy="7" rx="2.2" ry="6" fill="#FBBF24"
        transform="rotate(8 41 7)" />

      {/* ── Body ── */}
      <ellipse cx="20" cy="24" rx="15" ry="9" fill="#F0B429" />

      {/* ── Head ── */}
      <circle cx="36" cy="22" r="11" fill="#FDE68A" />

      {/* ── Tail ── */}
      <circle cx="5" cy="22" r="5" fill="white" opacity="0.92" />
      <circle cx="5" cy="22" r="3" fill="#f5f5f5" />

      {/* ── Face ── */}
      {/* Eye */}
      <circle cx="40" cy="18" r="2.2" fill="#0a0500" />
      <circle cx="39.4" cy="17.4" r="0.8" fill="white" />
      {/* Nose */}
      <ellipse cx="46" cy="22" rx="2.2" ry="1.4" fill="#F87171" />
      {/* Mouth */}
      <path d="M44 23.5 Q46 25.5 48 23.5" stroke="#D97706" strokeWidth="0.8"
        strokeLinecap="round" fill="none" />
      {/* Cheek blush */}
      <ellipse cx="42" cy="22" rx="3" ry="1.8" fill="#FCA5A5" opacity="0.3" />

      {/* ── Front legs (near head) ── */}
      <ellipse cx="33" cy={30 + frontY} rx="3" ry="5" fill="#D97706" />
      <ellipse cx="27" cy={30 - frontY * 0.6} rx="3" ry="5" fill="#D97706" />

      {/* ── Back legs (near tail) ── */}
      <ellipse cx="16" cy={30 + backY} rx="3.5" ry="5" fill="#B45309" />
      <ellipse cx="9"  cy={30 - backY * 0.6} rx="3" ry="5" fill="#B45309" />
    </svg>
  );
}

export default function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(false);
  const [legPhase, setLegPhase] = useState(0);
  const bar = useBar(4600);

  // Leg animation loop — 6 strides/sec while revealed
  const legRef = useRef<number | null>(null);
  const legT0  = useRef<number | null>(null);
  useEffect(() => {
    if (!revealed) return;
    const loop = (now: number) => {
      if (!legT0.current) legT0.current = now;
      setLegPhase(((now - legT0.current) / 160) % 1);
      legRef.current = requestAnimationFrame(loop);
    };
    legRef.current = requestAnimationFrame(loop);
    return () => { if (legRef.current) cancelAnimationFrame(legRef.current); };
  }, [revealed]);

  useEffect(() => {
    const a = setTimeout(() => setRevealed(true), 400);
    const b = setTimeout(() => setDone(true), 4650);
    const c = setTimeout(() => onComplete(), 5000);
    return () => { clearTimeout(a); clearTimeout(b); clearTimeout(c); };
  }, [onComplete]);

  const pct = done ? 100 : bar;

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          key="splash"
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden select-none"
          style={{ backgroundColor: "#080B14" }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: "easeIn" }}
        >
          {/* Gold dust particles */}
          {DUST.map((p) => (
            <motion.span
              key={p.id}
              className="absolute rounded-full pointer-events-none"
              style={{ left: `${p.lx}%`, top: `${p.ty}%`, width: p.sz, height: p.sz, backgroundColor: "#F0B429" }}
              initial={{ opacity: 0, y: 0 }}
              animate={{ opacity: [0, 0.25, 0], y: [0, -60, -120] }}
              transition={{ duration: p.dr, delay: p.dl, repeat: Infinity, ease: "easeInOut" }}
            />
          ))}

          {/* Radial bloom */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse 55% 50% at 50% 46%, rgba(240,180,41,0.10) 0%, transparent 65%)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: revealed ? 1 : 0.15 }}
            transition={{ duration: 1.0 }}
          />

          {/* ── Hero ring + rabbit ── */}
          <div className="relative flex items-center justify-center" style={{ width: SVG_SIZE, height: SVG_SIZE }}>

            {/* Gold ring */}
            <div className="absolute inset-0 pointer-events-none" style={{ transform: "rotate(-90deg)" }}>
              <svg width={SVG_SIZE} height={SVG_SIZE} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}>
                {/* Ghost track */}
                <circle cx={C} cy={C} r={RING_R} fill="none" stroke="rgba(240,180,41,0.08)" strokeWidth={1.5} />
                {/* Animated arc */}
                <motion.circle
                  cx={C} cy={C} r={RING_R}
                  fill="none" stroke="url(#rg)" strokeWidth={2}
                  strokeLinecap="round"
                  strokeDasharray={CIRC}
                  initial={{ strokeDashoffset: CIRC, opacity: 0 }}
                  animate={revealed ? { strokeDashoffset: 0, opacity: 1 } : { strokeDashoffset: CIRC, opacity: 0 }}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.06 }}
                />
                <defs>
                  <linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%"   stopColor="#78350F" />
                    <stop offset="50%"  stopColor="#F0B429" />
                    <stop offset="100%" stopColor="#FDE68A" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* ── Paw-print glow trail (3 dots behind rabbit) ── */}
            {revealed && TRAIL.map((t) => (
              <motion.div
                key={t.id}
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: t.sz, height: t.sz,
                  backgroundColor: "#F0B429",
                  boxShadow: `0 0 6px 3px rgba(240,180,41,${t.op * 1.2})`,
                  top: "50%", left: "50%",
                  marginTop: -(RING_R + t.sz / 2),
                  marginLeft: -(t.sz / 2),
                  transformOrigin: `${t.sz / 2}px ${RING_R + t.sz / 2}px`,
                  opacity: t.op,
                }}
                initial={{ rotate: -t.lag }}
                animate={{ rotate: 720 - t.lag }}
                transition={{ duration: 5, ease: "linear" }}
              />
            ))}

            {/* ── Running rabbit ── */}
            {revealed && (
              <motion.div
                style={{
                  position: "absolute",
                  top: "50%", left: "50%",
                  marginTop: -(RING_R + RAB_H / 2),
                  marginLeft: -(PIV_X),
                  transformOrigin: `${PIV_X}px ${PIV_Y}px`,
                  width: RAB_W,
                  filter: "drop-shadow(0 0 8px rgba(240,180,41,0.60))",
                }}
                initial={{ rotate: 0, opacity: 0 }}
                animate={{ rotate: 720, opacity: [0, 1, 1, 0.8] }}
                transition={{
                  rotate:  { duration: 5, ease: "linear" },
                  opacity: { duration: 0.4, delay: 0.15, times: [0, 0.08, 0.85, 1] },
                }}
              >
                {/* Vertical hop */}
                <motion.div
                  animate={{ y: [0, -5, 0, -3, 0] }}
                  transition={{ duration: 0.32, repeat: Infinity, ease: "easeInOut" }}
                >
                  <RabbitBody legPhase={legPhase} />
                </motion.div>
              </motion.div>
            )}

            {/* ── Logo box ── */}
            <motion.div
              style={{
                width: LOGO, height: LOGO,
                borderRadius: CORNER_R,
                overflow: "hidden",
                position: "relative",
                boxShadow: "0 0 0 1px rgba(240,180,41,0.15)",
              }}
              initial={{ clipPath: "inset(50% 0% 50% 0% round 50%)" }}
              animate={{ clipPath: `inset(0% 0% 0% 0% round ${CORNER_R}px)` }}
              transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
            >
              <img
                src={logoUrl}
                alt=""
                draggable={false}
                style={{
                  width: "100%", height: "100%",
                  objectFit: "contain",
                  objectPosition: "center",
                  display: "block",
                  pointerEvents: "none",
                  backgroundColor: "#000",
                }}
              />
              {/* Scan-line shimmer */}
              <motion.div
                style={{
                  position: "absolute", inset: 0,
                  background: "linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.05) 46%, rgba(255,255,255,0.28) 50%, rgba(255,255,255,0.05) 54%, transparent 100%)",
                  pointerEvents: "none",
                }}
                initial={{ y: "0%" }}
                animate={{ y: "-115%" }}
                transition={{ duration: 0.52, ease: "easeIn" }}
              />
            </motion.div>

            {/* Impact bloom */}
            <motion.div
              className="absolute pointer-events-none"
              style={{
                width: LOGO, height: LOGO,
                borderRadius: CORNER_R,
                background: "radial-gradient(circle, rgba(240,180,41,0.50) 0%, transparent 68%)",
              }}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={revealed ? { opacity: [0.65, 0], scale: [0.92, 1.35] } : { opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
            />
          </div>

          {/* Tagline */}
          <motion.p
            style={{
              marginTop: 24, fontSize: 10, color: "#3D5166",
              letterSpacing: "0.22em", textTransform: "uppercase",
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: revealed ? 1 : 0, y: revealed ? 0 : 10 }}
            transition={{ delay: 0.25, duration: 0.5, ease: "easeOut" }}
          >
            AI · Forex · Real-time
          </motion.p>

          {/* Progress bar */}
          <div className="absolute left-10 right-10" style={{ bottom: 54 }}>
            <div style={{ height: 2, borderRadius: 999, backgroundColor: "rgba(240,180,41,0.07)", position: "relative", overflow: "visible" }}>
              <div style={{
                position: "absolute", top: 0, left: 0, bottom: 0,
                width: `${pct}%`, borderRadius: 999,
                background: "linear-gradient(90deg, #78350F, #D97706, #F0B429, #FDE68A)",
                boxShadow: "0 0 10px rgba(240,180,41,0.50)",
                transition: "width 80ms linear",
              }} />
              <div style={{
                position: "absolute", top: "50%", left: `${pct}%`,
                width: 7, height: 7, borderRadius: "50%",
                backgroundColor: "#FDE68A",
                boxShadow: "0 0 10px 4px rgba(240,180,41,0.65)",
                transform: "translate(-50%, -50%)",
                transition: "left 80ms linear",
              }} />
            </div>
          </div>

          {/* Footer */}
          <motion.p
            className="absolute"
            style={{ bottom: 24, fontSize: 10, color: "#1A2535", fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: "0.04em" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.0, duration: 0.7 }}
          >
            Powered by AI · Real-time Forex Analysis
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
