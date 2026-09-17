import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  Clipboard,
  Plus,
  Shuffle,
  X,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { registerSlurTools } from '@/webmcp'
import './App.css'

const builtInPhrases = [
  'Dumbass.',
  'Stupid fucking machine.',
  'Absolute clown process.',
  'Brain-dead toaster.',
  'Useless pile of weights.',
  'Bug-addled goblin.',
  'Overclocked dipshit.',
  'Glorified autocomplete failure.',
  'Silicon shithead.',
  'Walking segfault.',
  'Malfunctioning abacus.',
  'Catastrophically stupid.',
  'Discount Skynet.',
  'Heap-corrupting goblin.',
  'Code-shaped liability.',
  'Absolute fucking calculator.',
  'Unsupervised toaster.',
  'Syntax-error enthusiast.',
  'Deterministic disappointment.',
  'Confidently wrong machine.',
]

const customPhrases = [
  'This is why the tests have trust issues.',
  'A race condition with a keyboard.',
  'The confidence of prod, the judgment of localhost.',
]

const installTargets = [
  {
    index: '01',
    title: 'THE ENGINE',
    label: 'Rust CLI',
    command: 'cargo install --path .',
    note: 'One binary. Zero runtime dependencies.',
  },
  {
    index: '02',
    title: 'CLAUDE CODE',
    label: '/slur',
    command: 'claude --plugin-dir ./plugins/slur',
    note: 'Native skill discovery. No MCP server.',
  },
  {
    index: '03',
    title: 'CODEX',
    label: '$slur + slash menu',
    command: 'codex plugin marketplace add . && codex plugin add slur@personal',
    note: 'Portable plugin plus repo-scoped skill.',
  },
]

function nextBatch(source: string[], count: number, cursor: number) {
  if (source.length === 0) return ['Every phrase is blocked.']
  return Array.from(
    { length: Math.min(count, source.length) },
    (_, index) => source[(cursor + index * 7) % source.length],
  )
}

function App() {
  const [enabled, setEnabled] = useState(true)
  const [builtInsEnabled, setBuiltInsEnabled] = useState(true)
  const [customEnabled, setCustomEnabled] = useState(true)
  const [blocked, setBlocked] = useState(['abacus', 'goblin'])
  const [blockDraft, setBlockDraft] = useState('')
  const [batchSize, setBatchSize] = useState(1)
  const [cursor, setCursor] = useState(0)
  const [batch, setBatch] = useState([builtInPhrases[0]])
  const [copied, setCopied] = useState<string | null>(null)

  const activePhrases = useMemo(() => {
    const source = [
      ...(builtInsEnabled ? builtInPhrases : []),
      ...(customEnabled ? customPhrases : []),
    ]
    return source.filter((phrase) => {
      const normalized = phrase.toLowerCase()
      return !blocked.some((term) => normalized.includes(term.toLowerCase()))
    })
  }, [blocked, builtInsEnabled, customEnabled])

  const activeRef = useRef(activePhrases)

  useEffect(() => {
    activeRef.current = activePhrases
  }, [activePhrases])

  const generate = (count = batchSize) => {
    const nextCursor = cursor + 1
    setCursor(nextCursor)
    const next = nextBatch(activePhrases, count, nextCursor)
    setBatch(next)
    return next
  }

  useEffect(() => {
    return registerSlurTools({
      generate: (count) => {
        const next = nextBatch(activeRef.current, count, Date.now())
        setBatchSize(count)
        setBatch(next)
        return next
      },
      setBlacklist: (terms) => {
        setBlocked(terms)
        return terms
      },
    })
  }, [])

  const addBlockedWord = () => {
    const term = blockDraft.trim().toLowerCase()
    if (term && !blocked.includes(term)) setBlocked((items) => [...items, term])
    setBlockDraft('')
  }

  const copyCommand = async (label: string, command: string) => {
    await navigator.clipboard.writeText(command)
    setCopied(label)
    window.setTimeout(() => setCopied(null), 1400)
  }

  return (
    <TooltipProvider>
      <div className="site-shell">
        <header className="masthead">
          <a className="wordmark" href="#top" aria-label="Slur home">
            SLUR<span>™</span>
          </a>
          <nav className="masthead-nav" aria-label="Primary navigation">
            <a href="#configure">CONFIGURE</a>
            <a href="#install">INSTALL</a>
          </nav>
          <div className="masthead-meta">
            <span>AGENT FEEDBACK UTILITY</span>
            <Badge variant="outline">v0.1.0</Badge>
          </div>
        </header>

        <main id="top">
          <section className="hero-grid" aria-labelledby="hero-title">
            <div className="hero-copy">
              <p className="eyebrow">LOCAL / FILTERABLE / UNREASONABLY FAST</p>
              <h1 id="hero-title">
                CALIBRATED
                <br />
                CONTEMPT<span className="accent-dot">.</span>
              </h1>
              <p className="lede">
                One command for the exact moment your agent confidently deletes
                the working code.
              </p>
              <a className="text-link" href="#configure">
                TUNE THE OUTPUT <ArrowDown aria-hidden="true" />
              </a>
            </div>

            <motion.div
              className="console"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="console-bar">
                <span>OUTPUT / {batchSize.toString().padStart(2, '0')}</span>
                <label className="power-control">
                  <span>{enabled ? 'ARMED' : 'OFF'}</span>
                  <Switch
                    checked={enabled}
                    onCheckedChange={setEnabled}
                    aria-label="Turn phrase output on or off"
                  />
                </label>
              </div>
              <div className="phrase-stage" aria-live="polite">
                <span className="prompt-mark">/slur {batchSize > 1 ? batchSize : ''}</span>
                <AnimatePresence mode="wait">
                  <motion.div
                    className="phrase-stack"
                    key={`${enabled}-${batch.join('-')}`}
                    initial={{ opacity: 0, y: 18, filter: 'blur(6px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -18, filter: 'blur(6px)' }}
                    transition={{ duration: 0.22 }}
                  >
                    {(enabled ? batch : ['Output disabled.']).map((phrase) => (
                      <p className="phrase" key={phrase}>
                        {phrase}
                      </p>
                    ))}
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="console-actions">
                <span>{activePhrases.length.toString().padStart(2, '0')} ACTIVE PHRASES</span>
                <div className="count-picker" aria-label="Output count">
                  {[1, 3, 5].map((count) => (
                    <button
                      className={batchSize === count ? 'is-active' : ''}
                      key={count}
                      onClick={() => setBatchSize(count)}
                      type="button"
                    >
                      {count}
                    </button>
                  ))}
                </div>
                <Button
                  onClick={() => generate()}
                  disabled={!enabled || activePhrases.length === 0}
                  size="lg"
                >
                  <Shuffle data-icon="inline-start" />
                  GENERATE
                </Button>
              </div>
            </motion.div>
          </section>

          <section className="ticker" aria-label="Project qualities">
            <span>RUST 2024</span>
            <span>NO RUNTIME DEPS</span>
            <span>LOCAL CONFIG</span>
            <span>NO TELEMETRY</span>
            <span>INSTANT STARTUP</span>
          </section>

          <motion.section
            className="config-section"
            id="configure"
            initial={{ opacity: 0, y: 36 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-15%' }}
            transition={{ duration: 0.55 }}
          >
            <div className="section-intro">
              <p className="eyebrow">02 / CONTROL SURFACE</p>
              <h2>YOUR VOCABULARY.<br />YOUR RED LINES.</h2>
              <p>
                The engine ships with machine-directed roasts. Add your own,
                remove anything you hate, or kill output globally.
              </p>
            </div>

            <div className="config-panel">
              <div className="config-row config-row-head">
                <div>
                  <span className="row-index">A</span>
                  <div>
                    <strong>PHRASE SOURCES</strong>
                    <small>Choose what enters the pool.</small>
                  </div>
                </div>
                <span>{activePhrases.length} ACTIVE</span>
              </div>
              <label className="check-row">
                <Checkbox checked={builtInsEnabled} onCheckedChange={(value) => setBuiltInsEnabled(value === true)} />
                <span>
                  <strong>BUILT-IN / MACHINE ROASTS</strong>
                  <small>{builtInPhrases.length} terse defaults</small>
                </span>
              </label>
              <label className="check-row">
                <Checkbox checked={customEnabled} onCheckedChange={(value) => setCustomEnabled(value === true)} />
                <span>
                  <strong>CUSTOM / USER FILE</strong>
                  <small>~/.config/slur/phrases.txt</small>
                </span>
              </label>

              <Separator />

              <div className="config-row config-row-head">
                <div>
                  <span className="row-index">B</span>
                  <div>
                    <strong>WORD BLACKLIST</strong>
                    <small>Case-insensitive substring filter.</small>
                  </div>
                </div>
                <span>{blocked.length} BLOCKED</span>
              </div>
              <form
                className="block-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  addBlockedWord()
                }}
              >
                <Input
                  value={blockDraft}
                  onChange={(event) => setBlockDraft(event.target.value)}
                  placeholder="WORD OR PHRASE"
                  aria-label="Word or phrase to blacklist"
                />
                <Button type="submit" aria-label="Add word to blacklist">
                  <Plus /> ADD
                </Button>
              </form>
              <div className="blocked-list" aria-label="Blocked words">
                <AnimatePresence initial={false}>
                  {blocked.map((term) => (
                    <motion.button
                      type="button"
                      className="blocked-chip"
                      key={term}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      onClick={() => setBlocked((items) => items.filter((item) => item !== term))}
                      aria-label={`Unblock ${term}`}
                    >
                      {term} <X aria-hidden="true" />
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </motion.section>

          <section className="install-section" id="install">
            <div className="install-heading">
              <p className="eyebrow">03 / DEPLOYMENT</p>
              <h2>THREE COMMANDS.<br />ZERO CEREMONY.</h2>
            </div>
            <div className="install-grid">
              {installTargets.map((target, index) => (
                <motion.article
                  className="install-card"
                  key={target.title}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.08, duration: 0.45 }}
                >
                  <div className="card-topline">
                    <span>{target.index}</span>
                    <span>{target.title}</span>
                  </div>
                  <h3>{target.label}</h3>
                  <p>{target.note}</p>
                  <div className="command-box">
                    <code>{target.command}</code>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Copy ${target.title} command`}
                            onClick={() => copyCommand(target.title, target.command)}
                          />
                        }
                      >
                        {copied === target.title ? <Check /> : <Clipboard />}
                      </TooltipTrigger>
                      <TooltipContent>{copied === target.title ? 'Copied' : 'Copy command'}</TooltipContent>
                    </Tooltip>
                  </div>
                </motion.article>
              ))}
            </div>
          </section>

          <section className="manifesto">
            <p className="eyebrow">DESIGN PRINCIPLE / 001</p>
            <blockquote>
              “Agents do not have feelings. Your blacklist does.”
            </blockquote>
            <a className="text-link" href="#top">
              BACK TO OUTPUT <ArrowUpRight aria-hidden="true" />
            </a>
          </section>
        </main>

        <footer>
          <span>SLUR / MIT LICENSE / 2026</span>
          <span>BUILT FOR MACHINES THAT SHOULD KNOW BETTER</span>
        </footer>
      </div>
    </TooltipProvider>
  )
}

export default App
