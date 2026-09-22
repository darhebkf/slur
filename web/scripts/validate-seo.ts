import { readFile } from 'node:fs/promises'

import { metadataForPathname, seoRoutes } from '../src/seo-pages.ts'

const outputRoot = new URL('../../dist/', import.meta.url)
const titles = new Set<string>()
const descriptions = new Set<string>()
const canonicals = new Set<string>()

/** Extracts one capture group or throws a route-specific validation error. */
function capture(html: string, pattern: RegExp, label: string, pathname: string): string {
  const match = html.match(pattern)
  if (!match?.[1]) throw new Error(`${pathname}: missing ${label}`)
  return match[1]
}

for (const pathname of seoRoutes) {
  const outputPath = pathname === '/'
    ? new URL('index.html', outputRoot)
    : new URL(`.${pathname}index.html`, outputRoot)
  const html = await readFile(outputPath, 'utf8')
  const expected = metadataForPathname(pathname)
  const title = capture(html, /<title>([\s\S]*?)<\/title>/, 'title', pathname)
  const description = capture(
    html,
    /<meta name="description" content="([^"]+)" \/>/,
    'description',
    pathname,
  )
  const canonical = capture(
    html,
    /<link rel="canonical" href="([^"]+)" \/>/,
    'canonical',
    pathname,
  )
  const structuredData = capture(
    html,
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
    'JSON-LD',
    pathname,
  )
  const headingCount = html.match(/<h1(?:\s|>)/g)?.length ?? 0

  if (headingCount !== 1) throw new Error(`${pathname}: expected one h1, found ${headingCount}`)
  if (canonical !== expected.canonical) throw new Error(`${pathname}: canonical mismatch`)
  if (html.includes('content="noindex')) throw new Error(`${pathname}: unexpectedly noindexed`)
  JSON.parse(structuredData)
  titles.add(title)
  descriptions.add(description)
  canonicals.add(canonical)
}

const routeCount = seoRoutes.length
if (titles.size !== routeCount) throw new Error('SEO titles must be unique.')
if (descriptions.size !== routeCount) throw new Error('Meta descriptions must be unique.')
if (canonicals.size !== routeCount) throw new Error('Canonical URLs must be unique.')

const sitemap = await readFile(new URL('sitemap.xml', outputRoot), 'utf8')
const sitemapUrls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1])
const expectedUrls = seoRoutes.map((pathname) => `https://ruls.dev${pathname}`)
if (JSON.stringify(sitemapUrls) !== JSON.stringify(expectedUrls)) {
  throw new Error('Sitemap routes do not match prerendered routes.')
}

const robots = await readFile(new URL('robots.txt', outputRoot), 'utf8')
if (!robots.includes('Sitemap: https://ruls.dev/sitemap.xml')) {
  throw new Error('robots.txt does not advertise the sitemap.')
}

const notFound = await readFile(new URL('404.html', outputRoot), 'utf8')
if (!notFound.includes('content="noindex, follow"')) {
  throw new Error('404.html must be noindexed.')
}

console.log(`Validated SEO output for ${routeCount} routes.`)
