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
 * A SUPER ADMIN PANEL ENTRY POINT WAS DELIBERATELY REMOVED HERE.
 * ---------------------------------------------------------------------------
 * Quick task 260906-egn shipped an unconditional `/admin` link (a route that
 * does not exist) because this session shape carries no role concept. Quick
 * task 260907-a2v deletes it: an always-404 link that implies an admin
 * capability every merchant sees but none has is worse than no link at all.
 * It returns in Phase 6, gated on a real `User.platformRole` check — not
 * un-commented from here.
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
