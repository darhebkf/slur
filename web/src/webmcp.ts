type SlurActions = {
  generate: (count: number) => string[]
  setBlacklist: (terms: string[]) => string[]
}

type ModelTool = {
  name: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }
  execute: (input: unknown) => unknown
}

type ModelContext = {
  registerTool: (tool: ModelTool, options?: { signal?: AbortSignal }) => void | Promise<void>
}

declare global {
  interface Document {
    readonly modelContext?: ModelContext
  }
}

function objectInput(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Expected an object input.')
  }
  return input as Record<string, unknown>
}

function afterPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

export function registerSlurTools(actions: SlurActions) {
  const context = document.modelContext
  if (!context?.registerTool) return undefined

  const lifecycle = new AbortController()
  const register = (tool: ModelTool) => {
    try {
      void Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => undefined)
    } catch {
      // An unsupported or partially implemented browser should not affect the UI.
    }
  }

  register({
    name: 'generate_roast_batch',
    title: 'Generate roast batch',
    description: 'Generate one to five active phrases and show them in the visible output panel.',
    inputSchema: {
      type: 'object',
      properties: { count: { type: 'integer', minimum: 1, maximum: 5 } },
      required: ['count'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    async execute(input) {
      const count = objectInput(input).count
      if (!Number.isInteger(count) || Number(count) < 1 || Number(count) > 5) {
        throw new Error('count must be an integer from 1 to 5')
      }
      const phrases = actions.generate(Number(count))
      await afterPaint()
      return { count: phrases.length, phrases }
    },
  })

  register({
    name: 'configure_blacklist',
    title: 'Configure word blacklist',
    description: 'Replace the visible case-insensitive phrase blacklist with the provided terms.',
    inputSchema: {
      type: 'object',
      properties: {
        terms: {
          type: 'array',
          maxItems: 16,
          items: { type: 'string', minLength: 1, maxLength: 64 },
        },
      },
      required: ['terms'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    async execute(input) {
      const terms = objectInput(input).terms
      if (!Array.isArray(terms) || terms.length > 16 || terms.some((term) => typeof term !== 'string' || !term.trim() || term.length > 64)) {
        throw new Error('terms must contain up to 16 non-empty strings')
      }
      const normalized = [...new Set(terms.map((term) => term.trim().toLowerCase()))]
      const configured = actions.setBlacklist(normalized)
      await afterPaint()
      return { terms: configured }
    },
  })

  return () => lifecycle.abort()
}
