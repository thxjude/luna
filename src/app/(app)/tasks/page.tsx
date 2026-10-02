import TasksView from "@/components/TasksView";
import { createClient } from "@/lib/supabase/server";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user!.id)
    .maybeSingle();

  return <TasksView timezone={profile?.timezone ?? "UTC"} autoNew={sp.new === "1"} />;
}