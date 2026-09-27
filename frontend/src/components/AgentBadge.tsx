export type AgentKind = "planner" | "executor" | "replanner" | "user" | "system";

const LABELS: Record<AgentKind, string> = {
  planner: "Planner",
  executor: "Executor",
  replanner: "Replanner",
  user: "You",
  system: "System",
};

const STYLES: Record<AgentKind, string> = {
  planner: "border-blue-500/40 bg-blue-500/10 text-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.25)]",
  executor: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.25)]",
  replanner: "border-amber-500/40 bg-amber-500/10 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.3)]",
  user: "border-purple-500/40 bg-purple-500/10 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.25)]",
  system: "border-slate-500/40 bg-slate-500/10 text-slate-300 shadow-[0_0_8px_rgba(148,163,184,0.2)]",
};

export function AgentBadge({ kind, label }: { kind: AgentKind; label?: string }) {
  return (
    <span
      className={`inline-flex flex-none items-center rounded-full border px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider transition-all ${STYLES[kind]}`}
    >
      {label ?? LABELS[kind]}
    </span>
  );
}

// Maps a backend EventType to which "agent" conceptually produced it, so the
// chat timeline reads as a hand-off between planner/executor/replanner
// (mirroring the orchestrator's actual decide -> execute -> replan loop)
// rather than a flat list of opaque event names.
export function agentForEvent(eventType: string): AgentKind {
  switch (eventType) {
    case "PLAN_CREATED":
    case "APPROVAL_REQUIRED":
      return "planner";
    case "TOOL_CALLED":
    case "TOOL_RESULT":
    case "STEP_COMPLETED":
      return "executor";
    case "REPLANNING":
      return "replanner";
    case "USER_INPUT_REQUIRED":
    case "USER_APPROVED":
    case "USER_REJECTED":
      return "user";
    default:
      return "system";
  }
}
