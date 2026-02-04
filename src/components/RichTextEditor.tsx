'use client'

import { useEffect, useMemo, useRef } from 'react'
import { Bold, Italic, Underline, Strikethrough, List, ListOrdered } from 'lucide-react'
import { normalizeAnnouncementBodyForEditor } from '@/lib/announcement-rich-text'

type RichTextEditorProps = {
  id?: string
  label: string
  value: string
  onChange: (next: string) => void
  placeholder?: string
  required?: boolean
  minHeightClassName?: string
}

type ToolbarAction = {
  label: string
  icon: any
  command: string
}

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  { label: 'Bold', icon: Bold, command: 'bold' },
  { label: 'Italic', icon: Italic, command: 'italic' },
  { label: 'Underline', icon: Underline, command: 'underline' },
  { label: 'Strike', icon: Strikethrough, command: 'strikeThrough' },
  { label: 'Bulleted list', icon: List, command: 'insertUnorderedList' },
  { label: 'Numbered list', icon: ListOrdered, command: 'insertOrderedList' },
]

export default function RichTextEditor({
  id,
  label,
  value,
  onChange,
  placeholder = 'Write here...',
  required = false,
  minHeightClassName = 'min-h-[140px]',
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const isFocusedRef = useRef(false)
  const lastLocalHtmlRef = useRef('')

  const editorHtml = useMemo(() => normalizeAnnouncementBodyForEditor(value), [value])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    // Don't rewrite while typing; that resets caret position.
    if (isFocusedRef.current) return
    if (editor.innerHTML !== editorHtml) {
      editor.innerHTML = editorHtml
      lastLocalHtmlRef.current = editorHtml
    }
  }, [editorHtml])

  const runCommand = (command: string) => {
    const editor = editorRef.current
    if (!editor) return

    editor.focus()
    document.execCommand(command, false)
    onChange(editor.innerHTML)
  }

  const handleInput = () => {
    const editor = editorRef.current
    if (!editor) return
    const html = editor.innerHTML
    lastLocalHtmlRef.current = html
    onChange(html)
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault()
    const text = event.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
  }

  const handleFocus = () => {
    isFocusedRef.current = true
  }

  const handleBlur = () => {
    isFocusedRef.current = false
    const editor = editorRef.current
    if (!editor) return
    const normalized = normalizeAnnouncementBodyForEditor(editor.innerHTML)
    if (normalized !== editor.innerHTML) {
      editor.innerHTML = normalized
    }
    if (normalized !== lastLocalHtmlRef.current) {
      lastLocalHtmlRef.current = normalized
      onChange(normalized)
    }
  }

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>

      <div className="rounded-md border border-primary/20 bg-dark-100">
        <div className="flex flex-wrap items-center gap-1 border-b border-primary/20 p-2">
          {TOOLBAR_ACTIONS.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.command}
                type="button"
                onClick={() => runCommand(action.command)}
                className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                title={action.label}
                aria-label={action.label}
              >
                <Icon className="h-4 w-4" />
              </button>
            )
          })}
        </div>

        <div
          id={id}
          ref={editorRef}
          contentEditable
          role="textbox"
          aria-multiline="true"
          aria-required={required}
          data-placeholder={placeholder}
          onInput={handleInput}
          onPaste={handlePaste}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={`${minHeightClassName} w-full p-3 text-sm text-foreground leading-relaxed focus:outline-none [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-1 [&_li]:my-0.5 [&_p]:my-1 [&_div]:my-1 [&:empty:before]:pointer-events-none [&:empty:before]:text-muted-foreground [&:empty:before]:content-[attr(data-placeholder)]`}
        />
      </div>
    </div>
  )
}
