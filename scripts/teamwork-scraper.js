require('dotenv').config()
const { chromium } = require('playwright')
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const TEAMWORK_SEARCH_URL =
  process.env.TEAMWORK_SEARCH_URL ||
  'https://www.teamworkonline.com/jobs-in-sports?employment_opportunity_search%5Bquery%5D=internship&employment_opportunity_search%5Bsort_by%5D=most_recent&employment_opportunity_search%5Bcareer_level_ids%5D%5B%5D=97&commit=Search'
const TEAMWORK_BASE_URL = 'https://www.teamworkonline.com'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const args = process.argv.slice(2)
const shouldPush = args.includes('--push')
const debug = args.includes('--debug')
const limitArg = args.find((arg) => arg.startsWith('--limit='))
const limit = limitArg ? Number(limitArg.split('=')[1]) : null

const sanitize = (text = '', maxLength = 255) => {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  return cleaned.length > maxLength ? `${cleaned.substring(0, maxLength - 3)}...` : cleaned
}

async function scrapeTeamworkInternships() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    console.log(`Visiting ${TEAMWORK_SEARCH_URL}`)

    // TeamWork Online can hang on networkidle; prefer domcontentloaded and retry once on timeout.
    const gotoWithRetry = async (url) => {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 })
          await page.waitForLoadState('domcontentloaded')
          await page.waitForTimeout(7000)
          return
        } catch (err) {
          console.warn(`Navigation attempt ${attempt} failed: ${err.message}`)
          if (attempt === 2) throw err
          await page.waitForTimeout(3000)
        }
      }
    }

    await gotoWithRetry(TEAMWORK_SEARCH_URL)
    await page.waitForSelector('a[href*="/job"], a[href*="/jobs/"], a[href*="/apply/"]', {
      timeout: 30000,
    })
    await page.waitForTimeout(3000)

    const rawJobs = await page.evaluate((baseUrl) => {
      const results = []
      const seen = new Set()

      const normalizeLink = (href) => {
        if (!href) return ''
        if (href.startsWith('http')) return href.replace(/\/$/, '')
        try {
          return new URL(href, baseUrl).href.replace(/\/$/, '')
        } catch (_err) {
          return href
        }
      }

      const pushJob = (linkEl, cardEl) => {
        const rawHref = linkEl?.getAttribute('href') || linkEl?.href || ''
        const href = normalizeLink(rawHref)
        if (!href) return
        if (href.includes('employment_opportunity_search')) return

        const isJobPath =
          href.includes('/job') ||
          href.includes('/jobs/') ||
          href.includes('/jobs-') ||
          href.includes('/jobs?') ||
          href.includes('/employment_opportunities/') ||
          /intern/i.test(href)
        if (!isJobPath) return

        if (seen.has(href)) return
        seen.add(href)

        let title = (linkEl.textContent || '').trim()
        let company = ''
        let location = ''

        const card = cardEl || linkEl.closest('article, li, tr, div')
        if (card) {
          const heading = card.querySelector(
            'h1, h2, h3, h4, .job-title, .title, .browse-jobs-card__content--title'
          )
          if (heading && heading.textContent.trim().length > 6) {
            title = heading.textContent.trim()
          }

          const companyEl =
            card.querySelector(
              '.company, .organization, [class*="company"], [class*="org"], .browse-jobs-card__content--organization'
            ) || null
          if (companyEl && companyEl.textContent.trim()) {
            company = companyEl.textContent.trim()
          }

          const locationEl =
            card.querySelector(
              '.location, [class*="location"], .job-location, .browse-jobs-card__content--bottom_row .trending__content--small'
            ) || null
          if (locationEl && locationEl.textContent.trim()) {
            location = locationEl.textContent.trim()
          }

          const lines = card.innerText
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)

          for (const line of lines) {
            const lower = line.toLowerCase()
            if (!company && line.length > 2 && line.length < 120 && !lower.includes('intern')) {
              company = line
            }
            if (!location && (lower.includes('remote') || line.includes(','))) {
              location = line
            }
            if (company && location) break
          }
        }

        results.push({
          title: title || '',
          link: href,
          company,
          location,
        })
      }

      // Prefer structured job cards on the listing page
      const cards =
        document.querySelectorAll(
          '.browse-jobs-card, .employment-opportunity, [data-job-id], [class*="job-card"], [class*="job-list"], article.job, li.job, li[class*="job"], .job'
        ) || []
      cards.forEach((card) => {
        const linkEl =
          card.querySelector(
            '.browse-jobs-card__content--title, .browse-jobs-card__content--title a, a[href*="/job"], a[href*="/apply/"], a[href*="/jobs/"]'
          ) || null
        if (linkEl) pushJob(linkEl, card)
      })

      // Fallback: scan all anchors if we found nothing
      if (results.length === 0) {
        const anchors = Array.from(document.querySelectorAll('a[href]'))
        anchors.forEach((anchor) => pushJob(anchor, null))
      }

      return results
    }, TEAMWORK_BASE_URL)

    if (debug) {
      const dumpDir = path.join(__dirname, 'html-dumps')
      if (!fs.existsSync(dumpDir)) fs.mkdirSync(dumpDir, { recursive: true })
      const htmlPath = path.join(dumpDir, 'teamwork.html')
      fs.writeFileSync(htmlPath, await page.content(), 'utf8')
      console.log(`Saved debug HTML to ${htmlPath}`)
    }

    await browser.close()
    return rawJobs
  } catch (error) {
    await browser.close()
    throw error
  }
}

async function pushToSupabase(rows) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --push')
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const links = rows.map((row) => row.link).filter(Boolean)
  const { data: existing, error: fetchError } = await supabase
    .from('opportunities')
    .select('link')
    .in('link', links)

  if (fetchError) throw fetchError

  const existingLinks = new Set((existing || []).map((row) => row.link))
  const toInsert = rows.filter((row) => !existingLinks.has(row.link))

  if (!toInsert.length) {
    console.log('No new rows to insert.')
    return
  }

  const { error: insertError } = await supabase.from('opportunities').insert(toInsert)
  if (insertError) throw insertError

  console.log(`Inserted ${toInsert.length} new rows into opportunities.`)
}

;(async () => {
  try {
    const rawJobs = await scrapeTeamworkInternships()
    const internships = rawJobs.filter((job) => /intern/i.test(job.title))

    const normalized = internships
      .map((job) => {
        const title = sanitize(job.title)
        const company = sanitize(job.company) || 'Unknown'
        const location = sanitize(job.location) || null
        const link = job.link

        if (!title || title.length < 4 || !link) return null

        return {
          title,
          company,
          location,
          opportunity_type: 'internship',
          link,
          description: null,
          source: 'TeamWork Online',
          posted_by: null,
        }
      })
      .filter(Boolean)

    const dedupedByLink = Array.from(
      normalized.reduce((map, job) => map.set(job.link, job), new Map())
    ).map(([, job]) => job)

    const limited = limit ? dedupedByLink.slice(0, limit) : dedupedByLink

    console.log(`Found ${limited.length} internship postings (after filtering & dedupe).`)
    limited.forEach((job) =>
      console.log(
        `- ${job.title}${job.company ? ` | ${job.company}` : ''}${
          job.location ? ` | ${job.location}` : ''
        }`
      )
    )

    if (shouldPush) {
      console.log('Pushing to Supabase...')
      await pushToSupabase(limited)
    } else {
      console.log('Dry run only. Pass --push to insert into Supabase.')
    }
  } catch (error) {
    console.error('Scraper failed:', error.message)
    process.exit(1)
  }
})()
