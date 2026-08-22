'use client'

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

type SectionPageHeaderProps = {
  eyebrow: string
  title: string
  description: string
  note?: ReactNode
  icon: LucideIcon
  actions?: ReactNode
  fullWidthTitle?: boolean
}

export default function SectionPageHeader({
  eyebrow,
  title,
  description,
  note,
  icon: Icon,
  actions,
  fullWidthTitle = false,
}: SectionPageHeaderProps) {
  if (fullWidthTitle) {
    return (
      <header>
        <div className="flex min-w-0 items-start gap-4">
          <span className="mt-1 hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary sm:flex">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="portal-eyebrow">{eyebrow}</p>
            <h1 className="portal-title break-words">{title}</h1>
            <div className="mt-5 flex flex-col gap-4 sm:mt-6 sm:flex-row sm:items-end sm:justify-between">
              <p className="min-w-0 text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">{description}</p>
              {actions && (
                <div className="flex w-full shrink-0 flex-wrap gap-2 [&>*]:flex-1 sm:w-auto sm:justify-end sm:[&>*]:flex-none">
                  {actions}
                </div>
              )}
            </div>
            {note && <div className="mt-2 text-xs leading-5 text-muted-foreground">{note}</div>}
          </div>
        </div>
      </header>
    )
  }

  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className="mt-1 hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary sm:flex">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <p className="portal-eyebrow">{eyebrow}</p>
            <h1 className="portal-title">{title}</h1>
            <p className="portal-subtitle">{description}</p>
            {note && <div className="mt-2 text-xs leading-5 text-muted-foreground">{note}</div>}
          </div>
        </div>
        {actions && <div className="flex w-full flex-wrap gap-2 [&>*]:flex-1 [&>*]:justify-center sm:w-auto sm:shrink-0 sm:justify-end sm:[&>*]:flex-none">{actions}</div>}
    </header>
  )
}
