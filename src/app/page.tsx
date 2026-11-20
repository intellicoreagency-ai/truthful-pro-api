import Link from "next/link";
import s from "./page.module.css";

const KEY_URL = "/docs#get-a-key";

export default function Home() {
  return (
    <>
      <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute" }}>
        <filter id="ink-impression" x="-6%" y="-12%" width="112%" height="124%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  14 0 0 0 -4.6" result="speckle" />
          <feComposite in="SourceGraphic" in2="speckle" operator="in" result="worn" />
          <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="8" result="wobble" />
          <feDisplacementMap in="worn" in2="wobble" scale="2.4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <header className={s.mast}>
        <div className={`${s.wrap} ${s.mastInner}`}>
          <Link href="/" className={s.mark}>
            Truthful<span>.</span>Pro
          </Link>
          <nav className={s.nav} aria-label="Primary">
            <a href="#verdicts">Verdicts</a>
            <Link href="/docs">Docs</Link>
            <Link href={KEY_URL} className={s.navCta}>
              Get an API key
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className={`${s.wrap} ${s.hero}`}>
          <div>
            <h1 className={s.h1}>
              Get a sourced verdict <em>before</em> a claim ships.
            </h1>
            <p className={s.lede}>
              Truthful Pro is a fact-checking API. Send a claim, get back a
              verdict you can branch on, with its sources attached.
            </p>
            <div className={s.actions}>
              <Link href={KEY_URL} className={`${s.btn} ${s.btnPrimary}`}>
                Get an API key
              </Link>
              <Link href="/docs" className={`${s.btn} ${s.btnGhost}`}>
                Read the docs
              </Link>
            </div>
          </div>

          <figure className={s.panel} style={{ margin: 0 }}>
            <div className={s.panelHead}>
              <span>Verification desk</span>
              <span>Mock endpoint</span>
            </div>
            <div className={s.panelBody}>
              <p className={s.slug}>Request</p>
              <pre className={s.pre}>
{`curl -X POST http://localhost:3000/api/verify \\
  -H "Content-Type: application/json" \\
  -d '{"claim": "This photo is fake."}'`}
              </pre>
              <hr className={s.divider} />
              <p className={s.slug}>Response</p>
              <p className={s.dateline}>200 OK &middot; application/json</p>
              <div>
                <span className={s.line} style={{ ["--i" as string]: 0 }}>
                  <span className={s.flag}>Disputed</span>
                </span>
                <span className={s.line} style={{ ["--i" as string]: 1 }}>
                  {`{`}
                </span>
                <span className={s.line} style={{ ["--i" as string]: 2 }}>
                  {`  "claim": "This photo is fake.",`}
                </span>
                <span className={s.line} style={{ ["--i" as string]: 3 }}>
                  {`  "verdict": "DISPUTED",`}
                </span>
                <span className={s.line} style={{ ["--i" as string]: 4 }}>
                  {`  "sources": [`}
                </span>
                <span className={s.line} style={{ ["--i" as string]: 5 }}>
                  {`    { "title": "Example Source",`}
                </span>
                <span className={s.line} style={{ ["--i" as string]: 6 }}>
                  {`      "url": "https://example.com" }`}
                </span>
                <span className={s.line} style={{ ["--i" as string]: 7 }}>
                  {`  ],`}
                </span>
                <span className={s.line} style={{ ["--i" as string]: 8 }}>
                  {`  "mock": true`}
                </span>
                <span className={s.line} style={{ ["--i" as string]: 9 }}>
                  {`}`}
                </span>
              </div>
              <p className={s.note}>
                Real output of the current mock endpoint. The verdict and
                sources are placeholders; the verification engine is not built
                yet.
              </p>
            </div>
          </figure>
        </section>

        <section className={s.vocab} id="verdicts" aria-label="Verdict vocabulary">
          <div className={`${s.wrap} ${s.vocabInner}`}>
            <div className={s.vocabItem}>
              <span className={`${s.vocabWord} ${s.teal}`}>Verified</span>
              <p className={s.vocabDesc}>The claim holds up against its sources.</p>
            </div>
            <div className={s.vocabItem}>
              <span className={`${s.vocabWord} ${s.red}`}>Disputed</span>
              <p className={s.vocabDesc}>The sources contradict the claim.</p>
            </div>
            <div className={s.vocabItem}>
              <span className={s.vocabWord}>Unverifiable</span>
              <p className={s.vocabDesc}>Not enough evidence to call it either way.</p>
            </div>
          </div>
        </section>

        <p className={`${s.wrap} ${s.draft}`}>
          Draft copy: verdict names and API behavior below are proposed and will be confirmed against the API reference.
        </p>

        <section className={`${s.wrap} ${s.features}`}>
          <h2 className={s.h2}>What comes back, and why it&rsquo;s usable.</h2>
          <ul className={s.ledger}>
            <li className={s.row}>
              <h3 className={s.rowTitle}>A verdict you can branch on</h3>
              <div className={s.rowBody}>
                <p>
                  Each claim returns a machine-readable verdict, so your code
                  decides what to publish, flag or hold without parsing prose.
                </p>
                <pre>{`if (res.verdict === "DISPUTED") hold(post)`}</pre>
              </div>
            </li>
            <li className={s.row}>
              <h3 className={s.rowTitle}>Sources, not just answers</h3>
              <div className={s.rowBody}>
                <p>
                  Verdicts arrive with the evidence behind them, so a reviewer
                  can follow the trail and your users can see why.
                </p>
              </div>
            </li>
            <li className={s.row}>
              <h3 className={s.rowTitle}>One request in your pipeline</h3>
              <div className={s.rowBody}>
                <p>
                  A plain HTTPS and JSON interface. Put it between your model
                  and your audience, or in front of your editorial queue.
                </p>
              </div>
            </li>
          </ul>
        </section>

        <section className={s.close}>
          <div className={`${s.wrap} ${s.closeInner}`}>
            <h2 className={s.closeH}>Your first verdict is one request away.</h2>
            <div className={s.closeSide}>
              <p>Get a key, send a claim, read the dispatch.</p>
              <div className={s.actions}>
                <Link href={KEY_URL} className={`${s.btn} ${s.btnInvert}`}>
                  Get an API key
                </Link>
                <Link href="/docs" className={`${s.btn} ${s.btnLine}`}>
                  Read the docs
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className={s.foot}>
        <div className={`${s.wrap} ${s.footInner}`}>
          <span>Truthful Pro</span>
          <span>Fact-checking API</span>
        </div>
      </footer>
    </>
  );
}
