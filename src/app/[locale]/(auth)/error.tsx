"use client";

import { ErrorState } from "@/components/boundary/error-state";

/**
 * Error boundary for the auth pages (login, register, forgot/reset password). No
 * "back to dashboard" here — the visitor isn't signed in — just a warm message
 * and a retry, inside the centered auth frame.
 */
export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState error={error} reset={reset} />;
}
