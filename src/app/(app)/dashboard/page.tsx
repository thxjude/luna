import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .maybeSingle();

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const checks = [
    "Authentication active",
    "Protected routes active",
    profile ? "Database and profile loaded" : "Profile missing - check the SQL migration",
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm text-slate-400">{today}</p>
      <h1 className="mt-1 text-2xl font-semibold md:text-3xl">Hello, {firstName}</h1>

      <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
        <h2 className="mb-3 text-sm font-medium text-slate-300">Foundation status</h2>
        <ul className="space-y-2">
          {checks.map((c) => (
            <li key={c} className="flex items-center gap-2 text-sm text-slate-200">
              <CheckCircle2 size={16} className="text-cyan-400" />
              {c}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}