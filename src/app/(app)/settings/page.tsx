"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getUserId } from "@/lib/supabase/user";
import { btnGhost, btnPrimary, cardClass, inputClass } from "@/lib/styles";
import { ErrorBanner, Field, LoadingBlock, PageHeader, useToast } from "@/components/ui";

function validTz(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export default function SettingsPage() {
  const supabase = useMemo(() => createClient(), []);
  const { show, toastNode } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [responseMode, setResponseMode] = useState("normal");
  const [voiceSentences, setVoiceSentences] = useState(3);
  const [provider, setProvider] = useState("openrouter");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAssistant, setSavingAssistant] = useState(false);

  const zones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return ["UTC"];
    }
  }, []);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        setError("Session expired. Please log in again.");
        setLoading(false);
        return;
      }
      setEmail(user.email ?? "");
      const [p, s] = await Promise.all([
        supabase.from("profiles").select("full_name,timezone").eq("id", user.id).maybeSingle(),
        supabase
          .from("assistant_settings")
          .select("response_mode,voice_max_sentences,primary_provider")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      const err = p.error ?? s.error;
      if (err) {
        setError(err.message);
      } else {
        if (p.data) {
          setFullName(p.data.full_name ?? "");
          setTimezone(p.data.timezone ?? "UTC");
        }
        if (s.data) {
          setResponseMode(s.data.response_mode);
          setVoiceSentences(s.data.voice_max_sentences);
          setProvider(s.data.primary_provider);
        }
      }
      setLoading(false);
    }
    load();
  }, [supabase]);

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!validTz(timezone)) {
      setError("Invalid timezone. Pick one from the list, for example UTC or Europe/London.");
      return;
    }
    setSavingProfile(true);
    const userId = await getUserId(supabase);
    if (!userId) {
      setSavingProfile(false);
      setError("Session expired. Please log in again.");
      return;
    }
    const { error: err } = await supabase
      .from("profiles")
      .upsert({ id: userId, full_name: fullName.trim(), timezone }, { onConflict: "id" });
    setSavingProfile(false);
    if (err) {
      setError(err.message);
      return;
    }
    show("Profile saved");
  }

  async function saveAssistant(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSavingAssistant(true);
    const userId = await getUserId(supabase);
    if (!userId) {
      setSavingAssistant(false);
      setError("Session expired. Please log in again.");
      return;
    }
    const { error: err } = await supabase.from("assistant_settings").upsert(
      {
        user_id: userId,
        response_mode: responseMode,
        voice_max_sentences: voiceSentences,
        primary_provider: provider,
      },
      { onConflict: "user_id" }
    );
    setSavingAssistant(false);
    if (err) {
      setError(err.message);
      return;
    }
    show("Assistant settings saved");
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Settings" subtitle="Profile and assistant preferences" />

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <form onSubmit={saveProfile} className={`${cardClass} space-y-3 p-5`}>
            <h2 className="text-sm font-medium text-slate-300">Profile</h2>
            <Field label="Email">
              <input value={email} readOnly disabled className={`${inputClass} opacity-60`} />
            </Field>
            <Field label="Name">
              <input
                required
                maxLength={100}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Timezone">
              <input
                list="timezones"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className={inputClass}
              />
              <datalist id="timezones">
                {zones.map((z) => (
                  <option key={z} value={z} />
                ))}
              </datalist>
            </Field>
            <div className="flex justify-between gap-2 pt-1">
              <button
                type="button"
                className={btnGhost}
                onClick={() => setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)}
              >
                Use this device timezone
              </button>
              <button type="submit" className={btnPrimary} disabled={savingProfile}>
                {savingProfile && <Loader2 size={16} className="animate-spin" />}
                Save profile
              </button>
            </div>
          </form>

          <form onSubmit={saveAssistant} className={`${cardClass} space-y-3 p-5`}>
            <h2 className="text-sm font-medium text-slate-300">Assistant</h2>
            <Field label="Answer length">
              <select
                value={responseMode}
                onChange={(e) => setResponseMode(e.target.value)}
                className={inputClass}
              >
                <option value="short">Short</option>
                <option value="normal">Normal</option>
                <option value="detailed">Detailed</option>
              </select>
            </Field>
            <Field label="Voice answer length (sentences)">
              <select
                value={voiceSentences}
                onChange={(e) => setVoiceSentences(Number(e.target.value))}
                className={inputClass}
              >
                {[1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Primary AI provider">
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className={inputClass}
              >
                <option value="openrouter">OpenRouter (free route)</option>
                <option value="groq">Groq (free plan)</option>
              </select>
            </Field>
            <div className="flex justify-end pt-1">
              <button type="submit" className={btnPrimary} disabled={savingAssistant}>
                {savingAssistant && <Loader2 size={16} className="animate-spin" />}
                Save assistant settings
              </button>
            </div>
          </form>
        </div>
      )}

      {toastNode}
    </div>
  );
}