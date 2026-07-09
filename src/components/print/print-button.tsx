"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton({ label }: { label: string }) {
  return (
    <Button onClick={() => window.print()} size="lg" className="gap-2 print:hidden">
      <Printer className="size-4" aria-hidden="true" />
      {label}
    </Button>
  );
}
