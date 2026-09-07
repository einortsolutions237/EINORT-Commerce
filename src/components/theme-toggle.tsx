"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMounted } from "@/hooks/use-mounted";
import { strings } from "@/lib/strings";

/**
 * Quick task 260906-egn — the header's 3-way Light/System/Dark control.
 *
 * ---------------------------------------------------------------------------
 * THE HYDRATION GATE IS MANDATORY, NOT DEFENSIVE PROGRAMMING.
 * ---------------------------------------------------------------------------
 * `next-themes`' `resolvedTheme` is `undefined` on the server and on the very
 * first client render BY DESIGN — it can only know the resolved theme (which
 * matters for the System option) after mounting and reading `matchMedia`. A
 * component that branches its first render on `resolvedTheme` renders one icon
 * on the server and a different one on the client the instant hydration
 * catches up, which React reports as a hydration mismatch. `mounted` comes
 * from `useMounted()` (`@/hooks/use-mounted`, a `useSyncExternalStore` gate —
 * see that file for why this project's lint rules forbid the more obvious
 * `useEffect(() => setMounted(true), [])` version), so the first render —
 * server AND client — always shows the same neutral placeholder, and the
 * resolved-theme icon only appears once hydration has definitely finished.
 *
 * The trigger's own accessible name and the three item labels all come from
 * `strings.dashboard.header` — no inline prose in this file.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  const ActiveIcon = !mounted
    ? Monitor
    : theme === "light"
      ? Sun
      : theme === "dark"
        ? Moon
        : Monitor;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 min-h-11 min-w-11"
            aria-label={strings.dashboard.header.themeToggleLabel}
          />
        }
      >
        <ActiveIcon aria-hidden="true" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun aria-hidden="true" />
          {strings.dashboard.header.themeLight}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor aria-hidden="true" />
          {strings.dashboard.header.themeSystem}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon aria-hidden="true" />
          {strings.dashboard.header.themeDark}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
