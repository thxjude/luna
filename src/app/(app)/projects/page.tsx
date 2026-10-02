"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, FolderKanban, Loader2, Pencil, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getUserId } from "@/lib/supabase/user";
import { PROJECT_STATUSES, type Project, type ProjectStatus } from "@/lib/types";
import { btnGhost, btnPrimary, cardClass, inputClass } from "@/lib/styles";
import { PRIORITY_STYLE, PROJECT_STATUS_STYLE, formatDate, pretty } from "@/lib/utils";
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

type Filter = ProjectStatus | "all";
type Editing = Project | "new" | null;
type ProjectValues = {
  name: string;
  description: string;
  status: ProjectStatus;
  current_phase: string;
  next_action: string;
};
type Linked = {
  tasks: { id: string; title: string; status: string; priority: keyof typeof PRIORITY_STYLE; due_date: string | null }[];
  notes: { id: string; title: string; updated_at: string }[];
};

const FILTERS: { id: Filter; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "paused", label: "Paused" },
  { id: "completed", label: "Completed" },
  { id: "archived", label: "Archived" },
  { id: "all", label: "All" },
];

const STARTERS = ["Luna", "OneLang", "AegisScan"];

function ProjectForm({
  initial,
  busy,
  error,
  onSave,
  onClose,
}: {
  initial: Project | null;
  busy: boolean;
  error: string | null;
  onSave: (v: ProjectValues) => void;
  onClose: () => void;
}) {
  const [v, setV] = useState<ProjectValues>({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    status: initial?.status ?? "active",
    current_phase: initial?.current_phase ?? "",
    next_action: initial?.next_action ?? "",
  });

  return (
    <Modal title={initial ? "Edit project" : "New project"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(v);
        }}
        className="space-y-3"
      >
        <Field label="Name">
          <input
            required
            autoFocus
            maxLength={120}
            value={v.name}
            onChange={(e) => setV({ ...v, name: e.target.value })}
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
          <Field label="Status">
            <select
              value={v.status}
              onChange={(e) => setV({ ...v, status: e.target.value as ProjectStatus })}
              className={inputClass}
            >
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {pretty(s)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Current phase">
            <input
              maxLength={120}
              value={v.current_phase}
              onChange={(e) => setV({ ...v, current_phase: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="Next action">
          <input
            maxLength={300}
            value={v.next_action}
            onChange={(e) => setV({ ...v, next_action: e.target.value })}
            className={inputClass}
          />
        </Field>
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

export default function ProjectsPage() {
  const supabase = useMemo(() => createClient(), []);
  const { show, toastNode } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("active");
  const [editing, setEditing] = useState<Editing>(null);
  const [viewing, setViewing] = useState<Project | null>(null);
  const [linked, setLinked] = useState<Linked | null>(null);
  const [archiving, setArchiving] = useState<Project | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("projects")
      .select("*")
      .order("updated_at", { ascending: false });
    if (err) {
      setError(err.message);
    } else {
      setProjects((data ?? []) as Project[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = projects.filter((p) => filter === "all" || p.status === filter);

  async function openProject(p: Project) {
    setViewing(p);
    setLinked(null);
    const [t, n] = await Promise.all([
      supabase
        .from("tasks")
        .select("id,title,status,priority,due_date")
        .eq("project_id", p.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("notes")
        .select("id,title,updated_at")
        .eq("project_id", p.id)
        .order("updated_at", { ascending: false }),
    ]);
    setLinked({
      tasks: (t.data ?? []) as Linked["tasks"],
      notes: (n.data ?? []) as Linked["notes"],
    });
  }

  async function saveProject(v: ProjectValues) {
    setBusy(true);
    setFormError(null);
    const existing = editing && editing !== "new" ? editing : null;
    const payload = {
      name: v.name.trim(),
      description: v.description.trim() || null,
      status: v.status,
      current_phase: v.current_phase.trim() || null,
      next_action: v.next_action.trim() || null,
    };

    let err: { message: string } | null = null;
    if (existing) {
      const res = await supabase.from("projects").update(payload).eq("id", existing.id);
      err = res.error;
    } else {
      const userId = await getUserId(supabase);
      if (!userId) {
        err = { message: "Session expired. Please log in again." };
      } else {
        const res = await supabase.from("projects").insert({ ...payload, user_id: userId });
        err = res.error;
      }
    }

    setBusy(false);
    if (err) {
      setFormError(err.message);
      return;
    }
    setEditing(null);
    setViewing(null);
    show(existing ? "Project updated" : "Project created");
    load();
  }

  async function setStatus(p: Project, status: ProjectStatus) {
    setBusy(true);
    const { error: err } = await supabase.from("projects").update({ status }).eq("id", p.id);
    setBusy(false);
    if (err) {
      setError(err.message);
    } else {
      show(status === "archived" ? "Project archived" : "Project restored");
    }
    setArchiving(null);
    setViewing(null);
    load();
  }

  async function addStarters() {
    setBusy(true);
    const userId = await getUserId(supabase);
    if (!userId) {
      setBusy(false);
      setError("Session expired. Please log in again.");
      return;
    }
    const { error: err } = await supabase
      .from("projects")
      .insert(STARTERS.map((name) => ({ user_id: userId, name })));
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    show("Starter projects added");
    load();
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Projects" subtitle="Track phases and next actions">
        <button
          type="button"
          className={btnPrimary}
          onClick={() => {
            setFormError(null);
            setEditing("new");
          }}
        >
          <Plus size={16} />
          New project
        </button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              filter === f.id
                ? "border-cyan-400 bg-cyan-400/10 text-cyan-200"
                : "border-slate-700 text-slate-300 hover:bg-slate-800/70"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {loading ? (
        <LoadingBlock />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects here"
          text={
            projects.length === 0
              ? "Create a project or add the starter set: Luna, OneLang, AegisScan."
              : "No projects match this filter."
          }
        >
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" className={btnPrimary} onClick={() => setEditing("new")}>
              <Plus size={16} />
              New project
            </button>
            {projects.length === 0 && (
              <button type="button" className={btnGhost} onClick={addStarters} disabled={busy}>
                {busy && <Loader2 size={16} className="animate-spin" />}
                Add starter projects
              </button>
            )}
          </div>
        </EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => openProject(p)}
              className={`${cardClass} p-4 text-left transition hover:border-slate-600`}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium">{p.name}</h3>
                <span className={`rounded px-1.5 py-0.5 text-xs ${PROJECT_STATUS_STYLE[p.status]}`}>
                  {pretty(p.status)}
                </span>
              </div>
              {p.description && (
                <p className="mt-1 line-clamp-2 text-sm text-slate-400">{p.description}</p>
              )}
              {p.current_phase && (
                <p className="mt-3 text-xs text-slate-400">
                  Phase: <span className="text-slate-200">{p.current_phase}</span>
                </p>
              )}
              {p.next_action && (
                <p className="mt-1 text-xs text-slate-400">
                  Next: <span className="text-slate-200">{p.next_action}</span>
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {viewing && (
        <Modal title={viewing.name} onClose={() => setViewing(null)}>
          <div className="space-y-3 text-sm">
            <span
              className={`inline-block rounded px-1.5 py-0.5 text-xs ${PROJECT_STATUS_STYLE[viewing.status]}`}
            >
              {pretty(viewing.status)}
            </span>
            {viewing.description && <p className="text-slate-300">{viewing.description}</p>}
            <p className="text-slate-400">
              Phase: <span className="text-slate-200">{viewing.current_phase ?? "Not set"}</span>
            </p>
            <p className="text-slate-400">
              Next action: <span className="text-slate-200">{viewing.next_action ?? "Not set"}</span>
            </p>

            <div>
              <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                Tasks
              </h3>
              {!linked ? (
                <p className="text-slate-500">Loading...</p>
              ) : linked.tasks.length === 0 ? (
                <p className="text-slate-500">No linked tasks.</p>
              ) : (
                <ul className="divide-y divide-slate-800">
                  {linked.tasks.map((t) => (
                    <li key={t.id} className="flex justify-between gap-2 py-1.5">
                      <span
                        className={`truncate ${t.status === "completed" ? "text-slate-500 line-through" : ""}`}
                      >
                        {t.title}
                      </span>
                      <span className="shrink-0 text-xs text-slate-500">
                        {pretty(t.status)}
                        {t.due_date ? ` - ${formatDate(t.due_date)}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                Notes
              </h3>
              {!linked ? (
                <p className="text-slate-500">Loading...</p>
              ) : linked.notes.length === 0 ? (
                <p className="text-slate-500">No linked notes.</p>
              ) : (
                <ul className="divide-y divide-slate-800">
                  {linked.notes.map((n) => (
                    <li key={n.id} className="flex justify-between gap-2 py-1.5">
                      <span className="truncate">{n.title}</span>
                      <span className="shrink-0 text-xs text-slate-500">
                        {formatDate(n.updated_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              {viewing.status === "archived" ? (
                <button
                  type="button"
                  className={btnGhost}
                  disabled={busy}
                  onClick={() => setStatus(viewing, "active")}
                >
                  <ArchiveRestore size={16} />
                  Restore
                </button>
              ) : (
                <button type="button" className={btnGhost} onClick={() => setArchiving(viewing)}>
                  <Archive size={16} />
                  Archive
                </button>
              )}
              <button
                type="button"
                className={btnPrimary}
                onClick={() => {
                  setFormError(null);
                  setEditing(viewing);
                }}
              >
                <Pencil size={16} />
                Edit
              </button>
            </div>
          </div>
        </Modal>
      )}

      {editing && (
        <ProjectForm
          initial={editing === "new" ? null : editing}
          busy={busy}
          error={formError}
          onSave={saveProject}
          onClose={() => setEditing(null)}
        />
      )}

      {archiving && (
        <ConfirmDialog
          title="Archive project"
          message={`Archive "${archiving.name}"? You can restore it later from the Archived filter.`}
          confirmLabel="Archive"
          busy={busy}
          onConfirm={() => setStatus(archiving, "archived")}
          onCancel={() => setArchiving(null)}
        />
      )}

      {toastNode}
    </div>
  );
}