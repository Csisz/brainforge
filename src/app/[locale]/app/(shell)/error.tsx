"use client";

import { ErrorState } from "@/components/boundary/error-state";

/**
 * Error boundary for the whole app shell (dashboard, children, history, sessions,
 * pack, catalog, settings). Anything a page in here throws lands on the warm card
 * instead of Next's raw error page — rendered inside the sidebar chrome, with a
 * retry and a way back to the dashboard.
 */
export default function AppShellError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="py-10">
      <ErrorState error={error} reset={reset} homeHref="/app" />
    </div>
  );
}
