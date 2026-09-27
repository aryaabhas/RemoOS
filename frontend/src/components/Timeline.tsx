import { useMemo, useState } from "react";
import type { ExecutionEvent } from "../types";
import { AgentBadge, agentForEvent } from "./AgentBadge";
import { ToolIcon, type IconKind } from "./ToolIcon";

const TOOL_META: Record<
  string,
  { label: string; icon: IconKind; category: "gmail" | "document" | "sheets" | "slack" | "browser" | "desktop" | "generic" }
> = {
  "gmail.search": { label: "Searching Gmail", icon: "gmail", category: "gmail" },
  "gmail.read": { label: "Reading email", icon: "gmail", category: "gmail" },
  "gmail.download_attachment": { label: "Downloading attachment", icon: "gmail", category: "gmail" },
  "document.extract_text": { label: "Reading attachment", icon: "document", category: "document" },
  "document.extract_fields": { label: "Extracting details", icon: "document", category: "document" },
  "sheets.search": { label: "Checking tracker", icon: "sheets", category: "sheets" },
  "sheets.insert": { label: "Updating CRM", icon: "sheets", category: "sheets" },
  "sheets.update": { label: "Updating tracker", icon: "sheets", category: "sheets" },
  "slack.send": { label: "Notifying Slack", icon: "slack", category: "slack" },
  "browser.navigate": { label: "Opening page", icon: "browser", category: "browser" },
  "browser.click": { label: "Clicking", icon: "browser", category: "browser" },
  "browser.type": { label: "Typing", icon: "browser", category: "browser" },
  "browser.get_text": { label: "Reading page", icon: "browser", category: "browser" },
  "desktop.open_app": { label: "Opening app", icon: "desktop", category: "desktop" },
  "desktop.get_window": { label: "Finding window", icon: "desktop", category: "desktop" },
  "desktop.click": { label: "Clicking", icon: "desktop", category: "desktop" },
  "desktop.type": { label: "Typing", icon: "desktop", category: "desktop" },
  "desktop.hotkey": { label: "Sending hotkey", icon: "desktop", category: "desktop" },
};

const CATEGORY_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  gmail: { bg: "bg-red-50", border: "border-red-300", text: "text-red-900" },
  document: { bg: "bg-sky-50", border: "border-sky-300", text: "text-sky-900" },
  sheets: { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-900" },
  slack: { bg: "bg-pink-50", border: "border-pink-300", text: "text-pink-900" },
  browser: { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-900" },
  desktop: { bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-900" },
  generic: { bg: "bg-slate-50", border: "border-slate-300", text: "text-slate-900" },
};

interface ToolItem {
  kind: "tool";
  tool: string;
  status: "pending" | "success" | "error";
  error?: string | null;
}

interface MilestoneItem {
  kind: "milestone";
  event: ExecutionEvent;
}

type DisplayItem = ToolItem | MilestoneItem;

function buildItems(events: ExecutionEvent[]): DisplayItem[] {
  const items: DisplayItem[] = [];
  for (const event of events) {
    if (event.event_type === "TOOL_CALLED") {
      items.push({ kind: "tool", tool: event.tool_name ?? "", status: "pending" });
    } else if (event.event_type === "TOOL_RESULT") {
      const pending = [...items].reverse().find((it): it is ToolItem => it.kind === "tool" && it.tool === event.tool_name && it.status === "pending");
      if (pending) {
        pending.status = event.status === "success" ? "success" : "error";
        pending.error = event.error;
      } else {
        items.push({ kind: "tool", tool: event.tool_name ?? "", status: event.status === "success" ? "success" : "error", error: event.error });
      }
    } else if (event.event_type === "STEP_COMPLETED") {
      continue;
    } else {
      items.push({ kind: "milestone", event });
    }
  }
  return items;
}

function milestoneText(event: ExecutionEvent): string {
  switch (event.event_type) {
    case "PLAN_CREATED":
      return "Created workflow plan";
    case "APPROVAL_REQUIRED":
      return "Awaiting plan approval";
    case "USER_APPROVED":
      return "Plan approved by user";
    case "USER_REJECTED":
      return "Plan rejected by user";
    case "WORKFLOW_STARTED":
      return "Started workflow execution";
    case "REPLANNING":
      return String(event.output?.reason ?? "Adapting workflow plan");
    case "USER_INPUT_REQUIRED":
      return String(event.output?.question ?? "Awaiting user input");
    case "WORKFLOW_COMPLETED":
      return String(event.output?.reason ?? "Workflow completed successfully");
    case "WORKFLOW_FAILED":
      return event.error || "Execution error encountered";
    default:
      return event.event_type.replace(/_/g, " ").toLowerCase();
  }
}

function ToolIconSlot({ icon, status }: { icon: IconKind; status: "pending" | "success" | "error" }) {
  return (
    <span className="relative flex h-6 w-6 flex-none items-center justify-center rounded-lg bg-white border border-slate-300 shadow-sm">
      {status === "pending" && (
        <span
          className="absolute inset-0 animate-spin rounded-lg border-2 border-amber-400/20 border-t-amber-500"
          aria-hidden="true"
        />
      )}
      <span className={status === "error" ? "opacity-60 grayscale" : "opacity-100"}>
        <ToolIcon icon={icon} />
      </span>
    </span>
  );
}

function ToolRow({ item }: { item: ToolItem }) {
  const meta = TOOL_META[item.tool] ?? { label: item.tool || "Working", icon: "generic" as IconKind, category: "generic" };
  const style = CATEGORY_STYLES[meta.category] ?? CATEGORY_STYLES.generic;

  return (
    <li className={`group flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-xs transition-all ${style.border} ${style.bg}`}>
      <div className="flex items-center gap-2.5 min-w-0">
        <ToolIconSlot icon={meta.icon} status={item.status} />
        <span className="truncate font-bold text-slate-900">
          {meta.label}
        </span>
      </div>
      <div className="flex items-center gap-1.5 flex-none">
        {item.status === "pending" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 text-[0.7rem] font-bold text-amber-900 animate-pulse">
            In progress
          </span>
        )}
        {item.status === "success" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-400 px-2.5 py-0.5 text-[0.7rem] font-bold text-emerald-900">
            ✓ Done
          </span>
        )}
        {item.status === "error" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 border border-red-400 px-2.5 py-0.5 text-[0.7rem] font-bold text-red-900">
            ✕ Error
          </span>
        )}
      </div>
    </li>
  );
}

function MilestoneRow({ event, active }: { event: ExecutionEvent; active: boolean }) {
  const failed = event.event_type === "WORKFLOW_FAILED";
  const isReplan = event.event_type === "REPLANNING";
  const agentKind = agentForEvent(event.event_type);

  return (
    <li
      className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all ${
        isReplan
          ? "border-amber-400 bg-amber-50 text-amber-950 shadow-sm"
          : failed
            ? "border-red-400 bg-red-50 text-red-950"
            : "border-slate-300 bg-white text-slate-900 shadow-sm"
      }`}
    >
      <div className="mt-0.5 flex-none">
        <AgentBadge kind={agentKind} />
      </div>
      <div className="min-w-0 flex-1 leading-snug">
        <span className={active ? "text-slate-950 font-bold" : failed ? "text-red-900 font-bold" : "text-slate-900"}>
          {milestoneText(event)}
        </span>
      </div>
    </li>
  );
}

export function Timeline({
  events,
  live = false,
  defaultOpen = false,
  bare = false,
}: {
  events: ExecutionEvent[];
  live?: boolean;
  defaultOpen?: boolean;
  bare?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const items = useMemo(() => buildItems(events), [events]);
  if (items.length === 0) return null;

  const rows = (
    <ol className="mt-3 flex flex-col gap-2 list-none">
      {items.map((item, i) => {
        const isLast = live && i === items.length - 1;
        return item.kind === "tool" ? (
          <ToolRow key={i} item={item} />
        ) : (
          <MilestoneRow key={i} event={item.event} active={isLast} />
        );
      })}
    </ol>
  );

  if (bare) return rows;

  const calls = items.filter((it) => it.kind === "tool").length;
  const replans = events.filter((e) => e.event_type === "REPLANNING").length;

  return (
    <div className="mt-3.5 border-t border-amber-200/80 pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-900 transition-all hover:bg-amber-50 shadow-sm"
      >
        <span className="text-amber-800">{open ? "Hide" : "Show"} Execution Activity</span>
        <span className="rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-xs font-bold text-amber-900">
          {calls > 0 ? `${calls} stage${calls === 1 ? "" : "s"}` : ""}
          {calls > 0 && replans > 0 ? " · " : ""}
          {replans > 0 ? `${replans} replan` : ""}
        </span>
      </button>
      {open && rows}
    </div>
  );
}
