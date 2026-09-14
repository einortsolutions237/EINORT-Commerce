import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { strings } from "@/lib/strings";

import { ThemeToggle } from "./theme-toggle";

/**
 * Quick task 260906-egn — the dashboard header's right-side control cluster:
 * the theme toggle and a decorative notification bell. Composed here rather
 * than inlined in `(dashboard)/layout.tsx` so the layout's header stays a
 * plain row of controls, not a control factory.
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
 * A SUPER ADMIN PANEL ENTRY POINT WAS DELIBERATELY REMOVED HERE, AND STAYS REMOVED.
 * ---------------------------------------------------------------------------
 * Quick task 260906-egn shipped an unconditional `/admin` link (a route that
 * did not exist yet) because this session shape carried no role concept.
 * Quick task 260907-a2v deleted it: an always-404 link that implies an admin
 * capability every merchant sees but none has is worse than no link at all.
 *
 * `/admin` is real now (Phase 6), and the real `User.platformRole` check this
 * comment once predicted (`requireAdminContext`, `src/server/admin/context.ts`)
 * exists — but the link is NOT un-commented from here. Phase 06-04's D-03
 * locks the admin surface as reachable by an unlinked URL only: no link
 * anywhere in the merchant dashboard UI, deliberately more obscure than a
 * gated link would be, so the surface carries no discoverability risk at all.
 * A future reader finding no admin link here should read that as this
 * decision holding, not as the prediction above having gone unfulfilled.
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
    </div>
  );
}
