// Parses a page built from the site's own newsletter issue template
// (pages/newsletters/newsletter_issue_N.html on txbosso.com) into the
// fields the admin newsletter compose form expects. This is intentionally
// tailored to that one known template rather than a general-purpose HTML
// parser, since the site controls exactly what markup it produces.

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  eacute: 'é',
  larr: '←',
  rarr: '→',
  middot: '·',
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, code: string) => {
    if (code[0] === '#') {
      const codePoint = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match
    }
    return NAMED_ENTITIES[code] ?? match
  })
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim()
}

function firstMatch(source: string, pattern: RegExp): string {
  const match = source.match(pattern)
  return match ? stripTags(match[1]) : ''
}

function resolveImageUrl(src: string): string {
  if (/^https?:\/\//i.test(src)) return src
  const cleaned = src.replace(/^(\.\.\/)+/, '').replace(/^\/+/, '')
  return `https://txbosso.com/${cleaned}`
}

export interface ImportedStory {
  tag: string
  headline: string
  byline: string
  body: string
  imageUrl: string
}

export interface ImportedIssue {
  title: string
  date: string
  lead: string
  stories: ImportedStory[]
}

export function parseNewsletterIssueHtml(html: string): ImportedIssue {
  const masthead = html.match(/<section class="masthead">([\s\S]*?)<\/section>/)?.[1] || ''
  const title = firstMatch(masthead, /<h1>([\s\S]*?)<\/h1>/)
  const date = firstMatch(masthead, /<p class="issue-date">([\s\S]*?)<\/p>/)
  const lead = firstMatch(masthead, /<p class="lead">([\s\S]*?)<\/p>/)

  const stories: ImportedStory[] = []
  const articleRe = /<article class="story"[^>]*>([\s\S]*?)<\/article>/g
  let articleMatch: RegExpExecArray | null
  while ((articleMatch = articleRe.exec(html))) {
    const block = articleMatch[1]
    const tag = firstMatch(block, /<p class="story-tag">([\s\S]*?)<\/p>/)
    const headline = firstMatch(block, /<h2>([\s\S]*?)<\/h2>/)
    const byline = firstMatch(block, /<p class="byline">([\s\S]*?)<\/p>/)
    const imageSrc = block.match(/<img[^>]*src="([^"]+)"/)?.[1]
    const imageUrl = imageSrc ? resolveImageUrl(imageSrc) : ''

    // Every <p> that isn't the tag or byline line is body copy, including
    // ones inside a <blockquote> - paragraph order in the source is
    // preserved by matching in document order.
    const paragraphs: string[] = []
    const pRe = /<p(?:\s+class="([^"]*)")?[^>]*>([\s\S]*?)<\/p>/g
    let pMatch: RegExpExecArray | null
    while ((pMatch = pRe.exec(block))) {
      const cls = pMatch[1] || ''
      if (cls === 'story-tag' || cls === 'byline') continue
      const text = stripTags(pMatch[2])
      if (text) paragraphs.push(text)
    }

    if (headline && paragraphs.length > 0) {
      stories.push({ tag, headline, byline, body: paragraphs.join('\n\n'), imageUrl })
    }
  }

  return { title, date, lead, stories }
}
