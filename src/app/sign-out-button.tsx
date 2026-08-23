"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { strings } from "@/lib/strings";
import { signOutMerchant } from "@/server/auth/login";

/**
 * T-02-21: the merchant's way out of an authenticated surface.
 *
 * A minimal control, not a form — `signOutMerchant` takes no input, so a
 * `useTransition`-wrapped click handler is the whole of it. Rendered on both
 * `(dashboard)/layout.tsx` and `suspended/page.tsx`: a signed-in merchant,
 * suspended or not, must always have a way out that is not the browser back
 * button.
 */
export function SignOutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await signOutMerchant();
        });
      }}
      className="min-h-11 px-4 text-sm font-semibold"
    >
      {strings.dashboard.signOut}
    </Button>
  );
}
