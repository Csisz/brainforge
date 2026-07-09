import { getTranslations } from "next-intl/server";
import { composeSession } from "@/lib/activities/engine";
import { SessionTimeline } from "@/components/session/session-timeline";

export async function ScreenFreePitch({ locale }: { locale: string }) {
  const t = await getTranslations("pitch");
  const plan = composeSession({
    childId: "demo",
    age: 5,
    goals: ["attention", "fine_motor", "creativity"],
    theme: "nature",
    durationMin: 30,
    materials: ["pencil", "crayons", "paper", "ball", "cups", "blocks"],
    difficulty: 3,
    recentWorksheets: [],
    locale,
  });

  return (
    <section className="bg-mist/60 py-20">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 md:grid-cols-2 md:items-center md:gap-16">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-crayon-text">{t("eyebrow")}</p>
          <h2 className="mt-2 font-display text-2xl font-extrabold text-ink sm:text-3xl">{t("title")}</h2>
          <p className="mt-4 max-w-md text-ink-soft">{t("body")}</p>
        </div>
        <SessionTimeline plan={plan} />
      </div>
    </section>
  );
}
