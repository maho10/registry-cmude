import { supabase } from "./supabase";

// The shared scan-station login uses a real Supabase Auth account, but
// volunteers just type a plain "username" — we map it to a fixed fake
// email domain under the hood rather than asking anyone to remember an
// email address.
const EMAIL_DOMAIN = "cmude.local";

export function isScanAuthenticated(): Promise<boolean> {
  return supabase.auth.getSession().then(({ data }) => !!data.session);
}

/** Signs in with Supabase Auth. RLS grants scanner-scoped access based on the account's role claim. */
export async function scanLogin(username: string, password: string): Promise<boolean> {
  const { error } = await supabase.auth.signInWithPassword({
    email: `${username}@${EMAIL_DOMAIN}`,
    password,
  });
  return !error;
}
