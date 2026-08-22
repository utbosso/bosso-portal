const HTML_TAG_RE = /<\/?[a-z][\s\S]*>/i

const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'ul',
  'ol',
  'li',
  'div',
  'span',
  'a',
])

function escapeHtml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function sanitizeHtmlWithDom(html: string): string {
  if (typeof window === 'undefined') {
    return escapeHtml(html).replace(/\r?\n/g, '<br />')
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  const sanitizeNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeHtml(node.textContent || '')
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return ''

    const el = node as HTMLElement
    const tagName = el.tagName.toLowerCase()
    const children = Array.from(el.childNodes).map(sanitizeNode).join('')

    if (!ALLOWED_TAGS.has(tagName)) {
      return children
    }

    const safeTag =
      tagName === 'b' ? 'strong' :
      tagName === 'i' ? 'em' :
      tagName

    if (safeTag === 'br') return '<br />'
    if (safeTag === 'a') {
      const href = el.getAttribute('href') || ''
      try {
        const parsed = new URL(href)
        if (!['http:', 'https:'].includes(parsed.protocol)) return children
        return `<a href="${escapeHtml(parsed.toString())}" target="_blank" rel="noreferrer">${children}</a>`
      } catch {
        return children
      }
    }
    return `<${safeTag}>${children}</${safeTag}>`
  }

  return Array.from(doc.body.childNodes).map(sanitizeNode).join('')
}

export function bodyHasHtml(content: string) {
  return HTML_TAG_RE.test(content || '')
}

export function normalizeAnnouncementBodyForEditor(content: string) {
  if (!content) return ''
  if (bodyHasHtml(content)) return sanitizeHtmlWithDom(content)
  return escapeHtml(content).replace(/\r?\n/g, '<br />')
}

export function normalizeAnnouncementBodyForDisplay(content: string) {
  if (!content) return ''
  if (bodyHasHtml(content)) return sanitizeHtmlWithDom(content)
  return escapeHtml(content).replace(/\r?\n/g, '<br />')
}

export function announcementBodyToPlainText(content: string) {
  if (!content) return ''
  if (typeof window !== 'undefined' && bodyHasHtml(content)) {
    const parser = new DOMParser()
    const doc = parser.parseFromString(content, 'text/html')
    doc.querySelectorAll('a[href]').forEach((anchor) => {
      const href = anchor.getAttribute('href')
      if (href && !(anchor.textContent || '').includes(href)) {
        anchor.append(` (${href})`)
      }
    })
    return (doc.body.textContent || '').replace(/\u00a0/g, ' ')
  }

  return content
    .replace(/<[^>]*>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
