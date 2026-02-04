'use client'

import { useMemo } from 'react'
import { normalizeAnnouncementBodyForDisplay } from '@/lib/announcement-rich-text'

type RichTextContentProps = {
  content: string
  className?: string
}

export default function RichTextContent({ content, className }: RichTextContentProps) {
  const safeHtml = useMemo(() => normalizeAnnouncementBodyForDisplay(content), [content])

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  )
}
