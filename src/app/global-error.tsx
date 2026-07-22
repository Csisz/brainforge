"use client";

import { useEffect, useState } from "react";

/**
 * Last-resort boundary: catches a throw in the root layout itself, where no other
 * boundary and no i18n provider exist. It must render its OWN <html>/<body>, so
 * it also can't use next-intl or the app stylesheet — the copy is inlined in the
 * three product locales (picked from the URL) and the styling is inline so the
 * page still looks like the product even if the CSS bundle never loaded.
 */
const COPY = {
  hu: { title: "Valami félrecsúszott", body: "Váratlan hiba történt. Töltsd újra az oldalt, kérjük.", retry: "Újratöltés" },
  en: { title: "Something went sideways", body: "An unexpected error occurred. Please reload the page.", retry: "Reload" },
  de: { title: "Da ist etwas schiefgelaufen", body: "Ein unerwarteter Fehler ist aufgetreten. Bitte lade die Seite neu.", retry: "Neu laden" },
} as const;

type Loc = keyof typeof COPY;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error boundary caught:", error);
  }, [error]);

  // Resolve the locale from the URL AFTER mount, so the server render and the
  // first client render agree (both default to hu, the product default) — no
  // hydration mismatch on this last-resort page, which should almost never show.
  const [loc, setLoc] = useState<Loc>("hu");
  useEffect(() => {
    const seg = window.location.pathname.split("/")[1] ?? "";
    if (seg in COPY) setLoc(seg as Loc);
  }, []);
  const t = COPY[loc];

  return (
    <html lang={loc}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          backgroundColor: "#fdfdfb",
          color: "#1f2a24",
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <div
            style={{
              width: "3rem",
              height: "3rem",
              margin: "0 auto 1rem",
              borderRadius: "9999px",
              backgroundColor: "#ffe9e6",
              color: "#b23b32",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.5rem",
              fontWeight: 700,
            }}
            aria-hidden="true"
          >
            !
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0 0 0.5rem" }}>{t.title}</h1>
          <p style={{ color: "#5c6b62", margin: "0 0 1.5rem" }}>{t.body}</p>
          <button
            onClick={reset}
            style={{
              cursor: "pointer",
              border: "none",
              borderRadius: "0.5rem",
              padding: "0.6rem 1.25rem",
              fontSize: "0.9rem",
              fontWeight: 600,
              backgroundColor: "#ff6b5e",
              color: "#1f2a24",
            }}
          >
            {t.retry}
          </button>
        </div>
      </body>
    </html>
  );
}
