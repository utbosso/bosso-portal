const { createClient } = require('@supabase/supabase-js')
const cheerio = require('cheerio')

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

const DEFAULT_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (compatible; BOSSO-OpportunitiesBot/1.0; +https://example.com)',
}

const SOURCES = [
  {
    name: 'TeamWork Online',
    url: 'https://www.teamworkonline.com/jobs',
    selectors: {
      card: '.job-listing, .jobListing, .job-listing-item, .job-listing-card',
      title: '.job-title, .jobTitle, h3, h4',
      company: '.company, .job-company, .company-name',
      location: '.location, .job-location',
      link: 'a',
    },
  },
  {
    name: 'WorkInSports',
    url: 'https://www.workinsports.com/jobs',
    selectors: {
      card: '.job-listing, .jobListing, .job-item, .job',
      title: '.job-title, h3, h4',
      company: '.job-company, .company',
      location: '.job-location, .location',
      link: 'a',
    },
  },
  {
    name: 'JobsInSports',
    url: 'https://www.jobsinsports.com/job/search',
    selectors: {
      card: '.job-listing, .jobListing, .job-item',
      title: '.job-title, h3, h4',
      company: '.company, .job-company',
      location: '.location, .job-location',
      link: 'a',
    },
  },
  {
    name: 'GlobalSportsJobs',
    url: 'https://www.globalsportsjobs.com/jobs',
    selectors: {
      card: '.job-listing, .jobListing, .job-card',
      title: '.job-title, h3, h4',
      company: '.company, .job-company',
      location: '.location, .job-location',
      link: 'a',
    },
  },
  {
    name: 'CollegeSports.jobs',
    url: 'https://collegesports.jobs',
    selectors: {
      card: '.job, .job-listing, .jobListing',
      title: '.job-title, h3, h4',
      company: '.company, .job-company',
      location: '.location, .job-location',
      link: 'a',
    },
  },
  {
    name: 'USAJobs (Sports keyword)',
    url: 'https://www.usajobs.gov/search?wt=15317&k=sports',
    selectors: {
      card: '.usajobs-search-result--core, .usajobs-search-result',
      title: '.usajobs-search-result__header a, h3 a',
      company: '.usajobs-search-result__agency',
      location: '.usajobs-search-result__location',
      link: 'a',
    },
  },
  {
    name: 'SportsJobs.Online',
    url: 'https://www.sportsjobs.online/jobs',
    selectors: {
      card: '.job-listing, .jobListing, .job-item',
      title: '.job-title, h3, h4',
      company: '.company, .job-company',
      location: '.location, .job-location',
      link: 'a',
    },
  },
  {
    name: 'SFMA Career Center',
    url: 'https://careercenter.sportsfacilities.com/jobs',
    selectors: {
      card: '.job-listing, .jobListing, .job-card',
      title: '.job-title, h3, h4',
      company: '.company, .job-company',
      location: '.location, .job-location',
      link: 'a',
    },
  },
  {
    name: 'Global Football Careers',
    url: 'https://www.globalfootballcareers.com/jobs',
    selectors: {
      card: '.job-listing, .jobListing, .job-card',
      title: '.job-title, h3, h4',
      company: '.company, .job-company',
      location: '.location, .job-location',
      link: 'a',
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
  $(source.selectors.card).each((_, el) => {
    const title = sanitize($(el).find(source.selectors.title).first().text())
    const company = sanitize($(el).find(source.selectors.company).first().text())
    const location = sanitize($(el).find(source.selectors.location).first().text())
    const linkEl = $(el).find(source.selectors.link).first()
    const href = linkEl.attr('href')
    const link = href ? absoluteUrl(source.url, href) : null
    if (!title || !link) return
    cards.push({ title, company, location, link })
  })
  return cards
}

const fetchHtml = async (url) => {
  const res = await fetch(url, { headers: DEFAULT_HEADERS })
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`)
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
  for (const source of SOURCES) {
    try {
      const html = await fetchHtml(source.url)
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

  console.log(`Total inserted: ${totalInserted}`)
}

main().catch((error) => {
  console.error('Scraper failed:', error)
  process.exit(1)
})
