import Link from "next/link";
import s from "../page.module.css";

export const metadata = { title: "Docs — Truthful Pro" };

export default function Docs() {
  return (
    <>
      <header className={s.docsMast}>
        <div className={`${s.wrap} ${s.mastInner}`}>
          <Link href="/" className={s.mark}>
            Truthful<span>.</span>Pro
          </Link>
          <nav className={s.nav} aria-label="Primary">
            <Link href="/">Home</Link>
          </nav>
        </div>
      </header>
      <main className={`${s.wrap} ${s.docsBody}`}>
        <h1 className={s.h1}>Docs</h1>
        <p>The API reference has not been published yet. It will cover authentication, the check endpoint and the verdict format.</p>
        <h2 id="get-a-key" className={s.rowTitle} style={{ marginTop: 40 }}>Get an API key</h2>
        <p>API keys are not open yet. When signup opens, this section will hold the request form; until then there is nothing to submit.</p>
        <p><Link href="/">Back to the home page</Link></p>
      </main>
    </>
  );
}
