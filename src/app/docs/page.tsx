import Link from "next/link";
import s from "../page.module.css";

export const metadata = { title: "Docs — Truthful Pro" };

const request = `curl -X POST http://localhost:3000/api/verify \\
  -H "Content-Type: application/json" \\
  -d '{"claim": "Water boils at 100 degrees Celsius at sea level."}'`;

const verified = `{
  "claim": "Water boils at 100 degrees Celsius at sea level.",
  "verdict": "VERIFIED",
  "mock": true
}`;

const disputed = `curl -X POST http://localhost:3000/api/verify \\
  -H "Content-Type: application/json" \\
  -d '{"claim": "This photo is fake."}'

{
  "claim": "This photo is fake.",
  "verdict": "DISPUTED",
  "mock": true
}`;

const errorExample = `curl -X POST http://localhost:3000/api/verify \\
  -H "Content-Type: application/json" \\
  -d '{}'

HTTP/1.1 400 Bad Request
{
  "error": {
    "code": "invalid_claim",
    "message": "Field \\"claim\\" is required and must be a string."
  }
}`;

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
        <p>
          Truthful Pro checks a claim and returns a verdict. One endpoint, JSON in, JSON out.
        </p>
        <p className={s.docsNote}>
          Draft: the endpoint currently returns a mock verdict, flagged with{" "}
          <code>&quot;mock&quot;: true</code>. A claim containing the word
          &ldquo;fake&rdquo; is DISPUTED; every other claim is VERIFIED. The real
          verification engine, sources and authentication are not built yet. The
          examples use the local dev server, <code>http://localhost:3000</code>.
        </p>

        <h2 className={s.docsH2}>Verify a claim</h2>
        <p>
          Send a <code>POST</code> request to <code>/api/verify</code> with a JSON body.
        </p>
        <pre className={s.docPre}>{request}</pre>

        <table className={s.docsTable}>
          <thead>
            <tr><th>Field</th><th>Type</th><th>Notes</th></tr>
          </thead>
          <tbody>
            <tr><td><code>claim</code></td><td>string</td><td>Required. 1 to 2000 characters after trimming.</td></tr>
          </tbody>
        </table>

        <h2 className={s.docsH2}>Response</h2>
        <p>A successful request returns <code>200</code> with:</p>
        <pre className={s.docPre}>{verified}</pre>
        <table className={s.docsTable}>
          <thead>
            <tr><th>Field</th><th>Type</th><th>Notes</th></tr>
          </thead>
          <tbody>
            <tr><td><code>claim</code></td><td>string</td><td>The trimmed claim you sent.</td></tr>
            <tr><td><code>verdict</code></td><td>string</td><td><code>VERIFIED</code> or <code>DISPUTED</code>.</td></tr>
            <tr><td><code>mock</code></td><td>boolean</td><td>Always <code>true</code> until the real engine ships.</td></tr>
          </tbody>
        </table>

        <h2 className={s.docsH2}>A disputed claim</h2>
        <pre className={s.docPre}>{disputed}</pre>

        <h2 className={s.docsH2}>Errors</h2>
        <p>
          Invalid requests return <code>400</code> with an <code>error</code> object. Codes:{" "}
          <code>invalid_json</code>, <code>invalid_claim</code>, <code>claim_too_long</code>.
          Methods other than <code>POST</code> return <code>405</code>.
        </p>
        <pre className={s.docPre}>{errorExample}</pre>

        <h2 id="get-a-key" className={s.docsH2}>Get an API key</h2>
        <p>
          API keys are not open yet, and the endpoint above needs none. When signup opens, this section will hold the request form.
        </p>
        <p><Link href="/">Back to the home page</Link></p>
      </main>
    </>
  );
}
