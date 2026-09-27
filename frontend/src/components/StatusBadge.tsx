const STATUS_CONFIG: Record<string, { border: string; bg: string; text: string; dot: string }> = {
  running: {
    border: "border-cyan-500/40",
    bg: "bg-cyan-500/10",
    text: "text-cyan-300",
    dot: "bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse",
  },
  awaiting_approval: {
    border: "border-purple-500/40",
    bg: "bg-purple-500/10",
    text: "text-purple-300",
    dot: "bg-purple-400 shadow-[0_0_8px_#c084fc] animate-pulse",
  },
  awaiting_user_input: {
    border: "border-amber-500/40",
    bg: "bg-amber-500/10",
    text: "text-amber-300",
    dot: "bg-amber-400 shadow-[0_0_8px_#fbbf24] animate-pulse",
  },
  completed: {
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/10",
    text: "text-emerald-300",
    dot: "bg-emerald-400 shadow-[0_0_6px_#34d399]",
  },
  failed: {
    border: "border-red-500/40",
    bg: "bg-red-500/10",
    text: "text-red-300",
    dot: "bg-red-400 shadow-[0_0_6px_#f87171]",
  },
  rejected: {
    border: "border-slate-600/40",
    bg: "bg-slate-800/40",
    text: "text-slate-400",
    dot: "bg-slate-500",
  },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? {
    border: "border-slate-500/30",
    bg: "bg-slate-800/20",
    text: "text-slate-300",
    dot: "bg-slate-400",
  };

  return (
    <span
      className={`inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[0.7rem] font-semibold capitalize backdrop-blur-sm ${cfg.border} ${cfg.bg} ${cfg.text}`}
    >
      <span className={`h-1.5 w-1.5 flex-none rounded-full ${cfg.dot}`} />
      {status.replace(/_/g, " ")}
    </span>
  );
}
