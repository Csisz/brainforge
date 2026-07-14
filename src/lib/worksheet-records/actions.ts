"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getGenerator } from "@/lib/worksheets/registry";
import { freshSeed } from "@/lib/random";

/**
 * Catalog "print for this child": persists a session-less worksheet RECIPE
 * (fresh seed, params null ⇒ defaultParams at render time) and hands off to the
 * existing print route. No SVG is stored — the print page renders from this
 * recipe on demand, deriving age/difficulty/theme from the child (there is no
 * owning session). RLS scopes the insert to the signed-in owner.
 */
export async function printWorksheetForChild(
  generatorId: string,
  childId: string,
  locale: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  const generator = getGenerator(generatorId); // throws on unknown id (trusted catalog input)

  const { data, error } = await supabase
    .from("worksheets")
    .insert({
      owner_id: user.id,
      child_id: childId,
      session_id: null,
      generator_id: generator.id,
      generator_version: generator.version,
      params: null,
      seed: freshSeed(),
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "insert_failed" };

  redirect(`/${locale}/app/worksheets/${data.id}/print`);
}
