"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"

/**
 * One deliberate override of the registry default: `next-themes` is removed and
 * the theme is pinned to `"light"`.
 *
 * The registry version calls `useTheme()` and falls back to `theme = "system"`.
 * This app ships no `ThemeProvider`, so that hook returns `undefined` and the
 * fallback wins — meaning every toast would follow the visitor's *operating
 * system* preference and render dark on a product whose `.dark` block is, per
 * `src/app/globals.css`, "authored but not shipped". A merchant on a dark-set
 * laptop would get a dark toast floating over the light dashboard field.
 * (Phrased without a palette-utility name on purpose: ban #2 in
 * `tests/unit/surface-token-isolation.test.ts` greps `.tsx` for them, and a
 * comment that names one would fail the guard it is explaining.)
 *
 * Pinning to `"light"` also drops `next-themes` from the dependency tree, which
 * plan 03-02 does not authorise and which exists here only to answer a question
 * this product has already answered.
 *
 * If a future `shadcn add sonner` overwrites this file, the whole `useTheme`
 * removal is the diff to re-apply. Re-introduce it only alongside a real theme
 * switcher.
 *
 * The `--normal-*` custom properties are left exactly as the registry ships
 * them: they already read semantic tokens, so the toast inherits whichever
 * surface scope it renders under. Toasts are Surface A only (03-UI-SPEC.md
 * § Component Inventory — "non-blocking success toasts only, never for a
 * blocking error"), so in practice that is the merchant palette.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
