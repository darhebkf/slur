import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { type GeneratedContent } from './generated-content.ts'
import IntegrationPage from './IntegrationPage.tsx'
import { integrationForPathname } from './seo-pages.ts'

declare global {
  interface Window {
    __SLUR_INITIAL_CONTENT__?: GeneratedContent
    __SLUR_PRERENDERED__?: boolean
  }
}

const root = document.getElementById('root')!
const initialContent = window.__SLUR_INITIAL_CONTENT__
const integration = integrationForPathname(window.location.pathname)
const app = (
  <StrictMode>
    {integration ? (
      <IntegrationPage integration={integration} />
    ) : (
      <App initialContent={initialContent} />
    )}
  </StrictMode>
)

if (root.hasChildNodes() && window.__SLUR_PRERENDERED__) {
  hydrateRoot(root, app)
} else {
  createRoot(root).render(app)
}
