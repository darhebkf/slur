import slurSource from '../../data/slurs.txt?raw'

const defaultBlocked = new Set(['nigger', 'nigga', 'faggot', 'fag'])

const words = slurSource
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#') && !defaultBlocked.has(line.toLowerCase()))

export interface GeneratedContent {
  hero: string
  rows: string[][]
}

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

/** Creates the randomized hero and kinetic-rail content for one page load. */
export function createGeneratedContent(): GeneratedContent {
  return {
    hero: combination(),
    rows: Array.from({ length: 3 }, () =>
      Array.from({ length: 6 }, () => combination()),
    ),
  }
}
