"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export interface PasswordInputProps
  extends Omit<React.ComponentProps<"input">, "type"> {
  /** Announced on the toggle button while the password is masked. */
  readonly showLabel: string
  /** Announced on the toggle button while the password is revealed. */
  readonly hideLabel: string
}

/**
 * A password `Input` with a show/hide toggle, built once here rather than
 * duplicated across `login-form.tsx` and `signup-form.tsx` — both need the
 * identical behavior: masked by default, a `type="button"` toggle so it
 * never submits the form, and its own `aria-label` per state rather than a
 * static one.
 *
 * `showLabel`/`hideLabel` are required props rather than copy baked in here,
 * so the two call sites keep sourcing their strings from `strings.login` /
 * `strings.signup` per this project's centralized-copy rule.
 */
export function PasswordInput({
  className,
  showLabel,
  hideLabel,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = React.useState(false)

  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        className={cn("pr-11", className)}
        {...props}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute top-0 right-0 size-11 text-muted-foreground hover:text-foreground"
        aria-label={visible ? hideLabel : showLabel}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </Button>
    </div>
  )
}
