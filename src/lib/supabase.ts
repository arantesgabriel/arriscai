import { createClient, SupabaseClient } from "@supabase/supabase-js";
let client: SupabaseClient | undefined;
export function configured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.startsWith("replace-"),
  );
}
export function supabase() {
  if (!configured())
    throw new Error(
      "Conexão indisponível. Configure o projeto Supabase para abrir uma sala.",
    );
  const screen =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("telao");
  return (client ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: !screen,
        storageKey: screen ? "arriscai-screen-auth" : "arriscai-auth",
      },
    },
  ));
}
export async function identity() {
  const db = supabase();
  const {
    data: { session },
  } = await db.auth.getSession();
  if (session) return session.user;
  const { data, error } = await db.auth.signInAnonymously();
  if (error) throw error;
  return data.user!;
}
export async function rpc<T>(
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase().rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}
