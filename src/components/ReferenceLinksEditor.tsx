'use client'

import { Link2, Plus, X } from 'lucide-react'
import type { ReferenceLink } from '@/lib/reference-links'

type ReferenceLinksEditorProps = {
  value: ReferenceLink[]
  onChange: (links: ReferenceLink[]) => void
  description?: string
}

export default function ReferenceLinksEditor({ value, onChange, description }: ReferenceLinksEditorProps) {
  const update = (index: number, field: keyof ReferenceLink, nextValue: string) => {
    onChange(value.map((link, linkIndex) => linkIndex === index ? { ...link, [field]: nextValue } : link))
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <p className="portal-label mb-1">Links <span className="font-normal text-muted-foreground">(optional)</span></p>
          <p className="text-xs leading-5 text-muted-foreground">{description || 'Add forms, registration pages, shared files, or other useful destinations.'}</p>
        </div>
        <button type="button" onClick={() => onChange([...value, { label: '', url: '' }])} className="portal-button-secondary small w-full shrink-0 justify-center sm:w-auto"><Plus className="h-3.5 w-3.5" /> Add link</button>
      </div>

      {value.length === 0 ? (
        <button type="button" onClick={() => onChange([{ label: '', url: '' }])} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/40 hover:text-foreground"><Link2 className="h-4 w-4" /> Attach a link</button>
      ) : (
        <div className="mt-3 space-y-3">
          {value.map((link, index) => (
            <div key={index} className="grid gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-[0.75fr_1.25fr_auto] sm:items-center">
              <input value={link.label} onChange={(event) => update(index, 'label', event.target.value)} className="portal-input w-full" placeholder="Label (optional)" />
              <input type="url" value={link.url} onChange={(event) => update(index, 'url', event.target.value)} className="portal-input w-full" placeholder="https://…" required />
              <button type="button" onClick={() => onChange(value.filter((_, linkIndex) => linkIndex !== index))} className="portal-icon-button" aria-label={`Remove link ${index + 1}`}><X className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
