import type { PlanDecision, WorkflowPlan } from "../types";
import { AgentBadge } from "./AgentBadge";

export function PlanSteps({
  steps,
  completedObjectives = [],
  currentObjective = null,
  live = false,
}: {
  steps: WorkflowPlan["steps"];
  completedObjectives?: string[];
  currentObjective?: string | null;
  live?: boolean;
}) {
  return (
    <ol className="flex flex-col gap-2">
      {steps.map((step) => {
        const status = completedObjectives.includes(step.id)
          ? "done"
          : live && step.id === currentObjective
            ? "active"
            : "pending";
        return (
          <li key={step.id} className="flex items-start gap-2.5 text-[0.86rem] transition-colors">
            <span
              className={`relative top-[3px] flex h-4 w-4 flex-none items-center justify-center rounded border transition-all ${
                status === "done"
                  ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                  : status === "active"
                    ? "animate-pulse border-amber-500 bg-amber-500 text-white shadow-sm"
                    : "border-slate-400 bg-white text-transparent"
              }`}
            >
              {status === "done" ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
              )}
            </span>
            <span className={status === "done" ? "text-slate-900 font-semibold" : status === "active" ? "text-amber-900 font-bold" : "text-slate-700 font-medium"}>
              {step.objective}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function PlanCard({
  plan,
  decision,
  completedObjectives = [],
  currentObjective = null,
  live = false,
  busy = false,
  onApprove,
  onReject,
}: {
  plan: WorkflowPlan;
  decision: PlanDecision;
  completedObjectives?: string[];
  currentObjective?: string | null;
  live?: boolean;
  busy?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  const done = completedObjectives.length;
  return (
    <div className="glow-card rounded-2xl border border-amber-300/40 p-4 shadow-md bg-white/90">
      <div className="flex flex-wrap items-center gap-2.5 pb-2.5 border-b border-amber-200/60">
        <AgentBadge kind="planner" />
        <span className="text-sm font-bold text-slate-900">{plan.goal}</span>
        {plan.steps.length > 0 && (
          <span className="ml-auto rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-xs font-bold text-slate-800">
            {done} / {plan.steps.length}
          </span>
        )}
      </div>
      <div className="mt-3">
        <PlanSteps steps={plan.steps} completedObjectives={completedObjectives} currentObjective={currentObjective} live={live} />
      </div>

      {decision === "pending" && onApprove && onReject && (
        <div className="mt-4 flex gap-2.5 pt-2.5 border-t border-amber-200/60">
          <button onClick={onApprove} disabled={busy} className="glow-btn rounded-xl px-5 py-2 text-xs font-bold uppercase tracking-wider text-white">
            Approve Plan
          </button>
          <button
            onClick={onReject}
            disabled={busy}
            className="hairline rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-all hover:bg-slate-100 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}
      {decision === "rejected" && <p className="mt-2.5 text-xs font-semibold text-slate-600">Plan rejected — execution stopped.</p>}
    </div>
  );
}
