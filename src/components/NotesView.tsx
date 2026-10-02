"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Search, StickyNote, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getUserId } from "@/lib/supabase/user";
import type { Note, ProjectOption } from "@/lib/types";
import { btnGhost, btnPrimary, cardClass, inputClass } from "@/lib/styles";
import { formatDate } from "@/lib/utils";
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

type Editing = Note | "new" | null;
type NoteValues = {
  title: string;
  content: string;
  category: string;
  tags: string;
  project_id: string;
};

function NoteForm({
  initial,
  projects,
  busy,
  error,
  onSave,
  onClose,
}: {
  initial: Note | null;
  projects: ProjectOption[];
  busy: boolean;
  error: string | null;
  onSave: (v: NoteValues) => void;
  onClose: () => void;
}) {
  const [v, setV] = useState<NoteValues>({
    title: initial?.title ?? "",
    content: initial?.content ?? "",
    category: initial?.category ?? "general",
    tags: initial ? initial.note_tags.map((t) => t.tag).join(", ") : "",
    project_id: initial?.project_id ?? "",
  });

  return (
    <Modal title={initial ? "Edit note" : "Save note"} onClose={onClose}>
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
        <Field label="Content">
          <textarea
            rows={6}
            value={v.content}
            onChange={(e) => setV({ ...v, content: e.target.value })}
            className={inputClass}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <input
              maxLength={60}
              value={v.category}
              onChange={(e) => setV({ ...v, category: e.target.value })}
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
        <Field label="Tags (comma separated)">
          <input
            value={v.tags}
            onChange={(e) => setV({ ...v, tags: e.target.value })}
            className={inputClass}
            placeholder="idea, design, research"
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

export default function NotesView({ autoNew }: { autoNew: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const { show, toastNode } = useToast();
  const [notes, setNotes] = useState<Note[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Editing>(autoNew ? "new" : null);
  const [deleting, setDeleting] = useState<Note | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [n, p] = await Promise.all([
      supabase
        .from("notes")
        .select("*, note_tags(tag), projects(name)")
        .order("updated_at", { ascending: false })
        .limit(500),
      supabase.from("projects").select("id,name").neq("status", "archived").order("name"),
    ]);
    const err = n.error ?? p.error;
    if (err) {
      setError(err.message);
    } else {
      setNotes((n.data ?? []) as Note[]);
      setProjects((p.data ?? []) as ProjectOption[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? notes.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.category.toLowerCase().includes(q) ||
          n.note_tags.some((t) => t.tag.includes(q))
      )
    : notes;

  async function saveNote(v: NoteValues) {
    setBusy(true);
    setFormError(null);
    const existing = editing && editing !== "new" ? editing : null;

    const userId = await getUserId(supabase);
    if (!userId) {
      setBusy(false);
      setFormError("Session expired. Please log in again.");
      return;
    }

    const payload = {
      title: v.title.trim(),
      content: v.content,
      category: v.category.trim() || "general",
      project_id: v.project_id || null,
    };

    let noteId = existing?.id ?? "";
    if (existing) {
      const res = await supabase.from("notes").update(payload).eq("id", existing.id);
      if (res.error) {
        setBusy(false);
        setFormError(res.error.message);
        return;
      }
    } else {
      const res = await supabase
        .from("notes")
        .insert({ ...payload, user_id: userId })
        .select("id")
        .single();
      if (res.error || !res.data) {
        setBusy(false);
        setFormError(res.error?.message ?? "Could not create note.");
        return;
      }
      noteId = res.data.id as string;
    }

    const tags = Array.from(
      new Set(
        v.tags
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
      )
    );

    if (existing) {
      const del = await supabase.from("note_tags").delete().eq("note_id", noteId);
      if (del.error) {
        setBusy(false);
        setFormError(del.error.message);
        return;
      }
    }
    if (tags.length > 0) {
      const ins = await supabase
        .from("note_tags")
        .insert(tags.map((tag) => ({ note_id: noteId, user_id: userId, tag })));
      if (ins.error) {
        setBusy(false);
        setFormError(ins.error.message);
        return;
      }
    }

    setBusy(false);
    setEditing(null);
    show(existing ? "Note updated" : "Note saved");
    load();
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    const { error: err } = await supabase.from("notes").delete().eq("id", deleting.id);
    setBusy(false);
    if (err) {
      setError(err.message);
    } else {
      show("Note deleted");
    }
    setDeleting(null);
    load();
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Notes" subtitle="Ideas, decisions, and reference">
        <button
          type="button"
          className={btnPrimary}
          onClick={() => {
            setFormError(null);
            setEditing("new");
          }}
        >
          <Plus size={16} />
          Save note
        </button>
      </PageHeader>

      <div className="relative mb-4">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title, content, or tag"
          aria-label="Search notes"
          className={`${inputClass} pl-9`}
        />
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {loading ? (
        <LoadingBlock />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={StickyNote}
          title={q ? "No matching notes" : "No notes yet"}
          text={q ? "Try a different keyword or tag." : "Save your first note to see it here."}
        >
          {!q && (
            <button type="button" className={btnPrimary} onClick={() => setEditing("new")}>
              <Plus size={16} />
              Save note
            </button>
          )}
        </EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((n) => (
            <article key={n.id} className={`${cardClass} flex flex-col p-4`}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium">{n.title}</h3>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    aria-label="Edit note"
                    onClick={() => {
                      setFormError(null);
                      setEditing(n);
                    }}
                    className="text-slate-500 hover:text-slate-200"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete note"
                    onClick={() => setDeleting(n)}
                    className="text-slate-500 hover:text-red-300"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              {n.content && (
                <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm text-slate-400">
                  {n.content}
                </p>
              )}
              {n.note_tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {n.note_tags.map((t) => (
                    <button
                      key={t.tag}
                      type="button"
                      onClick={() => setQuery(t.tag)}
                      className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-xs text-indigo-200 hover:bg-indigo-500/25"
                    >
                      #{t.tag}
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-3 text-xs text-slate-500">
                {n.category}
                {n.projects?.name ? ` - ${n.projects.name}` : ""} - {formatDate(n.updated_at)}
              </p>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <NoteForm
          initial={editing === "new" ? null : editing}
          projects={projects}
          busy={busy}
          error={formError}
          onSave={saveNote}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete note"
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