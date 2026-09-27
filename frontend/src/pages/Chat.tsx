import { useEffect, useLayoutEffect, useRef, useState } from "react";
import logo from "../assets/logo.png";
import { api, wsUrl } from "../services/api";
import type { AgentStateSnapshot, ChatMessage, ExecutionEvent, PlanDecision, WorkflowRun } from "../types";
import { PlanCard } from "../components/PlanCard";
import { AskUserCard } from "../components/AskUserCard";
import { Timeline } from "../components/Timeline";
import { FloatingWidgets } from "../components/WidgetPanel";
import { StatusBadge } from "../components/StatusBadge";
import { useMediaQuery, useWidgetLayout } from "../widgetLayout";

const LIVE_STATUSES = new Set(["pending", "awaiting_approval", "running", "paused", "awaiting_user_input"]);
const REFRESH_ON = new Set(["TOOL_RESULT", "STEP_COMPLETED", "REPLANNING", "WORKFLOW_COMPLETED", "WORKFLOW_FAILED"]);

const EXAMPLE_GOALS = [
  "Process today's internship applications and notify the hiring team",
  "Check the candidate tracker for duplicate entries",
];

const DOCK_TRANSITION = "transform 620ms cubic-bezier(0.22, 1, 0.36, 1)";

function newRunMessage(runId: string, plan: ChatMessage["plan"], approvalId: string | null, status: string): ChatMessage {
  return { role: "assistant", runId, plan, approvalId, decision: "pending", events: [], status, askUser: null };
}

function SendButton({ disabled, size = "sm" }: { disabled: boolean; size?: "sm" | "lg" }) {
  const box = size === "lg" ? "h-11 w-11" : "h-9 w-9";
  const icon = size === "lg" ? 18 : 16;
  return (
    <button type="submit" disabled={disabled} aria-label="Send" className={`glow-btn flex-none rounded-full ${box} flex items-center justify-center`}>
      <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 12H19M19 12L13 6M19 12L13 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [goal, setGoal] = useState("");
  const [sending, setSending] = useState(false);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [widgetsOpen, setWidgetsOpen] = useState(false);
  const [activeRun, setActiveRun] = useState<WorkflowRun | null>(null);
  const [activeState, setActiveState] = useState<AgentStateSnapshot | null>(null);
  const [runsRefresh, setRunsRefresh] = useState(0);
  const [loadingRun, setLoadingRun] = useState(false);
  const [widgetLayout, setWidgetLayout] = useWidgetLayout();
  const widgetsMovable = useMediaQuery("(min-width: 1200px)");
  const socketRef = useRef<WebSocket | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const homeComposerRef = useRef<HTMLFormElement>(null);
  const dockedComposerRef = useRef<HTMLFormElement>(null);
  const flipFromRect = useRef<DOMRect | null>(null);

  const hasStarted = messages.length > 0 || loadingRun;

  // The big centered composer becomes the small bottom-docked one the moment
  // a goal is sent. Rather than a jump cut, capture where the big one was
  // right before the switch and animate the new (docked) element in from
  // there -- same FLIP technique git_show uses for its search field.
  useLayoutEffect(() => {
    const from = flipFromRect.current;
    const el = dockedComposerRef.current;
    if (!from || !el) return;
    flipFromRect.current = null;

    const to = el.getBoundingClientRect();
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top - to.top;
    const scaleX = from.width / to.width;
    const scaleY = from.height / to.height;

    el.style.transformOrigin = "top center";
    el.style.transition = "none";
    el.style.transform = `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`;

    // Force a reflow so the browser registers the starting transform before
    // animating away from it.
    el.getBoundingClientRect();

    requestAnimationFrame(() => {
      el.style.transition = DOCK_TRANSITION;
      el.style.transform = "translate(0, 0) scale(1, 1)";
    });
  }, [hasStarted]);

  const loadRuns = () => {
    api.listRuns().then(setRuns).catch(() => undefined);
    setRunsRefresh((n) => n + 1);
  };
  useEffect(() => {
    loadRuns();
    return () => socketRef.current?.close();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const patchMessage = (runId: string, patch: (m: ChatMessage) => ChatMessage) => {
    setMessages((prev) => prev.map((m) => (m.runId === runId ? patch(m) : m)));
  };

  const refreshActiveRun = (runId: string) => {
    api
      .getRun(runId)
      .then((data) => {
        setActiveRun(data.run);
        setActiveState(data.state);
      })
      .catch(() => undefined);
  };

  const connectSocket = (runId: string) => {
    socketRef.current?.close();
    const socket = new WebSocket(wsUrl(runId));
    socketRef.current = socket;
    socket.onmessage = (msg) => {
      const event: ExecutionEvent = JSON.parse(msg.data);
      patchMessage(runId, (m) => {
        const next: ChatMessage = { ...m, events: [...m.events, event] };
        if (event.event_type === "USER_INPUT_REQUIRED") {
          next.askUser = {
            approvalId: String(event.output?.approval_id ?? ""),
            question: String(event.output?.question ?? ""),
            options: (event.output?.options as string[] | undefined) ?? [],
            answered: false,
          };
          next.status = "awaiting_user_input";
        } else if (next.askUser && !next.askUser.answered) {
          next.askUser = { ...next.askUser, answered: true };
        }
        if (event.event_type === "WORKFLOW_COMPLETED") {
          next.status = "completed";
          next.finalText = String(event.output?.reason ?? "Workflow completed.");
        } else if (event.event_type === "WORKFLOW_FAILED") {
          next.status = "failed";
          next.finalText = event.error || "Workflow failed.";
        } else if (event.event_type === "USER_APPROVED") {
          next.status = "running";
        }
        return next;
      });
      if (REFRESH_ON.has(event.event_type)) refreshActiveRun(runId);
      if (event.event_type === "WORKFLOW_COMPLETED" || event.event_type === "WORKFLOW_FAILED") {
        loadRuns();
        socket.close();
      }
    };
  };

  const startNewChat = () => {
    if (sending) return;
    socketRef.current?.close();
    setMessages([]);
    setActiveRun(null);
    setActiveState(null);
    setGoal("");
    setSidebarOpen(false);
  };

  const deleteRun = async (id: string, goal: string) => {
    if (!window.confirm(`Delete "${goal}"? This can't be undone.`)) return;
    try {
      await api.deleteRun(id);
      setRuns((prev) => prev.filter((r) => r.id !== id));
      if (activeRun?.id === id) startNewChat();
    } catch {
      loadRuns();
    }
  };

  const openRun = async (id: string) => {
    setSidebarOpen(false);
    socketRef.current?.close();
    setLoadingRun(true);
    try {
      const data = await api.getRun(id);
      const events = data.events;
      const approvalEvent = events.find((e) => e.event_type === "APPROVAL_REQUIRED");
      const askEvent = [...events].reverse().find((e) => e.event_type === "USER_INPUT_REQUIRED");
      const answeredAfter = askEvent ? events.some((e) => e !== askEvent && e.created_at > askEvent.created_at) : true;
      const finalEvent = [...events].reverse().find((e) => e.event_type === "WORKFLOW_COMPLETED" || e.event_type === "WORKFLOW_FAILED");
      const decision: PlanDecision =
        data.run.status === "rejected" ? "rejected" : data.run.status === "awaiting_approval" || data.run.status === "pending" ? "pending" : "approved";

      const assistantMessage: ChatMessage = {
        role: "assistant",
        runId: data.run.id,
        plan: data.state?.plan,
        approvalId: approvalEvent ? String(approvalEvent.output?.approval_id ?? "") : null,
        decision,
        events,
        status: data.run.status,
        finalText: finalEvent
          ? String(finalEvent.event_type === "WORKFLOW_COMPLETED" ? finalEvent.output?.reason ?? "Workflow completed." : finalEvent.error ?? "Workflow failed.")
          : undefined,
        askUser:
          askEvent && !answeredAfter
            ? {
                approvalId: String(askEvent.output?.approval_id ?? ""),
                question: String(askEvent.output?.question ?? ""),
                options: (askEvent.output?.options as string[] | undefined) ?? [],
                answered: false,
              }
            : null,
      };

      setMessages([{ role: "user", goal: data.run.goal, events: [] }, assistantMessage]);
      setActiveRun(data.run);
      setActiveState(data.state);
      if (LIVE_STATUSES.has(data.run.status)) connectSocket(data.run.id);
    } catch {
      loadRuns();
    } finally {
      setLoadingRun(false);
    }
  };

  const sendGoal = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    if (!hasStarted && homeComposerRef.current) {
      flipFromRect.current = homeComposerRef.current.getBoundingClientRect();
    }
    setSending(true);
    setGoal("");
    setMessages((prev) => [...prev, { role: "user", goal: trimmed, events: [] }]);
    try {
      const result = await api.createPlan(trimmed);
      setMessages((prev) => [...prev, newRunMessage(result.run.id, result.plan, result.approval_id, result.run.status)]);
      refreshActiveRun(result.run.id);
      connectSocket(result.run.id);
      loadRuns();
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", events: [], finalText: `Something went wrong: ${(err as Error).message}` }]);
    } finally {
      setSending(false);
    }
  };

  const approvePlan = async (runId: string, approved: boolean) => {
    patchMessage(runId, (m) => ({ ...m, decision: approved ? "approved" : "rejected" }));
    try {
      await api.approve(runId, approved);
    } finally {
      loadRuns();
    }
  };

  const respondAskUser = async (runId: string, approvalId: string, answer: string) => {
    patchMessage(runId, (m) => (m.askUser ? { ...m, askUser: { ...m.askUser, answered: true } } : m));
    await api.respondToUser(runId, approvalId, { choice: answer });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendGoal(goal);
  };

  const activeEvents = activeRun ? (messages.find((m) => m.runId === activeRun.id)?.events ?? []) : [];
  // True from the moment a goal is sent until the plan (or an error) comes
  // back -- i.e. the last message is still just the user's own goal.
  const waitingForPlan = sending && messages.length > 0 && messages[messages.length - 1]?.role === "user";

  return (
    <div className="silver-bloom relative flex h-screen w-screen overflow-hidden text-slate-100">
      <div className="grain-overlay" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <span className="orb orb-1" />
        <span className="orb orb-2" />
        <span className="orb orb-3" />
        <span className="orb orb-4" />
        <span className="orb orb-5" />
      </div>
      <div
        className={`fixed inset-0 z-30 bg-black/50 transition-opacity ${sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-amber-200/80 bg-[#faf7ed] p-4 shadow-xl transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <a href="#/" className="mb-6 flex items-center gap-2.5 px-1">
          <img src={logo} alt="RemoOS" className="h-8 w-8 rounded-lg object-contain shadow-sm" />
          <span className="font-display text-lg font-bold text-slate-900 tracking-tight">RemoOS</span>
        </a>
        <button
          onClick={startNewChat}
          disabled={sending}
          className="mb-4 flex items-center gap-2 rounded-xl border border-amber-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 shadow-sm transition-all hover:bg-amber-50 hover:border-amber-400 disabled:opacity-50"
        >
          + New goal
        </button>
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700">Runs</div>
        <div className="flex-1 space-y-1 overflow-y-auto">
          {runs.length === 0 && <p className="px-1 text-xs font-medium text-slate-600">Nothing yet — send a goal to start.</p>}
          {runs.map((r) => (
            <div
              key={r.id}
              className={`group flex items-center gap-0.5 rounded-xl transition-all ${activeRun?.id === r.id ? "bg-amber-100/70 border border-amber-300/60" : "hover:bg-amber-50"}`}
            >
              <button
                onClick={() => openRun(r.id)}
                className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-slate-900"
              >
                <span className="truncate">{r.goal}</span>
                <StatusBadge status={r.status} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteRun(r.id, r.goal);
                }}
                aria-label={`Delete run: ${r.goal}`}
                title="Delete"
                className="flex-none rounded-lg p-1.5 text-slate-500 opacity-0 transition-all hover:text-red-600 group-hover:opacity-100"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M5 7H19M10 11V17M14 11V17M6 7L7 19H17L18 7M9 7V4H15V7"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="flex flex-none items-center justify-between gap-3 px-5 py-3 border-b border-amber-200/50 bg-[#faf7ed]/60 backdrop-blur-sm">
          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-300/60 bg-white text-slate-800 shadow-sm transition-all hover:bg-amber-50"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open runs"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <span className="hidden min-w-0 truncate text-sm font-bold text-slate-800 md:block">{activeRun ? activeRun.goal : ""}</span>
          <div className="flex items-center gap-1.5">
            {!widgetsMovable && (
              <button
                className="flex h-9 w-9 items-center justify-center rounded-[10px] text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200"
                onClick={() => setWidgetsOpen(true)}
                aria-label="Widgets"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" stroke="currentColor" strokeWidth="1.6" />
                  <rect x="13.5" y="3.5" width="7" height="7" rx="1.8" stroke="currentColor" strokeWidth="1.6" />
                  <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" stroke="currentColor" strokeWidth="1.6" />
                  <rect x="13.5" y="13.5" width="7" height="7" rx="1.8" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </button>
            )}
          </div>
        </header>

        <div data-hero className="relative min-h-0 flex-1">

          {!hasStarted ? (
            <main className="flex h-full flex-col items-center justify-center px-4 pb-16 text-center">
              <img src={logo} alt="" className="glow-logo mb-5 h-16 w-16 rounded-2xl" />
                            <h1 className="font-display text-3xl font-bold text-slate-900">What should RemoOS do?</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm font-medium text-slate-700">Describe a goal. You'll see the plan before anything runs.</p>

              <form ref={homeComposerRef} onSubmit={handleSubmit} className="mt-8 w-full max-w-2xl">
                <div className="glow-card flex items-end gap-2 rounded-2xl px-4 py-3 backdrop-blur-md border border-amber-300/50 bg-white/95 shadow-md">
                  <textarea
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendGoal(goal);
                      }
                    }}
                    placeholder="Describe a goal..."
                    rows={2}
                    autoFocus
                    className="max-h-40 flex-1 resize-none bg-transparent py-1.5 text-base font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  />
                  <SendButton disabled={sending || !goal.trim()} size="lg" />
                </div>
              </form>

              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {EXAMPLE_GOALS.map((g) => (
                  <button
                    key={g}
                    onClick={() => setGoal(g)}
                    className="rounded-full border border-amber-300/70 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 shadow-sm transition-all hover:border-amber-500 hover:bg-amber-50 hover:shadow-md"
                  >
                    {g}
                  </button>
                ))}
              </div>
            </main>
          ) : (
          <main className="flex h-full flex-col">
            <div className="chat-scroll min-h-0 flex-1 overflow-y-auto">
              <div className="chat-col space-y-5 pb-10 pt-4">
                {loadingRun && (
                  <div className="glow-card rise-in flex w-fit items-center gap-2.5 rounded-2xl rounded-bl-sm px-4 py-3 text-sm font-semibold text-slate-800" data-loading>
                    <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500 shadow-sm" />
                    Loading run…
                  </div>
                )}

                {messages.map((m, i) =>
                  m.role === "user" ? (
                    <div key={i} className="flex justify-end">
                      <div
                        className="rise-in max-w-[80%] rounded-2xl rounded-br-sm border border-amber-400/40 px-4 py-2.5 text-sm text-white shadow-md font-medium"
                        style={{ background: "linear-gradient(135deg, #f7a06a 0%, #e76f51 100%)" }}
                      >
                        {m.goal}
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="glow-card rise-in rounded-2xl rounded-bl-sm px-4 py-3.5 bg-white/90">
                      {m.plan && m.plan.steps?.length > 0 && (
                        <PlanCard
                          plan={m.plan}
                          decision={m.decision ?? "pending"}
                          live={m.status === "running"}
                          completedObjectives={activeRun?.id === m.runId ? activeState?.completed_objectives : undefined}
                          currentObjective={activeRun?.id === m.runId ? activeState?.current_objective : undefined}
                          busy={sending}
                          onApprove={m.runId ? () => approvePlan(m.runId!, true) : undefined}
                          onReject={m.runId ? () => approvePlan(m.runId!, false) : undefined}
                        />
                      )}
                      <Timeline events={m.events} live={m.status === "running"} defaultOpen={i === messages.length - 1} />
                      {m.askUser && !m.askUser.answered && m.runId && (
                        <AskUserCard
                          question={m.askUser.question}
                          options={m.askUser.options}
                          busy={sending}
                          onRespond={(answer) => respondAskUser(m.runId!, m.askUser!.approvalId, answer)}
                        />
                      )}
                      {m.finalText && <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-900">{m.finalText}</p>}
                    </div>
                  ),
                )}
                {waitingForPlan && (
                  <div className="glow-card rise-in flex w-fit items-center gap-1.5 rounded-2xl rounded-bl-sm px-4 py-3.5 bg-white">
                    <span className="typing-dot h-2 w-2 rounded-full bg-amber-500" style={{ animationDelay: "0ms" }} />
                    <span className="typing-dot h-2 w-2 rounded-full bg-amber-500" style={{ animationDelay: "150ms" }} />
                    <span className="typing-dot h-2 w-2 rounded-full bg-amber-500" style={{ animationDelay: "300ms" }} />
                  </div>
                )}
                <div ref={endRef} />
              </div>
            </div>

            <form ref={dockedComposerRef} onSubmit={handleSubmit} className="chat-col flex-none pb-5 pt-2">
              <div className="glow-card flex items-end gap-2 rounded-2xl px-3 py-2 bg-white/95 border border-amber-300/50 shadow-md">
                <textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendGoal(goal);
                    }
                  }}
                  placeholder="Describe a goal..."
                  rows={1}
                  autoFocus
                  className="max-h-32 flex-1 resize-none bg-transparent py-1.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
                <SendButton disabled={sending || !goal.trim()} />
              </div>
              <p className="mt-2 text-center text-xs font-semibold text-slate-700">Press Enter to send, Shift+Enter for a new line</p>
            </form>
          </main>
          )}
        </div>
      </div>
    </div>
  );
}
