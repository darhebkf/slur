const SITE_URL = 'https://ruls.dev'

/** Search, installation, and behavior data for one supported coding-agent harness. */
export interface IntegrationPageData {
  slug: string
  harness: string
  target: string
  adapter: string
  behavior: string
  installedAt: string
  invocation: string
  restart: string
  searchIntent: string
  title: string
  description: string
}

/** Complete document metadata emitted for one prerendered route. */
export interface SeoMetadata {
  title: string
  description: string
  canonical: string
  imageAlt: string
  ogType: 'website' | 'article'
  structuredData: Record<string, unknown>
}

/** Supported harness guides in the same order used by the installer. */
export const integrations: IntegrationPageData[] = [
  {
    slug: 'claude-code',
    harness: 'Claude Code',
    target: 'claude',
    adapter: 'Claude Code plugin with a local prompt hook and Slur skill',
    behavior:
      'The hook adds the expanded prompt to model context before inference. Claude Code still shows the submitted /slur text in the conversation.',
    installedAt: '~/.local/share/slur/claude-marketplace',
    invocation: '/slur anywhere in a prompt',
    restart: 'Restart Claude Code after setup so it loads the plugin.',
    searchIntent: 'Claude Code custom command and plugin',
    title: 'Slur Generator for Claude Code | /slur Plugin',
    description:
      'Install /slur as a local Claude Code plugin. Generate random one-to-five-term insults, expand inline tokens, and control the local block list.',
  },
  {
    slug: 'codex',
    harness: 'Codex',
    target: 'codex',
    adapter: 'Codex plugin with a local prompt hook and native Slur skill',
    behavior:
      'The hook adds the expanded prompt to model context before inference. Codex still shows the submitted /slur text, and the skill is also available as $slur:slur.',
    installedAt: '~/.local/share/slur/codex-marketplace',
    invocation: '/slur or $slur:slur',
    restart: 'Start a new Codex task after setup so it loads the plugin.',
    searchIntent: 'Codex custom skill and slash command',
    title: 'Slur Generator for Codex | /slur Skill & Plugin',
    description:
      'Install /slur as a local Codex skill and plugin. Expand inline tokens into random one-to-five-term insults without network requests or telemetry.',
  },
  {
    slug: 'opencode',
    harness: 'OpenCode',
    target: 'opencode',
    adapter: 'OpenCode custom command and JavaScript prompt plugin',
    behavior:
      'The plugin rewrites every standalone /slur token before OpenCode submits the prompt, so the model receives the expanded text in place.',
    installedAt: '~/.config/opencode/commands/slur.md and plugin/slur.js',
    invocation: '/slur anywhere in a prompt',
    restart: 'Restart OpenCode after setup so it loads the command and plugin.',
    searchIntent: 'OpenCode custom slash command and plugin',
    title: 'Slur Generator for OpenCode | Custom /slur Command',
    description:
      'Install a custom /slur command and prompt plugin for OpenCode. Replace inline tokens with random local one-to-five-term insult combinations.',
  },
  {
    slug: 'gemini-cli',
    harness: 'Gemini CLI',
    target: 'gemini',
    adapter: 'Gemini CLI custom TOML command',
    behavior:
      'The custom command runs the local Slur binary and expands its output before submission. Gemini CLI may ask you to approve the command.',
    installedAt: '~/.gemini/commands/slur.toml',
    invocation: '/slur',
    restart: 'Restart Gemini CLI after setup so it discovers the command.',
    searchIntent: 'Gemini CLI custom slash command',
    title: 'Slur Generator for Gemini CLI | Custom /slur Command',
    description:
      'Install /slur as a Gemini CLI custom command. Generate local one-to-five-term insult combinations from a fast Rust binary.',
  },
  {
    slug: 'github-copilot-cli',
    harness: 'GitHub Copilot CLI',
    target: 'copilot',
    adapter: 'GitHub Copilot CLI custom skill and prompt hook',
    behavior:
      'The prompt hook replaces the model-facing prompt with the expanded text. Copilot CLI may still show the submitted /slur text in the conversation.',
    installedAt: '~/.copilot/skills/slur and ~/.copilot/hooks/slur.json',
    invocation: '/slur anywhere in a prompt',
    restart: 'Restart GitHub Copilot CLI after setup so it loads the skill and hook.',
    searchIntent: 'GitHub Copilot CLI custom skill',
    title: 'Slur Generator for GitHub Copilot CLI | /slur Skill',
    description:
      'Install /slur as a GitHub Copilot CLI custom skill and hook. Expand tokens locally into random one-to-five-term insult combinations.',
  },
  {
    slug: 'cursor',
    harness: 'Cursor',
    target: 'cursor',
    adapter: 'local Cursor plugin with a custom command',
    behavior:
      'The Cursor command runs the local Slur binary once and treats its output as the replacement request.',
    installedAt: '~/.cursor/plugins/local/slur',
    invocation: '/slur',
    restart: 'Restart Cursor after setup so it discovers the local plugin.',
    searchIntent: 'Cursor custom slash command and plugin',
    title: 'Slur Generator for Cursor | Custom /slur Command',
    description:
      'Install /slur as a local Cursor plugin and custom command. Generate random one-to-five-term insults with the local Rust binary.',
  },
  {
    slug: 'cline',
    harness: 'Cline',
    target: 'cline',
    adapter: 'Cline custom skill',
    behavior:
      'The Cline skill runs the local Slur binary once and treats its single output line as the replacement request.',
    installedAt: '~/.cline/skills/slur/SKILL.md',
    invocation: '/slur',
    restart: 'Restart the editor hosting Cline after setup so it loads the skill.',
    searchIntent: 'Cline custom skill and slash command',
    title: 'Slur Generator for Cline | Custom /slur Skill',
    description:
      'Install /slur as a local Cline skill. Generate random one-to-five-term insult combinations without network requests or telemetry.',
  },
  {
    slug: 'windsurf',
    harness: 'Windsurf',
    target: 'windsurf',
    adapter: 'Windsurf global workflow',
    behavior:
      'The workflow runs the local Slur binary once and treats its output as the replacement request.',
    installedAt: '~/.codeium/windsurf/global_workflows/slur.md',
    invocation: '/slur',
    restart: 'Restart Windsurf after setup so it discovers the global workflow.',
    searchIntent: 'Windsurf workflow and custom slash command',
    title: 'Slur Generator for Windsurf | /slur Workflow',
    description:
      'Install /slur as a Windsurf workflow. Generate random local one-to-five-term insult combinations from a lightweight Rust binary.',
  },
]

/** Canonical routes included in the generated sitemap. */
export const seoRoutes = ['/', ...integrations.map(({ slug }) => `/${slug}/`)]

/** Normalizes a pathname to the canonical trailing-slash form. */
export function normalizePathname(pathname: string): string {
  if (pathname === '/') return pathname
  return `/${pathname.split('/').filter(Boolean).join('/')}/`
}

/** Returns the integration guide associated with a pathname. */
export function integrationForPathname(pathname: string): IntegrationPageData | undefined {
  const slug = normalizePathname(pathname).split('/').filter(Boolean)[0]
  return integrations.find((integration) => integration.slug === slug)
}

/** Returns complete metadata and structured data for a prerendered route. */
export function metadataForPathname(pathname: string): SeoMetadata {
  const integration = integrationForPathname(pathname)

  if (!integration) {
    const title = 'Slur Generator for Claude Code, Codex & Coding Agents'
    const description =
      'Install /slur, a local insult and slur generator for Claude Code, Codex, OpenCode, Gemini CLI, Copilot CLI, Cursor, Cline, and Windsurf.'

    return {
      title,
      description,
      canonical: `${SITE_URL}/`,
      imageAlt: 'Slur — local insult generator for coding agents',
      ogType: 'website',
      structuredData: homeStructuredData(title, description),
    }
  }

  const canonical = `${SITE_URL}/${integration.slug}/`
  return {
    title: integration.title,
    description: integration.description,
    canonical,
    imageAlt: `Slur generator for ${integration.harness}`,
    ogType: 'article',
    structuredData: integrationStructuredData(integration, canonical),
  }
}

function softwareEntity() {
  return {
    '@type': 'SoftwareApplication',
    '@id': `${SITE_URL}/#software`,
    name: 'Slur',
    alternateName: '/slur',
    description:
      'A free, open-source, local insult and slur generator for coding agents that replaces standalone /slur tokens with random one-to-five-term combinations.',
    url: `${SITE_URL}/`,
    sameAs: 'https://github.com/darhebkf/slur',
    downloadUrl: 'https://github.com/darhebkf/slur/releases/latest',
    installUrl: `${SITE_URL}/#install`,
    softwareVersion: '0.9.0',
    applicationCategory: 'DeveloperApplication',
    applicationSubCategory: 'Command-line utility',
    operatingSystem: 'macOS, Linux, Windows',
    isAccessibleForFree: true,
    license: 'https://github.com/darhebkf/slur/blob/main/LICENSE',
    author: { '@id': `${SITE_URL}/#author` },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList: [
      'Expands every standalone /slur token independently',
      'Generates random combinations of one to five terms',
      'Runs locally without telemetry',
      'Supports per-user allow and block lists',
      'Integrates with eight coding-agent harnesses',
    ],
  }
}

function homeStructuredData(title: string, description: string) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: `${SITE_URL}/`,
        name: 'Slur',
        description,
        inLanguage: 'en',
        publisher: { '@id': `${SITE_URL}/#author` },
      },
      {
        '@type': 'WebPage',
        '@id': `${SITE_URL}/#webpage`,
        url: `${SITE_URL}/`,
        name: title,
        description,
        isPartOf: { '@id': `${SITE_URL}/#website` },
        about: { '@id': `${SITE_URL}/#software` },
        mainEntity: { '@id': `${SITE_URL}/#software` },
        inLanguage: 'en',
      },
      softwareEntity(),
      {
        '@type': 'SoftwareSourceCode',
        '@id': `${SITE_URL}/#source`,
        name: 'Slur source code',
        codeRepository: 'https://github.com/darhebkf/slur',
        programmingLanguage: 'Rust',
        runtimePlatform: 'macOS, Linux, Windows',
        license: 'https://github.com/darhebkf/slur/blob/main/LICENSE',
        version: '0.9.0',
        author: { '@id': `${SITE_URL}/#author` },
        targetProduct: { '@id': `${SITE_URL}/#software` },
      },
      {
        '@type': 'Person',
        '@id': `${SITE_URL}/#author`,
        name: 'darhebkf',
        url: 'https://github.com/darhebkf',
      },
    ],
  }
}

function integrationStructuredData(integration: IntegrationPageData, canonical: string) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        '@id': `${canonical}#article`,
        url: canonical,
        headline: integration.title,
        description: integration.description,
        datePublished: '2026-09-21',
        dateModified: '2026-09-22',
        mainEntityOfPage: canonical,
        about: [
          { '@id': `${SITE_URL}/#software` },
          { '@type': 'SoftwareApplication', name: integration.harness },
        ],
        author: { '@id': `${SITE_URL}/#author` },
        publisher: { '@id': `${SITE_URL}/#author` },
        isPartOf: { '@id': `${SITE_URL}/#website` },
        inLanguage: 'en',
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonical}#breadcrumbs`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Slur',
            item: `${SITE_URL}/`,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: integration.harness,
            item: canonical,
          },
        ],
      },
      softwareEntity(),
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: `${SITE_URL}/`,
        name: 'Slur',
        publisher: { '@id': `${SITE_URL}/#author` },
      },
      {
        '@type': 'Person',
        '@id': `${SITE_URL}/#author`,
        name: 'darhebkf',
        url: 'https://github.com/darhebkf',
      },
    ],
  }
}
