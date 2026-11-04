"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { completarOnboarding } from "@/actions/vendedor";
import { Button } from "@/components/ui/button";

export function OnboardingButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="lg"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await completarOnboarding();
          if (res && !res.ok) toast.error(res.error);
        })
      }
    >
      {pending ? "Verificando…" : "Ya lo compartí"}
    </Button>
  );
}
