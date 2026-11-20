import Link from "next/link";
import s from "../page.module.css";

export const metadata = { title: "Docs — Truthful Pro" };

export default function Docs() {
  return (
    <main className={s.wrap} style={{ paddingBlock: "64px", maxWidth: 800 }}>
      <p><Link href="/">&larr; Truthful Pro</Link></p>
      <h1 className={s.h1}>Docs</h1>
      <p>The API reference is not published yet.</p>
      <h2 id="get-a-key" className={s.rowTitle} style={{ marginTop: 40 }}>Get a key</h2>
      <p>API key signup is not open yet. This page is a placeholder for the signup flow.</p>
    </main>
  );
}
