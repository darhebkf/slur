import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'

import { render } from '../.ssr/entry-server.js'
import { metadataForPathname, seoRoutes, type SeoMetadata } from '../src/seo-pages.ts'

const outputRoot = new URL('../../dist/', import.meta.url)
const indexPath = new URL('index.html', outputRoot)
const serverBuildPath = new URL('../.ssr', import.meta.url)

/** Serializes hydration state without allowing a closing script tag. */
function serialize(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029')
}

/** Escapes a value before placing it inside an HTML attribute. */
function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

/** Replaces one named meta element in the document template. */
function replaceMeta(
  document: string,
  attribute: 'name' | 'property',
  key: string,
  content: string,
): string {
  const pattern = new RegExp(`<meta\\s+${attribute}="${key}"[\\s\\S]*?\\/>`)
  return document.replace(
    pattern,
    `<meta ${attribute}="${key}" content="${escapeAttribute(content)}" />`,
  )
}

/** Applies unique search and social metadata to a route document. */
function applyMetadata(document: string, metadata: SeoMetadata): string {
  const title = escapeAttribute(metadata.title)
  let output = document
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
    .replace(
      /<link\s+rel="canonical"[\s\S]*?\/>/,
      `<link rel="canonical" href="${escapeAttribute(metadata.canonical)}" />`,
    )
    .replace(
      /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
      `<script type="application/ld+json">${serialize(metadata.structuredData)}</script>`,
    )

  output = replaceMeta(output, 'name', 'title', metadata.title)
  output = replaceMeta(output, 'name', 'description', metadata.description)
  output = replaceMeta(output, 'property', 'og:type', metadata.ogType)
  output = replaceMeta(output, 'property', 'og:url', metadata.canonical)
  output = replaceMeta(output, 'property', 'og:title', metadata.title)
  output = replaceMeta(output, 'property', 'og:description', metadata.description)
  output = replaceMeta(output, 'property', 'og:image:alt', metadata.imageAlt)
  output = replaceMeta(output, 'name', 'twitter:title', metadata.title)
  output = replaceMeta(output, 'name', 'twitter:description', metadata.description)
  output = replaceMeta(output, 'name', 'twitter:image:alt', metadata.imageAlt)
  return output
}

const template = await readFile(indexPath, 'utf8')

for (const pathname of seoRoutes) {
  const { html, initialContent } = render(pathname)
  const metadata = metadataForPathname(pathname)
  const hydrationState = initialContent
    ? `window.__SLUR_INITIAL_CONTENT__=${serialize(initialContent)};`
    : ''
  const state = `<script>window.__SLUR_PRERENDERED__=true;${hydrationState}</script>`
  const document = applyMetadata(template, metadata).replace(
    '<div id="root"></div>',
    `<div id="root">${html}</div>${state}`,
  )

  if (!document.includes('window.__SLUR_PRERENDERED__=true')) {
    throw new Error(`Could not prerender ${pathname}.`)
  }

  const outputPath = pathname === '/'
    ? indexPath
    : new URL(`.${pathname}index.html`, outputRoot)
  await mkdir(new URL('.', outputPath), { recursive: true })
  await writeFile(outputPath, document)
}

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...seoRoutes.map(
    (pathname) =>
      `  <url><loc>https://ruls.dev${pathname}</loc><lastmod>2026-09-22</lastmod></url>`,
  ),
  '</urlset>',
  '',
].join('\n')
await writeFile(new URL('sitemap.xml', outputRoot), sitemap)
await rm(serverBuildPath, { recursive: true, force: true })
