import {
  type CSSProperties,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react'

import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import slurSource from '../../data/slurs.txt?raw'
import './App.css'

const GITHUB_URL = 'https://github.com/darhebkf/slur'
const RAW_URL = 'https://raw.githubusercontent.com/darhebkf/slur/main'

const defaultBlocked = new Set(['nigger', 'nigga', 'faggot', 'fag'])

const words = slurSource
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#') && !defaultBlocked.has(line.toLowerCase()))

const platforms = [
  { label: 'macOS / Linux', value: 'unix' },
  { label: 'Windows', value: 'windows' },
] as const

const settings = [
  ['block', 'slur block "word"'],
  ['unblock', 'slur unblock "word"'],
  ['off', 'slur off'],
  ['on', 'slur on'],
] as const

type Platform = (typeof platforms)[number]['value']

/** Returns a cryptographically random index below `upper`. */
function randomIndex(upper: number) {
  if (upper <= 1) return 0

  const values = new Uint32Array(1)
  crypto.getRandomValues(values)
  return values[0] % upper
}

/** Builds a combination of one to five unique terms from `source`. */
function combination(source = words) {
  const pool = [...source]
  const count = 1 + randomIndex(Math.min(5, pool.length))

  for (let index = 0; index < count; index += 1) {
    const swapWith = index + randomIndex(pool.length - index)
    ;[pool[index], pool[swapWith]] = [pool[swapWith], pool[index]]
  }

  return pool.slice(0, count).join(' ')
}

/** Returns the public install command for a supported platform. */
function installCommand(platform: Platform) {
  if (platform === 'windows') {
    return `irm ${RAW_URL}/scripts/install.ps1 | iex`
  }

  return `curl -fsSL ${RAW_URL}/scripts/install.sh | bash`
}

/** Copies `value` with the Clipboard API or a legacy browser fallback. */
async function writeClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return
    } catch {
      // Fall back for browsers that expose Clipboard but deny the write.
    }
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()

  if (!copied) throw new Error('clipboard unavailable')
}

/** Renders the Slur landing page. */
function App() {
  const heroRef = useRef<HTMLElement>(null)
  const railRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const trackRefs = useRef<Array<HTMLDivElement | null>>([])
  const reduceMotion = useReducedMotion()
  const hero = useMemo(() => combination(), [])
  const rows = useMemo(
    () => Array.from({ length: 3 }, () => Array.from({ length: 6 }, () => combination())),
    [],
  )
  const [railDistances, setRailDistances] = useState([0, 0, 0])
  const [platform, setPlatform] = useState<Platform>('unix')
  const [copied, setCopied] = useState(false)

  useLayoutEffect(() => {
    const measure = () => {
      const viewportWidth = stageRef.current?.clientWidth ?? window.innerWidth
      setRailDistances(
        trackRefs.current.map((track) =>
          Math.max(0, Math.ceil((track?.scrollWidth ?? viewportWidth) - viewportWidth)),
        ),
      )
    }

    const observer = new ResizeObserver(measure)
    if (stageRef.current) observer.observe(stageRef.current)
    trackRefs.current.forEach((track) => track && observer.observe(track))
    window.addEventListener('resize', measure)
    measure()

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  })
  const { scrollYProgress: railProgress } = useScroll({
    target: railRef,
    offset: ['start start', 'end end'],
  })

  const watermarkY = useTransform(heroProgress, [0, 1], [0, reduceMotion ? 0 : -90])
  const phraseY = useTransform(heroProgress, [0, 1], [0, reduceMotion ? 0 : 48])
  const railOne = useTransform(railProgress, [0, 1], [0, -railDistances[0]])
  const railTwo = useTransform(
    railProgress,
    [0, 1],
    [-railDistances[1], 0],
  )
  const railThree = useTransform(railProgress, [0, 1], [0, -railDistances[2]])
  const railTransforms = [railOne, railTwo, railThree]
  const horizontalDistance = Math.max(...railDistances)
  const kineticStyle = {
    '--rail-distance': `${reduceMotion ? 0 : horizontalDistance}px`,
  } as CSSProperties
  const command = installCommand(platform)
  const heroWordCount = hero.split(' ').length

  const copyCommand = async () => {
    try {
      await writeClipboard(command)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="site-shell">
      <main>
        <section className="hero" ref={heroRef} aria-labelledby="hero-output">
          <motion.span className="watermark" aria-hidden="true" style={{ y: watermarkY }}>
            SLUR
          </motion.span>

          <motion.div className="hero-center" style={{ y: phraseY }}>
            <h1 className={`hero-output words-${heroWordCount}`} id="hero-output">
              {hero}
            </h1>

            <div className="hero-actions" aria-label="Project links">
              <a className="primary-cta" href="#install">
                install
              </a>
              <a className="github-cta" href={GITHUB_URL} target="_blank" rel="noreferrer">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 .7a11.5 11.5 0 0 0-3.63 22.41c.58.11.79-.25.79-.56v-2.23c-3.24.7-3.92-1.38-3.92-1.38-.53-1.35-1.29-1.7-1.29-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.79 2.73 1.27 3.4.97.1-.76.41-1.27.74-1.56-2.58-.29-5.3-1.29-5.3-5.69 0-1.26.45-2.28 1.2-3.09-.12-.29-.52-1.47.11-3.05 0 0 .98-.31 3.16 1.18a10.97 10.97 0 0 1 5.75 0c2.18-1.49 3.16-1.18 3.16-1.18.63 1.58.23 2.76.11 3.05.74.81 1.2 1.83 1.2 3.09 0 4.41-2.72 5.39-5.31 5.68.42.36.79 1.07.79 2.17v3.22c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z" />
                </svg>
                GitHub
              </a>
            </div>
          </motion.div>

          <p className="hero-note">slur.dev was taken.</p>
        </section>

        <section className="why" aria-label="Why Slur">
          <p className="why-copy">because lets be real, you type slurs to your harness too</p>
        </section>

        <section
          className="kinetic"
          ref={railRef}
          style={kineticStyle}
          aria-label="Random combinations"
        >
          <div className="kinetic-stage" ref={stageRef}>
            {rows.map((row, rowIndex) => (
              <div className="rail-window" key={rowIndex}>
                <motion.div
                  className="phrase-rail"
                  ref={(node) => {
                    trackRefs.current[rowIndex] = node
                  }}
                  style={{ x: railTransforms[rowIndex] }}
                >
                  {row.map((phrase, phraseIndex) => (
                    <span className="rail-phrase" key={`${rowIndex}-${phraseIndex}`}>
                      {phrase}
                    </span>
                  ))}
                </motion.div>
              </div>
            ))}
          </div>
        </section>

        <section className="settings" aria-labelledby="settings-title">
          <h2 className="settings-heading" id="settings-title">settings</h2>

          <div className="settings-list">
            {settings.map(([name, value]) => (
              <div className="settings-row" key={name}>
                <span>{name}</span>
                <code>{value}</code>
              </div>
            ))}
          </div>
        </section>

        <section className="install" id="install" aria-labelledby="install-title">
          <h2 className="install-heading" id="install-title">install</h2>

          <div className="install-configurator">
            <Tabs
              className="platform-tabs"
              value={platform}
              onValueChange={(value) => {
                setPlatform(value as Platform)
                setCopied(false)
              }}
            >
              <TabsList variant="line" aria-label="Operating system">
                {platforms.map((item) => (
                  <TabsTrigger key={item.value} value={item.value}>
                    {item.label}
                    {platform === item.value && (
                      <motion.span
                        className="tab-indicator"
                        layoutId="platform-indicator"
                        transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                      />
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="command-panel">
              <span className="border-trace border-trace-top" aria-hidden="true" />
              <span className="border-trace border-trace-right" aria-hidden="true" />
              <span className="border-trace border-trace-bottom" aria-hidden="true" />
              <span className="border-trace border-trace-left" aria-hidden="true" />

              <button
                className="copy-command"
                type="button"
                onClick={copyCommand}
                aria-label={copied ? 'Command copied' : 'Copy install command'}
              >
                <span>{copied ? 'copied' : 'copy'}</span>
                <AnimatePresence mode="wait" initial={false}>
                  {copied ? (
                    <motion.svg
                      key="check"
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.7 }}
                    >
                      <path d="m5 12 4 4L19 6" />
                    </motion.svg>
                  ) : (
                    <motion.svg
                      key="copy"
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.7 }}
                    >
                      <rect x="8" y="8" width="11" height="11" rx="1" />
                      <path d="M16 8V5H5v11h3" />
                    </motion.svg>
                  )}
                </AnimatePresence>
              </button>

              <div className="command-value">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.code
                    key={platform}
                    title={command}
                    initial={{ opacity: 0, x: platform === 'windows' ? 24 : -24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: platform === 'windows' ? -24 : 24 }}
                    transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {platform === 'windows' ? (
                      <>
                        <span className="command-prefix">
                          <span className="command-bin">irm</span>
                        </span>
                        <span className="command-tail">
                          <span className="command-url">{RAW_URL}/scripts/install.ps1</span>{' '}
                          <span className="command-operator">|</span>{' '}
                          <span className="command-bin">iex</span>
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="command-bin command-segment">curl</span>
                        <span className="command-flag command-segment">-fsSL</span>
                        <span className="command-tail">
                          <span className="command-url">{RAW_URL}/scripts/install.sh</span>{' '}
                          <span className="command-operator">|</span>{' '}
                          <span className="command-bin">bash</span>
                        </span>
                      </>
                    )}
                  </motion.code>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer>© 2026. All rights reserved.</footer>
    </div>
  )
}

export default App
