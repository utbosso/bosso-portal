function decodeEntities(text: string) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

// Announcement bodies are stored as rich-text HTML; turn them into readable
// paragraphs (links kept as "text (url)") for the email template.
export function bodyToParagraphs(content: string): string[] {
  // The editor appends its own "Links" block; the email template renders reference links itself.
  let text = (content || '').replace(/<div data-announcement-reference-links[\s\S]*$/i, '')
  if (/<[a-z][\s\S]*>/i.test(text)) {
    text = text
      .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_match, href: string, label: string) => {
        const plain = label.replace(/<[^>]*>/g, '')
        return plain.includes(href) ? plain : `${plain} (${href})`
      })
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n\n')
      .replace(/<[^>]*>/g, '')
  }
  return decodeEntities(text)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}
