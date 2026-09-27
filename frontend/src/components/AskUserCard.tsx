import { useState } from "react";
import { AgentBadge } from "./AgentBadge";

export function AskUserCard({
  question,
  options,
  busy,
  onRespond,
}: {
  question: string;
  options: string[];
  busy: boolean;
  onRespond: (answer: string) => void;
}) {
  const [custom, setCustom] = useState("");

  return (
    <div className="glow-card mt-3 rounded-2xl p-4 border border-amber-400/40 shadow-lg bg-white/90">
      <AgentBadge kind="user" label="Input needed" />
      <p className="mt-2 text-sm font-semibold text-slate-900 leading-snug">{question}</p>
      {options.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {options.map((opt) => (
            <button
              key={opt}
              disabled={busy}
              onClick={() => onRespond(opt)}
              className="rounded-xl border border-amber-400/50 bg-amber-50 px-3.5 py-1.5 text-xs font-semibold text-slate-900 transition-all hover:bg-amber-100 hover:shadow-md disabled:opacity-50"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (custom.trim()) onRespond(custom.trim());
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Or type your own answer..."
          disabled={busy}
          className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none disabled:opacity-50"
        />
        <button type="submit" disabled={busy || !custom.trim()} className="glow-btn rounded-xl px-4 py-2 text-xs font-bold text-white">
          Send
        </button>
      </form>
    </div>
  );
}
