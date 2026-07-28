import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function verifyParentalConsent(userId: string): Promise<boolean> {
  if (!supabaseAdmin) return false;

  const { data } = await supabaseAdmin
    .from("profiles")
    .select("child_name, guardian_attested, parental_consent_at")
    .eq("user_id", userId)
    .maybeSingle();

  return !!(data?.child_name?.trim() && data.guardian_attested && data.parental_consent_at);
}
