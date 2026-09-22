import { integrations, type IntegrationPageData } from '@/seo-pages'
import './IntegrationPage.css'

const RAW_URL = 'https://raw.githubusercontent.com/darhebkf/slur/main'
const GITHUB_URL = 'https://github.com/darhebkf/slur'

interface IntegrationPageProps {
  integration: IntegrationPageData
}

/** Renders one factual, crawlable installation guide for a supported harness. */
export default function IntegrationPage({ integration }: IntegrationPageProps) {
  const related = integrations.filter(({ slug }) => slug !== integration.slug)

  return (
    <div className="guide-shell">
      <header className="guide-header">
        <a href="/" aria-label="Slur home">slur</a>
        <a href={GITHUB_URL}>GitHub</a>
      </header>

      <main>
        <article>
          <section className="guide-hero" aria-labelledby="guide-title">
            <p className="guide-kicker">/slur for {integration.harness}</p>
            <h1 id="guide-title">slur generator for {integration.harness}</h1>
            <p className="guide-lede">
              Install a local insult and slur generator as a {integration.searchIntent}.
              Every standalone <code>/slur</code> token produces a random one-to-five-term
              combination.
            </p>
          </section>

          <section className="guide-section" aria-labelledby="behavior-title">
            <h2 id="behavior-title">how it works</h2>
            <p>{integration.behavior}</p>
            <dl className="guide-facts">
              <div>
                <dt>adapter</dt>
                <dd>{integration.adapter}</dd>
              </div>
              <div>
                <dt>runtime</dt>
                <dd>local Rust binary</dd>
              </div>
              <div>
                <dt>default Unix path</dt>
                <dd><code>{integration.installedAt}</code></dd>
              </div>
              <div>
                <dt>invoke</dt>
                <dd><code>{integration.invocation}</code></dd>
              </div>
              <div>
                <dt>network</dt>
                <dd>none while generating</dd>
              </div>
            </dl>
          </section>

          <section className="guide-section" aria-labelledby="install-guide-title">
            <h2 id="install-guide-title">install</h2>
            <ol className="guide-steps">
              <li>
                <span>macOS / Linux</span>
                <pre><code>{`curl -fsSL ${RAW_URL}/scripts/install.sh | bash -s -- ${integration.target}`}</code></pre>
              </li>
              <li>
                <span>Windows PowerShell</span>
                <pre><code>{`irm ${RAW_URL}/scripts/install.ps1 | iex`}</code></pre>
                <pre><code>{`slur setup ${integration.target}`}</code></pre>
              </li>
              <li>
                <span>reload</span>
                <p>{integration.restart}</p>
              </li>
            </ol>
          </section>

          <section className="guide-section" aria-labelledby="usage-title">
            <h2 id="usage-title">use /slur</h2>
            <pre className="guide-example"><code>You /slur your work needs another pass, you /slur.</code></pre>
            <p>
              Each token expands independently. Use <code>slur block &quot;word&quot;</code> to hide
              a term, <code>slur add &quot;phrase&quot;</code> to add one, and <code>slur off</code> to
              disable output.
            </p>
          </section>

          <section className="guide-section" aria-labelledby="questions-title">
            <h2 id="questions-title">questions</h2>
            <dl className="guide-answers">
              <div>
                <dt>Is /slur a cloud service?</dt>
                <dd>No. Generation and filtering happen on your machine.</dd>
              </div>
              <div>
                <dt>Does it send prompts or telemetry?</dt>
                <dd>No. The generator makes no network requests while producing text.</dd>
              </div>
              <div>
                <dt>Can I block words?</dt>
                <dd>Yes. The block list is local, case-insensitive, and editable from the CLI.</dd>
              </div>
            </dl>
          </section>

          <nav className="guide-related" aria-label="Other supported coding agents">
            <h2>other harnesses</h2>
            <div>
              {related.map(({ slug, harness }) => (
                <a href={`/${slug}/`} key={slug}>{harness}</a>
              ))}
            </div>
          </nav>
        </article>
      </main>

      <footer>© 2026. All rights reserved.</footer>
    </div>
  )
}
