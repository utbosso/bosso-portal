const cheerio = require('cheerio')
const { chromium } = require('playwright')

const SOURCES = [
  {
    name: 'Indeed Sports Jobs',
    url: 'https://www.indeed.com/jobs?q=sports&l=',
    waitForSelector: '.job_seen_beacon, .jobsearch-SerpJobCard',
    timeout: 60000,
    selectors: {
      card: '.job_seen_beacon, .jobsearch-SerpJobCard, [class*="job_"]',
      title: 'h2.jobTitle span[title], h2 a span, .jobTitle',
      company: '[data-testid="company-name"], .companyName',
      location: '[data-testid="text-location"], .companyLocation',
      link: 'h2 a',
    },
  },
]

const sanitize = (value) => (value || '').replace(/\s+/g, ' ').trim()

const absoluteUrl = (base, href) => {
  try {
    return new URL(href, base).toString()
  } catch {
    return null
  }
}

const parseCards = (html, source) => {
  const $ = cheerio.load(html)
  const cards = []
  const cardElements = $(source.selectors.card)

  console.log(`  Found ${cardElements.length} card elements using selector: ${source.selectors.card}`)

  cardElements.each((_, el) => {
    const title = sanitize($(el).find(source.selectors.title).first().text())
    const company = sanitize($(el).find(source.selectors.company).first().text())
    const location = sanitize($(el).find(source.selectors.location).first().text())
    const linkEl = $(el).find(source.selectors.link).first()
    const href = linkEl.attr('href')
    const link = href ? absoluteUrl(source.url, href) : null

    if (title || link) {
      cards.push({ title, company, location, link })
    }
  })

  if (cards.length > 0) {
    console.log(`  Sample cards (first 3):`)
    cards.slice(0, 3).forEach((card, i) => {
      console.log(`    ${i + 1}. ${card.title}`)
      console.log(`       Company: ${card.company || 'N/A'}`)
      console.log(`       Location: ${card.location || 'N/A'}`)
      console.log(`       Link: ${card.link || 'N/A'}`)
    })
  }

  return cards
}

const fetchHtml = async (source, browser) => {
  const page = await browser.newPage()
  const timeout = source.timeout || 60000

  try {
    console.log(`  Navigating to ${source.url}...`)
    await page.goto(source.url, { waitUntil: 'networkidle', timeout })

    if (source.waitForSelector) {
      try {
        console.log(`  Waiting for selector: ${source.waitForSelector}`)
        await page.waitForSelector(source.waitForSelector, { timeout: 10000 })
        console.log(`  Selector found!`)
      } catch (e) {
        console.log(`  Warning: waitForSelector "${source.waitForSelector}" not found, continuing anyway`)
      }
    }

    await page.waitForTimeout(2000)

    const content = await page.content()
    await page.close()
    return content
  } catch (error) {
    await page.close()
    throw error
  }
}

const main = async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    for (const source of SOURCES) {
      console.log(`\n=== Testing ${source.name} ===`)
      try {
        const html = await fetchHtml(source, browser)
        const cards = parseCards(html, source)
        console.log(`  Total cards found: ${cards.length}\n`)
      } catch (error) {
        console.error(`  Failed: ${error.message}\n`)
      }
    }
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error('Test failed:', error)
  process.exit(1)
})
