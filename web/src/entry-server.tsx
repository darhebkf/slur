import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'

import App from './App.tsx'
import { createGeneratedContent, type GeneratedContent } from './generated-content.ts'

export interface PrerenderedApp {
  html: string
  initialContent: GeneratedContent
}

/** Renders crawlable HTML and returns the state required for hydration. */
export function render(): PrerenderedApp {
  const initialContent = createGeneratedContent()
  const html = renderToString(
    <StrictMode>
      <App initialContent={initialContent} />
    </StrictMode>,
  )

  return { html, initialContent }
}
