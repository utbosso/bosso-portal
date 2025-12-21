require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')
const cheerio = require('cheerio')
const { chromium } = require('playwright')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const SPORTS_KEYWORDS = (process.env.SPORTS_KEYWORDS || [
  'sports',
  'athletic',
  'athletics',
  'basketball',
  'football',
  'soccer',
  'baseball',
  'hockey',
  'golf',
  'tennis',
  'esports',
  'stadium',
  'arena',
  'league',
  'team',
  'ncaa',
  'mlb',
  'nba',
  'nfl',
  'nhl',
  'mls',
  'wnba',
]).join('|')

const KEYWORD_REGEX = new RegExp(SPORTS_KEYWORDS, 'i')

const SOURCES = [
  {
    name: 'LinkedIn Jobs (Sports)',
    url: 'https://www.linkedin.com/jobs/search?keywords=sports&location=United%20States',
    mode: 'browser',
    waitForSelector: '.job-search-card, .jobs-search__results-list li',
    timeout: 90000,
    selectors: {
      card: '.job-search-card, .base-card, .jobs-search__results-list li',
      title: 'h3.base-search-card__title, .base-search-card__title',
      company: 'h4.base-search-card__subtitle, .base-search-card__subtitle',
      location: '.job-search-card__location, .job-search-card__location-text',
      link: 'a.base-card__full-link',
    },
  },
  {
    name: 'ZipRecruiter Sports Jobs',
    url: 'https://www.ziprecruiter.com/jobs-search?search=sports&location=',
    mode: 'browser',
    waitForSelector: 'article.job_result, .job-listing',
    timeout: 60000,
    selectors: {
      card: 'article.job_result, article',
      title: 'h2 a, .job_title a',
      company: '.hiring_company_text, .company',
      location: '.location, .job_location',
      link: 'h2 a',
    },
  },
  {
    name: 'Glassdoor Sports Jobs',
    url: 'https://www.glassdoor.com/Job/sports-jobs-SRCH_KO0,6.htm',
    mode: 'browser',
    waitForSelector: 'li[data-test="jobListing"], .react-job-listing',
    timeout: 60000,
    selectors: {
      card: 'li[data-test="jobListing"], .react-job-listing',
      title: '[data-test="job-title"], .job-title',
      company: '[data-test="employer-name"], .employer-name',
      location: '[data-test="emp-location"], .location',
      link: 'a[data-test="job-link"]',
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

const inferType = (title, description) => {
  const text = `${title} ${description}`.toLowerCase()
  if (text.includes('intern')) return 'internship'
  if (text.includes('entry')) return 'entry_level'
  return 'entry_level'
}

const isSportsRelated = (title, company, description) => {
  const text = `${title} ${company} ${description}`.toLowerCase()
  return KEYWORD_REGEX.test(text)
}

const parseCards = (html, source) => {
  const $ = cheerio.load(html)
  const cards = []
  const cardElements = $(source.selectors.card)

  if (process.env.DEBUG) {
    console.log(`  Found ${cardElements.length} card elements using selector: ${source.selectors.card}`)
  }

  cardElements.each((_, el) => {
    const title = sanitize($(el).find(source.selectors.title).first().text())
    const company = sanitize($(el).find(source.selectors.company).first().text())
    const location = sanitize($(el).find(source.selectors.location).first().text())
    const linkEl = $(el).find(source.selectors.link).first()
    const href = linkEl.attr('href')
    const link = href ? absoluteUrl(source.url, href) : null
    if (!title || !link) return
    cards.push({ title, company, location, link })
  })

  if (process.env.DEBUG && cards.length > 0) {
    console.log(`  Sample card:`, cards[0])
  }

  return cards
}

const fetchHtml = async (source, browser) => {
  if (source.mode === 'skip') {
    throw new Error('Source disabled (update URL or selectors)')
  }
  if (source.mode === 'browser') {
    const page = await browser.newPage()
    const timeout = source.timeout || 60000

    try {
      await page.goto(source.url, { waitUntil: 'networkidle', timeout })

      // Wait for specific selector if provided
      if (source.waitForSelector) {
        try {
          await page.waitForSelector(source.waitForSelector, { timeout: 10000 })
        } catch (e) {
          console.log(`  Warning: waitForSelector "${source.waitForSelector}" not found, continuing anyway`)
        }
      }

      // Give JS time to render
      await page.waitForTimeout(2000)

      const content = await page.content()
      await page.close()
      return content
    } catch (error) {
      await page.close()
      throw error
    }
  }

  const res = await fetch(source.url)
  if (!res.ok) {
    throw new Error(`Failed to fetch ${source.url}: ${res.status}`)
  }
  return res.text()
}

const loadExistingLinks = async (links) => {
  if (!links.length) return new Set()
  const { data, error } = await supabase
    .from('opportunities')
    .select('link')
    .in('link', links)
  if (error) throw error
  return new Set((data ?? []).map((row) => row.link))
}

const saveOpportunities = async (opportunities) => {
  if (!opportunities.length) return 0
  const links = opportunities.map((item) => item.link).filter(Boolean)
  const existing = await loadExistingLinks(links)
  const newRows = opportunities.filter((item) => item.link && !existing.has(item.link))

  if (!newRows.length) return 0

  const { error } = await supabase
    .from('opportunities')
    .insert(newRows)
  if (error) throw error
  return newRows.length
}

const main = async () => {
  let totalInserted = 0
  const browser = await chromium.launch({ headless: true })
  try {
    for (const source of SOURCES) {
      try {
        const html = await fetchHtml(source, browser)
        const rawCards = parseCards(html, source)
        const items = rawCards
          .map((card) => ({
            title: card.title,
            company: card.company || null,
            location: card.location || null,
            opportunity_type: inferType(card.title, ''),
            link: card.link,
            description: null,
            source: source.name,
            posted_by: null,
          }))
          .filter((item) => isSportsRelated(item.title, item.company, item.description))

        const inserted = await saveOpportunities(items)
        totalInserted += inserted
        console.log(`${source.name}: ${inserted} new opportunities`)
      } catch (error) {
        console.error(`${source.name} failed:`, error.message)
      }
    }
  } finally {
    await browser.close()
  }

  console.log(`Total inserted: ${totalInserted}`)
}

main().catch((error) => {
  console.error('Scraper failed:', error)
  process.exit(1)
})
