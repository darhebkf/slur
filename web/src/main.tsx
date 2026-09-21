import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { type GeneratedContent } from './generated-content.ts'

declare global {
  interface Window {
    __SLUR_INITIAL_CONTENT__?: GeneratedContent
  }
}

const root = document.getElementById('root')!
const initialContent = window.__SLUR_INITIAL_CONTENT__
const app = (
  <StrictMode>
    <App initialContent={initialContent} />
  </StrictMode>
)

if (root.hasChildNodes() && initialContent) {
  hydrateRoot(root, app)
} else {
  createRoot(root).render(app)
}
