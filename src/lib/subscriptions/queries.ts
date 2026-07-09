import { createClient } from "@/lib/supabase/server";

export type SubscriptionRow = {
  tier: "free" | "premium" | "family" | "school" | "therapist";
  status: string;
};

export async function getSubscription(): Promise<SubscriptionRow | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("subscriptions").select("tier, status").eq("owner_id", user.id).single();
  return data;
}
