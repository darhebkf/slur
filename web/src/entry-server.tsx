import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'

import App from './App.tsx'
import { createGeneratedContent, type GeneratedContent } from './generated-content.ts'
import IntegrationPage from './IntegrationPage.tsx'
import { integrationForPathname } from './seo-pages.ts'

export interface PrerenderedApp {
  html: string
  initialContent?: GeneratedContent
}

/** Renders crawlable HTML and returns the state required for hydration. */
export function render(pathname = '/'): PrerenderedApp {
  const integration = integrationForPathname(pathname)

  if (integration) {
    return {
      html: renderToString(
        <StrictMode>
          <IntegrationPage integration={integration} />
        </StrictMode>,
      ),
    }
  }

  const initialContent = createGeneratedContent()
  const html = renderToString(
    <StrictMode>
      <App initialContent={initialContent} />
    </StrictMode>,
  )

  return { html, initialContent }
}
