import type { ProjectStatus, Task, TaskPriority } from "./types";

export const OPEN_STATUSES = ["todo", "in_progress"];

export const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export const PRIORITY_STYLE: Record<TaskPriority, string> = {
  urgent: "bg-red-500/15 text-red-300",
  high: "bg-orange-500/15 text-orange-300",
  medium: "bg-indigo-500/15 text-indigo-300",
  low: "bg-slate-700/50 text-slate-300",
};

export const PROJECT_STATUS_STYLE: Record<ProjectStatus, string> = {
  active: "bg-emerald-500/15 text-emerald-300",
  paused: "bg-amber-500/15 text-amber-300",
  completed: "bg-cyan-500/15 text-cyan-300",
  archived: "bg-slate-700/50 text-slate-400",
};

export function pretty(value: string): string {
  return value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function safeTz(tz: string | null | undefined): string {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

export function todayIn(tz: string | null | undefined): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: safeTz(tz) });
}

export function longDate(tz: string | null | undefined): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: safeTz(tz),
  });
}

export function formatDate(date: string | null): string {
  if (!date) return "";
  return new Date(date.length === 10 ? `${date}T00:00:00` : date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function sortTasks<T extends Pick<Task, "priority" | "due_date">>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    const w = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (w !== 0) return w;
    if (a.due_date === b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });
}