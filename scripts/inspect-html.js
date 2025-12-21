const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const SITES = [
  { name: 'teamwork-online', url: 'https://www.teamworkonline.com/jobs' },
  { name: 'workinsports', url: 'https://www.workinsports.com/jobs' },
]

const main = async () => {
  const browser = await chromium.launch({ headless: true })
  const outputDir = path.join(__dirname, 'html-dumps')

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  try {
    for (const site of SITES) {
      console.log(`\nInspecting ${site.name}...`)
      const page = await browser.newPage()

      try {
        await page.goto(site.url, { waitUntil: 'networkidle', timeout: 90000 })
        await page.waitForTimeout(3000)

        const html = await page.content()
        const outputPath = path.join(outputDir, `${site.name}.html`)
        fs.writeFileSync(outputPath, html)

        console.log(`  Saved HTML to: ${outputPath}`)
        console.log(`  HTML size: ${(html.length / 1024).toFixed(2)} KB`)

        // Log some basic info
        const bodyText = await page.locator('body').textContent()
        console.log(`  Body text length: ${bodyText.length} characters`)
        console.log(`  First 200 chars: ${bodyText.substring(0, 200).replace(/\s+/g, ' ')}`)

      } catch (error) {
        console.error(`  Failed: ${error.message}`)
      } finally {
        await page.close()
      }
    }
  } finally {
    await browser.close()
  }

  console.log(`\nHTML dumps saved to: ${outputDir}`)
  console.log(`You can open these files to inspect the actual HTML structure.`)
}

main().catch((error) => {
  console.error('Failed:', error)
  process.exit(1)
})
