import { createClient } from "./client";

export async function getUserId(
  supabase: ReturnType<typeof createClient>
): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}