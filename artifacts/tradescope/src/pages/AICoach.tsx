import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, User, BrainCircuit, RotateCcw, ChevronRight, ImagePlus, X,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  streaming?: boolean;
}

interface PendingImage {
  base64: string;
  mimeType: string;
  previewUrl: string;
}

const SUGGESTED = [
  "📸 Upload a chart for AI analysis",
  "What's the best risk management for prop firms?",
  "Explain ICT order blocks and fair value gaps",
  "How do I identify a BOS vs CHoCH?",
  "When should I avoid trading?",
  "How to manage emotions after a loss?",
];

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function AICoach() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8_000_000) {
      alert("Image too large — please use an image under 8 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      setPendingImage({ base64, mimeType: file.type, previewUrl: dataUrl });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const send = useCallback(async (text: string, overrideImage?: PendingImage | null) => {
    const trimmed = text.trim();
    const img = overrideImage !== undefined ? overrideImage : pendingImage;

    if ((!trimmed && !img) || streaming) return;

    const displayText = trimmed || "Analyze this chart for trading opportunities.";
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: displayText,
      imageUrl: img?.previewUrl,
    };
    const assistantId = crypto.randomUUID();

    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: "assistant", content: "", streaming: true },
    ]);
    setInput("");
    setPendingImage(null);
    setStreaming(true);

    // Build history for API — text only (no image data urls in history)
    const history = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    abortRef.current = new AbortController();

    try {
      const body: Record<string, unknown> = { messages: history };
      if (img) {
        body.imageBase64 = img.base64;
        body.mimeType = img.mimeType;
      }

      const res = await fetch(`${BASE_URL}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data) as { content?: string; error?: string };
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.content) {
              full += parsed.content;
              setMessages((prev) =>
                prev.map((m) => m.id === assistantId ? { ...m, content: full } : m)
              );
            }
          } catch { /* skip bad chunks */ }
        }
      }

      setMessages((prev) =>
        prev.map((m) => m.id === assistantId ? { ...m, streaming: false } : m)
      );
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "⚠️ Failed to get a response. Please try again.", streaming: false }
            : m
        )
      );
    } finally {
      setStreaming(false);
    }
  }, [messages, streaming, pendingImage]);

  const handleSuggest = (s: string) => {
    if (s.startsWith("📸")) {
      fileRef.current?.click();
    } else {
      send(s);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const reset = () => {
    abortRef.current?.abort();
    setMessages([]);
    setStreaming(false);
    setInput("");
    setPendingImage(null);
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[#080B14]">
      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImagePick}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#1E2736]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#F0B429]/20 to-[#D97706]/10 border border-[#F0B429]/20 flex items-center justify-center">
            <BrainCircuit className="w-4 h-4 text-[#F0B429]" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-[#F1F5F9] leading-none">AI Coach</h1>
            <p className="text-[10px] text-[#64748B] mt-0.5">TradeScope AI · Chart analysis enabled</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={reset}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] text-[#64748B] hover:text-[#94A3B8] hover:bg-[#1E2736] transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            New chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center pt-4 pb-4">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-5"
            >
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-[#F0B429]/20 to-[#78350F]/30 border border-[#F0B429]/20 flex items-center justify-center">
                <BrainCircuit className="w-7 h-7 text-[#F0B429]" />
              </div>
              <h2 className="text-base font-semibold text-[#F1F5F9]">
                Ask or upload a chart
              </h2>
              <p className="text-xs text-[#64748B] mt-1 max-w-[260px] mx-auto">
                Send a screenshot and I'll identify setups, patterns, and entry zones.
              </p>
            </motion.div>

            <div className="w-full space-y-2">
              {SUGGESTED.map((s, i) => (
                <motion.button
                  key={s}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => handleSuggest(s)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border transition-all text-left group ${
                    s.startsWith("📸")
                      ? "bg-[#F0B429]/5 border-[#F0B429]/25 hover:bg-[#F0B429]/10 hover:border-[#F0B429]/50"
                      : "bg-[#0D1117] border-[#1E2736] hover:border-[#F0B429]/30 hover:bg-[#111827]"
                  }`}
                >
                  <span className={`text-xs transition-colors ${
                    s.startsWith("📸")
                      ? "text-[#F0B429] font-medium"
                      : "text-[#94A3B8] group-hover:text-[#F1F5F9]"
                  }`}>{s}</span>
                  <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                    s.startsWith("📸") ? "text-[#F0B429]/60" : "text-[#334155] group-hover:text-[#F0B429]"
                  }`} />
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* Avatar */}
                <div className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center mt-0.5 ${
                  msg.role === "user"
                    ? "bg-[#1E3A5F] border border-[#2563EB]/30"
                    : "bg-gradient-to-br from-[#F0B429]/20 to-[#78350F]/30 border border-[#F0B429]/20"
                }`}>
                  {msg.role === "user"
                    ? <User className="w-3.5 h-3.5 text-[#60A5FA]" />
                    : <BrainCircuit className="w-3.5 h-3.5 text-[#F0B429]" />
                  }
                </div>

                {/* Bubble */}
                <div className={`max-w-[78%] rounded-2xl overflow-hidden ${
                  msg.role === "user"
                    ? "bg-[#1E3A5F] border border-[#2563EB]/20 rounded-tr-sm"
                    : "bg-[#0D1117] border border-[#1E2736] rounded-tl-sm"
                }`}>
                  {/* Chart image preview */}
                  {msg.imageUrl && (
                    <div className="relative">
                      <img
                        src={msg.imageUrl}
                        alt="Chart"
                        className="w-full max-h-52 object-contain bg-[#0A0D16]"
                      />
                      <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/60 text-[9px] text-[#F0B429] font-medium">
                        Chart
                      </div>
                    </div>
                  )}
                  {/* Text */}
                  <div className={`px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user" ? "text-[#E2E8F0]" : "text-[#CBD5E1]"
                  }`}>
                    {msg.content || (
                      <span className="flex gap-1 items-center text-[#F0B429]/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#F0B429]/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-[#F0B429]/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-[#F0B429]/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                    )}
                    {msg.streaming && msg.content && (
                      <span className="inline-block w-0.5 h-3.5 bg-[#F0B429] ml-0.5 animate-pulse align-text-bottom" />
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="px-4 pb-4 pt-2 border-t border-[#1E2736]">
        {/* Image preview chip */}
        <AnimatePresence>
          {pendingImage && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.95 }}
              className="mb-2 flex items-center gap-2"
            >
              <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-[#F0B429]/30 shrink-0">
                <img src={pendingImage.previewUrl} alt="Chart" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/20" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-[#F0B429] font-medium">Chart ready for analysis</p>
                <p className="text-[9px] text-[#64748B] mt-0.5">Add a note or tap send to analyse</p>
              </div>
              <button
                onClick={() => setPendingImage(null)}
                className="w-6 h-6 rounded-full bg-[#1E2736] flex items-center justify-center hover:bg-[#374151] transition-colors"
              >
                <X className="w-3 h-3 text-[#94A3B8]" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-2 items-end">
          {/* Image button */}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={streaming}
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all disabled:opacity-30 ${
              pendingImage
                ? "bg-[#F0B429]/20 border border-[#F0B429]/40 text-[#F0B429]"
                : "bg-[#0D1117] border border-[#1E2736] text-[#475569] hover:border-[#F0B429]/30 hover:text-[#F0B429]"
            }`}
          >
            <ImagePlus className="w-4 h-4" />
          </button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={pendingImage ? "Add a note (optional)..." : "Ask about strategy, or upload a chart..."}
            rows={1}
            className="flex-1 resize-none bg-[#0D1117] border border-[#1E2736] focus:border-[#F0B429]/40 rounded-xl px-3.5 py-2.5 text-xs text-[#F1F5F9] placeholder-[#334155] outline-none transition-colors max-h-28 overflow-y-auto leading-relaxed"
            style={{ scrollbarWidth: "none" }}
          />

          <button
            onClick={() => send(input)}
            disabled={(!input.trim() && !pendingImage) || streaming}
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#F0B429] to-[#D97706] flex items-center justify-center shrink-0 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity active:scale-95"
          >
            <Send className="w-3.5 h-3.5 text-[#0D1117]" />
          </button>
        </div>
      </div>
    </div>
  );
}
