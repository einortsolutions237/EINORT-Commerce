import Link from "next/link";
import { Bell, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { strings } from "@/lib/strings";

import { ThemeToggle } from "./theme-toggle";

/**
 * Quick task 260906-egn — the dashboard header's right-side control cluster:
 * the theme toggle, a decorative notification bell, and the Super Admin Panel
 * stub. Composed here rather than inlined in `(dashboard)/layout.tsx` so the
 * layout's header stays a plain row of controls, not a control factory.
 *
 * ---------------------------------------------------------------------------
 * THE BELL IS DECORATIVE. THERE IS NO NOTIFICATION DATA MODEL YET.
 * ---------------------------------------------------------------------------
 * It opens nothing and carries no badge — a permanent `0` badge is exactly the
 * anti-pattern `app-sidebar.tsx`'s own header argues against for the claims
 * count, and a badge with no real unread count behind it would be worse: a
 * number that never changes. Its accessible name says what it is, not that it
 * secretly does nothing.
 *
 * ---------------------------------------------------------------------------
 * SUPER ADMIN PANEL IS A HEADER BUTTON, DELIBERATELY NOT A RAIL ITEM.
 * ---------------------------------------------------------------------------
 * `/admin` does not exist yet — it is a Phase 6+ surface — and
 * `tests/unit/dashboard-nav.test.ts`'s reachability contract exists precisely
 * to stop a rail entry from pointing at a route nobody built. Putting the link
 * in the header instead keeps it reachable for review without teaching the
 * rail's own contract to tolerate a 404. Rendered unconditionally: there is no
 * role check available on this session shape today, and gating it is Phase 6+
 * scope (T-egn-07 in this plan's threat model — a visible link to a
 * non-existent route grants no privilege by itself).
 *
 * Every control here carries `min-h-11` — the same 44px touch-target floor
 * `app-sidebar.tsx` inherits from this market's hardware.
 */
export function DashboardHeaderControls() {
  return (
    <div className="flex items-center gap-1">
      <ThemeToggle />

      <Button
        variant="ghost"
        size="icon"
        className="h-11 w-11 min-h-11 min-w-11"
        aria-label={strings.dashboard.header.notificationsLabel}
      >
        <Bell aria-hidden="true" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="min-h-11"
        render={<Link href="/admin" />}
      >
        <ShieldCheck aria-hidden="true" />
        {strings.dashboard.header.superAdminPanel}
      </Button>
    </div>
  );
}
