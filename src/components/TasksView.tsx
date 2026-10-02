"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, CheckSquare, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getUserId } from "@/lib/supabase/user";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type ProjectOption,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/types";
import { btnGhost, btnPrimary, cardClass, inputClass } from "@/lib/styles";
import { OPEN_STATUSES, PRIORITY_STYLE, formatDate, pretty, sortTasks, todayIn } from "@/lib/utils";
import {
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  Field,
  LoadingBlock,
  Modal,
  PageHeader,
  useToast,
} from "@/components/ui";

type Filter = "today" | "upcoming" | "overdue" | "all" | "done";
type Editing = Task | "new" | null;
type TaskValues = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string;
  project_id: string;
};

const FILTERS: { id: Filter; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "overdue", label: "Overdue" },
  { id: "all", label: "All" },
  { id: "done", label: "Done" },
];

function matches(t: Task, f: Filter, today: string): boolean {
  const open = OPEN_STATUSES.includes(t.status);
  switch (f) {
    case "today":
      return open && t.due_date === today;
    case "upcoming":
      return open && t.due_date !== null && t.due_date > today;
    case "overdue":
      return open && t.due_date !== null && t.due_date < today;
    case "done":
      return t.status === "completed";
    default:
      return true;
  }
}

function TaskForm({
  initial,
  projects,
  busy,
  error,
  onSave,
  onClose,
}: {
  initial: Task | null;
  projects: ProjectOption[];
  busy: boolean;
  error: string | null;
  onSave: (v: TaskValues) => void;
  onClose: () => void;
}) {
  const [v, setV] = useState<TaskValues>({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    status: initial?.status ?? "todo",
    priority: initial?.priority ?? "medium",
    due_date: initial?.due_date ?? "",
    project_id: initial?.project_id ?? "",
  });

  return (
    <Modal title={initial ? "Edit task" : "Add task"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(v);
        }}
        className="space-y-3"
      >
        <Field label="Title">
          <input
            required
            autoFocus
            maxLength={200}
            value={v.title}
            onChange={(e) => setV({ ...v, title: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Description">
          <textarea
            rows={3}
            value={v.description}
            onChange={(e) => setV({ ...v, description: e.target.value })}
            className={inputClass}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Priority">
            <select
              value={v.priority}
              onChange={(e) => setV({ ...v, priority: e.target.value as TaskPriority })}
              className={inputClass}
            >
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {pretty(p)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              value={v.status}
              onChange={(e) => setV({ ...v, status: e.target.value as TaskStatus })}
              className={inputClass}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {pretty(s)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Due date">
            <input
              type="date"
              value={v.due_date}
              onChange={(e) => setV({ ...v, due_date: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Project">
            <select
              value={v.project_id}
              onChange={(e) => setV({ ...v, project_id: e.target.value })}
              className={inputClass}
            >
              <option value="">None</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {error && <ErrorBanner message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btnGhost} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary} disabled={busy}>
            {busy && <Loader2 size={16} className="animate-spin" />}
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function TasksView({
  timezone,
  autoNew,
}: {
  timezone: string;
  autoNew: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { show, toastNode } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("today");
  const [editing, setEditing] = useState<Editing>(autoNew ? "new" : null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const today = todayIn(timezone);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [t, p] = await Promise.all([
      supabase.from("tasks").select("*, projects(name)").order("created_at", { ascending: false }),
      supabase.from("projects").select("id,name").neq("status", "archived").order("name"),
    ]);
    const err = t.error ?? p.error;
    if (err) {
      setError(err.message);
    } else {
      setTasks((t.data ?? []) as Task[]);
      setProjects((p.data ?? []) as ProjectOption[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = sortTasks(tasks.filter((t) => matches(t, filter, today)));

  async function saveTask(v: TaskValues) {
    setBusy(true);
    setFormError(null);
    const existing = editing && editing !== "new" ? editing : null;
    const payload = {
      title: v.title.trim(),
      description: v.description.trim() || null,
      status: v.status,
      priority: v.priority,
      due_date: v.due_date || null,
      project_id: v.project_id || null,
      completed_at:
        v.status === "completed" ? existing?.completed_at ?? new Date().toISOString() : null,
    };

    let err: { message: string } | null = null;
    if (existing) {
      const res = await supabase.from("tasks").update(payload).eq("id", existing.id);
      err = res.error;
    } else {
      const userId = await getUserId(supabase);
      if (!userId) {
        err = { message: "Session expired. Please log in again." };
      } else {
        const res = await supabase.from("tasks").insert({ ...payload, user_id: userId });
        err = res.error;
      }
    }

    setBusy(false);
    if (err) {
      setFormError(err.message);
      return;
    }
    setEditing(null);
    show(existing ? "Task updated" : "Task created");
    load();
  }

  async function toggleDone(t: Task) {
    const done = t.status === "completed";
    const { error: err } = await supabase
      .from("tasks")
      .update({
        status: done ? "todo" : "completed",
        completed_at: done ? null : new Date().toISOString(),
      })
      .eq("id", t.id);
    if (err) {
      setError(err.message);
      return;
    }
    show(done ? "Task reopened" : "Task completed");
    load();
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    const { error: err } = await supabase.from("tasks").delete().eq("id", deleting.id);
    setBusy(false);
    if (err) {
      setError(err.message);
    } else {
      show("Task deleted");
    }
    setDeleting(null);
    load();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Tasks" subtitle="Plan and track what needs doing">
        <button
          type="button"
          className={btnPrimary}
          onClick={() => {
            setFormError(null);
            setEditing("new");
          }}
        >
          <Plus size={16} />
          Add task
        </button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count = tasks.filter((t) => matches(t, f.id, today)).length;
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-full border px-3 py-1 text-sm transition ${
                active
                  ? "border-cyan-400 bg-cyan-400/10 text-cyan-200"
                  : "border-slate-700 text-slate-300 hover:bg-slate-800/70"
              }`}
            >
              {f.label} <span className="text-xs opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {loading ? (
        <LoadingBlock />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No tasks here"
          text="Nothing matches this filter. Add a task to get started."
        >
          <button type="button" className={btnPrimary} onClick={() => setEditing("new")}>
            <Plus size={16} />
            Add task
          </button>
        </EmptyState>
      ) : (
        <ul className={`${cardClass} divide-y divide-slate-800`}>
          {filtered.map((t) => {
            const done = t.status === "completed";
            const isOverdue =
              OPEN_STATUSES.includes(t.status) && t.due_date !== null && t.due_date < today;
            return (
              <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                <button
                  type="button"
                  aria-label={done ? "Mark as not done" : "Mark as done"}
                  onClick={() => toggleDone(t)}
                  className={`mt-0.5 ${done ? "text-cyan-400" : "text-slate-500 hover:text-cyan-300"}`}
                >
                  {done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${done ? "text-slate-500 line-through" : "text-slate-100"}`}>
                    {t.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className={`rounded px-1.5 py-0.5 ${PRIORITY_STYLE[t.priority]}`}>
                      {pretty(t.priority)}
                    </span>
                    <span>{pretty(t.status)}</span>
                    {t.due_date && (
                      <span className={isOverdue ? "text-red-300" : ""}>
                        Due {formatDate(t.due_date)}
                      </span>
                    )}
                    {t.projects?.name && <span>{t.projects.name}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Edit task"
                  onClick={() => {
                    setFormError(null);
                    setEditing(t);
                  }}
                  className="text-slate-500 hover:text-slate-200"
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Delete task"
                  onClick={() => setDeleting(t)}
                  className="text-slate-500 hover:text-red-300"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <TaskForm
          initial={editing === "new" ? null : editing}
          projects={projects}
          busy={busy}
          error={formError}
          onSave={saveTask}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete task"
          message={`Delete "${deleting.title}"? This cannot be undone.`}
          busy={busy}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

      {toastNode}
    </div>
  );
}