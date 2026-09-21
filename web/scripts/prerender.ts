import { readFile, rm, writeFile } from 'node:fs/promises'

import { render } from '../.ssr/entry-server.js'

const indexPath = new URL('../../dist/index.html', import.meta.url)
const serverBuildPath = new URL('../.ssr', import.meta.url)

/** Serializes hydration state without allowing a closing script tag. */
function serialize(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029')
}

const template = await readFile(indexPath, 'utf8')
const { html, initialContent } = render()
const state = `<script>window.__SLUR_INITIAL_CONTENT__=${serialize(initialContent)}</script>`
const document = template.replace(
  '<div id="root"></div>',
  `<div id="root">${html}</div>${state}`,
)

if (document === template) {
  throw new Error('Could not find the application root in the built HTML.')
}

await writeFile(indexPath, document)
await rm(serverBuildPath, { recursive: true, force: true })
