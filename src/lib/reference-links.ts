export type ReferenceLink = {
  label: string
  url: string
}

export function isMissingReferenceLinksColumn(error: { message?: string } | null | undefined) {
  return Boolean(error?.message && /reference_links/i.test(error.message))
}

export function normalizeReferenceLinks(links: ReferenceLink[], limit = 10) {
  const populated = links
    .map((link) => ({ label: link.label.trim(), url: link.url.trim() }))
    .filter((link) => link.url)

  if (populated.length > limit) throw new Error(`Add no more than ${limit} links.`)

  return populated.map((link) => {
    let parsed: URL
    try {
      parsed = new URL(link.url)
    } catch {
      throw new Error('Enter a complete link beginning with https:// or http://.')
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Links must use http:// or https://.')
    return { label: link.label || parsed.hostname.replace(/^www\./, ''), url: parsed.toString() }
  })
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function appendAnnouncementFallbackLinks(body: string, links: ReferenceLink[]) {
  if (links.length === 0) return body
  const items = links
    .map((link) => `<li><a href="${escapeHtml(link.url)}">${escapeHtml(link.label)}</a></li>`)
    .join('')
  return `${body}<div data-announcement-reference-links="true"><p><strong>Links</strong></p><ul>${items}</ul></div>`
}

export function extractAnnouncementFallbackLinks(body: string): { body: string; links: ReferenceLink[] } {
  if (typeof window === 'undefined' || !body.includes('data-announcement-reference-links')) {
    return { body, links: [] }
  }

  const parser = new DOMParser()
  const document = parser.parseFromString(body, 'text/html')
  const container = document.querySelector('[data-announcement-reference-links="true"]')
  if (!container) return { body, links: [] }

  const links = Array.from(container.querySelectorAll('a[href]')).flatMap((anchor) => {
    const url = anchor.getAttribute('href')?.trim()
    if (!url) return []
    return [{ label: anchor.textContent?.trim() || url, url }]
  })
  container.remove()
  return { body: document.body.innerHTML, links }
}
