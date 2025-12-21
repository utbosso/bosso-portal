require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')
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

// Focused on entry-level and internships only
const SOURCES = [
  {
    name: 'TeamWork Online - Internships',
    url: 'https://www.teamworkonline.com/sports-jobs/internships',
    type: 'playwright',
  },
  {
    name: 'WorkInSports - Entry Level',
    url: 'https://www.workinsports.com/sports-jobs/level/entry-level',
    type: 'playwright',
  },
  {
    name: 'WorkInSports - Internships',
    url: 'https://www.workinsports.com/sports-jobs/level/internships',
    type: 'playwright',
  },
  {
    name: 'NCAA Market - Internships',
    url: 'https://ncaamarket.ncaa.org/jobs?keywords=intern',
    type: 'playwright',
  },
]

const sanitize = (text) => (text || '').replace(/\s+/g, ' ').trim()

const scrapeWithPlaywright = async (url, browser) => {
  const page = await browser.newPage()
  const opportunities = []

  try {
    console.log(`  Navigating to ${url}...`)

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 45000
    })

    // Wait for page to be somewhat loaded
    await page.waitForTimeout(3000)

    // Take a screenshot for debugging (optional)
    if (process.env.DEBUG) {
      await page.screenshot({ path: `debug-${Date.now()}.png` })
    }

    // Extract all links that look like job postings
    const jobLinks = await page.evaluate(() => {
      const links = []
      const anchors = document.querySelectorAll('a[href]')

      anchors.forEach(a => {
        const href = a.href
        const text = a.textContent.trim()

        // Look for job-related URLs
        if (href.includes('/jobs/') ||
            href.includes('/job/') ||
            href.includes('/careers/') ||
            href.includes('job-detail') ||
            href.includes('posting')) {

          // Get context (title might be in parent elements)
          let title = text
          let company = ''
          let location = ''

          // Try to find title/company/location in nearby elements
          const parent = a.closest('article, li, div[class*="job"], div[class*="posting"]')
          if (parent) {
            const titleEl = parent.querySelector('h2, h3, h4, [class*="title"], [class*="job-title"]')
            const companyEl = parent.querySelector('[class*="company"], [class*="organization"]')
            const locationEl = parent.querySelector('[class*="location"]')

            if (titleEl) title = titleEl.textContent.trim()
            if (companyEl) company = companyEl.textContent.trim()
            if (locationEl) location = locationEl.textContent.trim()
          }

          if (title && title.length > 5 && title.length < 200) {
            links.push({
              title,
              company,
              location,
              link: href
            })
          }
        }
      })

      return links
    })

    console.log(`  Found ${jobLinks.length} potential job links`)

    if (process.env.DEBUG && jobLinks.length > 0) {
      console.log(`  Sample jobs:`, jobLinks.slice(0, 3))
    }

    // Deduplicate by URL
    const uniqueJobs = []
    const seenUrls = new Set()

    for (const job of jobLinks) {
      if (!seenUrls.has(job.link)) {
        seenUrls.add(job.link)
        uniqueJobs.push(job)
      }
    }

    console.log(`  ${uniqueJobs.length} unique opportunities after deduplication`)

    if (uniqueJobs.length > 0 && process.env.DEBUG) {
      console.log(`  First unique job:`, uniqueJobs[0])
    }

    opportunities.push(...uniqueJobs)

  } catch (error) {
    console.error(`  Error: ${error.message}`)
  } finally {
    await page.close()
  }

  return opportunities
}

const inferType = (title) => {
  const lower = title.toLowerCase()
  // Match the enum values from your database
  if (lower.includes('intern')) return 'internship'
  return 'internship' // Default to internship for this scraper
}

const saveOpportunities = async (opportunities, sourceName) => {
  if (!opportunities.length) return 0

  const links = opportunities.map(o => o.link).filter(Boolean)

  // Check which ones already exist
  const { data: existing } = await supabase
    .from('opportunities')
    .select('link')
    .in('link', links)

  const existingLinks = new Set((existing || []).map(row => row.link))

  // Filter out existing ones
  const newOpportunities = opportunities
    .filter(o => o.link && !existingLinks.has(o.link))
    .map(o => ({
      title: sanitize(o.title),
      company: sanitize(o.company) || 'Unknown',
      location: sanitize(o.location) || 'Not specified',
      opportunity_type: inferType(o.title),
      link: o.link,
      description: null,
      source: sourceName,
      posted_by: null, // Will be null for scraper-added opportunities
    }))

  if (!newOpportunities.length) return 0

  const { error } = await supabase
    .from('opportunities')
    .insert(newOpportunities)

  if (error) {
    console.error(`  Error inserting: ${error.message}`)
    return 0
  }

  return newOpportunities.length
}

const main = async () => {
  let totalInserted = 0
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  })

  try {
    for (const source of SOURCES) {
      console.log(`\n=== ${source.name} ===`)

      try {
        const opportunities = await scrapeWithPlaywright(source.url, browser)
        const inserted = await saveOpportunities(opportunities, source.name)

        totalInserted += inserted
        console.log(`  ✓ Inserted ${inserted} new opportunities`)
      } catch (error) {
        console.error(`  ✗ Failed: ${error.message}`)
      }
    }
  } finally {
    await browser.close()
  }

  console.log(`\n========================================`)
  console.log(`Total new opportunities inserted: ${totalInserted}`)
  console.log(`========================================\n`)
}

main().catch((error) => {
  console.error('Scraper failed:', error)
  process.exit(1)
})
