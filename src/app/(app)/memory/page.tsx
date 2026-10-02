"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Brain, Loader2, Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getUserId } from "@/lib/supabase/user";
import { MEMORY_CATEGORIES, type Memory, type MemoryCategory } from "@/lib/types";
import { btnGhost, btnPrimary, cardClass, inputClass } from "@/lib/styles";
import { pretty } from "@/lib/utils";
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

type Editing = Memory | "new" | null;
type MemoryValues = {
  category: MemoryCategory;
  key: string;
  value: string;
  importance: number;
  status: "active" | "archived";
};

const SENSITIVE =
  /(password|passwd|passcode|\botp\b|one[- ]time|api[_ -]?key|secret|token|cvv|card number|private key)/i;
const LONG_DIGITS = /\b(?:\d[ -]?){13,19}\b/;

function MemoryForm({
  initial,
  busy,
  error,
  onSave,
  onClose,
}: {
  initial: Memory | null;
  busy: boolean;
  error: string | null;
  onSave: (v: MemoryValues) => void;
  onClose: () => void;
}) {
  const [v, setV] = useState<MemoryValues>({
    category: initial?.category ?? "preference",
    key: initial?.key ?? "",
    value: initial?.value ?? "",
    importance: initial?.importance ?? 3,
    status: initial?.status ?? "active",
  });

  return (
    <Modal title={initial ? "Edit memory" : "Add memory"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(v);
        }}
        className="space-y-3"
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <select
              value={v.category}
              onChange={(e) => setV({ ...v, category: e.target.value as MemoryCategory })}
              className={inputClass}
            >
              {MEMORY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {pretty(c)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Importance (1-5)">
            <select
              value={v.importance}
              onChange={(e) => setV({ ...v, importance: Number(e.target.value) })}
              className={inputClass}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Key">
          <input
            required
            autoFocus
            maxLength={80}
            value={v.key}
            onChange={(e) => setV({ ...v, key: e.target.value })}
            className={inputClass}
            placeholder="preferred_stack"
          />
        </Field>
        <Field label="Value">
          <textarea
            required
            rows={3}
            maxLength={1000}
            value={v.value}
            onChange={(e) => setV({ ...v, value: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Status">
          <select
            value={v.status}
            onChange={(e) => setV({ ...v, status: e.target.value as "active" | "archived" })}
            className={inputClass}
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </Field>
        <p className="flex items-start gap-2 text-xs text-slate-500">
          <ShieldAlert size={14} className="mt-0.5 shrink-0 text-amber-400" />
          Never store secrets, passwords, OTPs, payment info, or API keys.
        </p>
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

export default function MemoryPage() {
  const supabase = useMemo(() => createClient(), []);
  const { show, toastNode } = useToast();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<Memory | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("assistant_memories")
      .select("*")
      .order("importance", { ascending: false })
      .order("updated_at", { ascending: false });
    if (err) {
      setError(err.message);
    } else {
      setMemories((data ?? []) as Memory[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveMemory(v: MemoryValues) {
    const key = v.key.trim();
    const value = v.value.trim();
    if (SENSITIVE.test(key) || SENSITIVE.test(value) || LONG_DIGITS.test(value)) {
      setFormError("This looks like sensitive data (secret, password, OTP, card, or key). Not saved.");
      return;
    }

    setBusy(true);
    setFormError(null);
    const existing = editing && editing !== "new" ? editing : null;
    const payload = {
      category: v.category,
      key,
      value,
      importance: v.importance,
      status: v.status,
    };

    let err: { message: string; code?: string } | null = null;
    if (existing) {
      const res = await supabase.from("assistant_memories").update(payload).eq("id", existing.id);
      err = res.error;
    } else {
      const userId = await getUserId(supabase);
      if (!userId) {
        err = { message: "Session expired. Please log in again." };
      } else {
        const res = await supabase
          .from("assistant_memories")
          .insert({ ...payload, user_id: userId });
        err = res.error;
      }
    }

    setBusy(false);
    if (err) {
      setFormError(
        err.code === "23505"
          ? "A memory with this category and key already exists."
          : err.message
      );
      return;
    }
    setEditing(null);
    show(existing ? "Memory updated" : "Memory saved");
    load();
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    const { error: err } = await supabase.from("assistant_memories").delete().eq("id", deleting.id);
    setBusy(false);
    if (err) {
      setError(err.message);
    } else {
      show("Memory deleted");
    }
    setDeleting(null);
    load();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Memory" subtitle="Selected facts and preferences Luna can use">
        <button
          type="button"
          className={btnPrimary}
          onClick={() => {
            setFormError(null);
            setEditing("new");
          }}
        >
          <Plus size={16} />
          Add memory
        </button>
      </PageHeader>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {loading ? (
        <LoadingBlock />
      ) : memories.length === 0 ? (
        <EmptyState
          icon={Brain}
          title="No memories yet"
          text="Add preferences, decisions, and facts you want Luna to remember."
        >
          <button type="button" className={btnPrimary} onClick={() => setEditing("new")}>
            <Plus size={16} />
            Add memory
          </button>
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {MEMORY_CATEGORIES.map((cat) => {
            const items = memories.filter((m) => m.category === cat);
            if (items.length === 0) return null;
            return (
              <section key={cat}>
                <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  {pretty(cat)}
                </h2>
                <ul className={`${cardClass} divide-y divide-slate-800`}>
                  {items.map((m) => (
                    <li key={m.id} className="flex items-start gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{m.key}</p>
                        <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-400">
                          {m.value}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Importance {m.importance}
                          {m.status === "archived" ? " - Archived" : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Edit memory"
                        onClick={() => {
                          setFormError(null);
                          setEditing(m);
                        }}
                        className="text-slate-500 hover:text-slate-200"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete memory"
                        onClick={() => setDeleting(m)}
                        className="text-slate-500 hover:text-red-300"
                      >
                        <Trash2 size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {editing && (
        <MemoryForm
          initial={editing === "new" ? null : editing}
          busy={busy}
          error={formError}
          onSave={saveMemory}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete memory"
          message={`Delete "${deleting.key}"? Luna will no longer use it.`}
          busy={busy}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

      {toastNode}
    </div>
  );
}