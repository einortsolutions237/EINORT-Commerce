import * as React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

/**
 * A thin composition of the existing `Card`/`CardHeader`/`CardTitle`/
 * `CardContent` primitives, giving dashboard pages a consistent card shell.
 * No new tokens or styling are introduced here — `Card`'s own defaults
 * already produce the target "elevated white card on slate-50" look.
 *
 * This component has **no consumer yet**. CONTEXT.md's locked decision #4
 * explicitly defers retrofitting the six existing dashboard pages
 * (Overview, Products, Orders, Claims, Plan, Payment Settings) into it to a
 * separate, future task — this file is only the shared primitive that task
 * will import. Do not wire it into any existing page as part of quick task
 * 260903-ugl.
 */
interface DashboardCardProps
  extends Omit<React.ComponentProps<typeof Card>, "children" | "title"> {
  title?: React.ReactNode
  children: React.ReactNode
}

function DashboardCard({ title, children, ...props }: DashboardCardProps) {
  return (
    <Card {...props}>
      {title !== undefined ? (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export { DashboardCard }
