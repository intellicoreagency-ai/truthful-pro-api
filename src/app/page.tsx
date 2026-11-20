import Link from "next/link";
import s from "./page.module.css";

const KEY_URL = "/docs#get-a-key";

export default function Home() {
  return (
    <>
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
              Check every claim <em>before</em> it ships.
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
              <span>Synthetic example</span>
            </div>
            <div className={s.panelBody}>
              <p className={s.slug}>Request</p>
              <pre className={s.pre}>
{`curl https://api.example.com/v1/check \\
  -H "Authorization: Bearer $KEY" \\
  -d '{"claim": "The Great Wall of China is visible from space with the naked eye."}'`}
              </pre>
              <hr className={s.divider} />
              <p className={s.slug}>Dispatch</p>
              <div>
                <span className={s.line} style={{ ["--i" as string]: 0 }}>
                  <span className={s.flag}>Disputed</span>
                </span>
                <span className={s.line} style={{ ["--i" as string]: 1 }}>
                  {`{ "verdict": "disputed",`}
                </span>
                <span className={s.line} style={{ ["--i" as string]: 2 }}>
                  {`  "summary": "Not visible unaided from orbit.",`}
                </span>
                <span className={s.line} style={{ ["--i" as string]: 3 }}>
                  {`  "sources": [`}
                </span>
                <span className={s.line} style={{ ["--i" as string]: 4 }}>
                  {`    "https://example.org/source-1",`}
                </span>
                <span className={s.line} style={{ ["--i" as string]: 5 }}>
                  {`    "https://example.org/source-2" ] }`}
                </span>
              </div>
              <p className={s.note}>
                Illustrative only. Endpoint, fields and values are placeholders
                until the API reference is published.
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
                <pre>{`if (res.verdict === "disputed") hold(post)`}</pre>
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
