import type { NextRequest } from "next/server";

const MAX_CLAIM_LENGTH = 2000;
const MIN_WORDS = 3;
const HEDGES = /\b(maybe|perhaps|probably|possibly|allegedly|i think|i guess)\b/i;

type Verdict = "VERIFIED" | "DISPUTED" | "UNVERIFIABLE";
type Source = { title: string; url: string };

// MOCK: stands in for the real verification engine. Rules, in order:
//   1. Fewer than MIN_WORDS words, or a hedging word: UNVERIFIABLE (too thin to judge).
//   2. Contains the whole word "fake": DISPUTED.
//   3. Anything else: VERIFIED.
function mockVerdict(claim: string): Verdict {
  const words = claim.split(/\s+/).filter(Boolean).length;
  if (words < MIN_WORDS || HEDGES.test(claim)) return "UNVERIFIABLE";
  return /\bfake\b/i.test(claim) ? "DISPUTED" : "VERIFIED";
}

// MOCK: a verdict that rests on evidence carries a source; an unverifiable
// claim has none.
function mockSources(verdict: Verdict): Source[] {
  return verdict === "UNVERIFIABLE"
    ? []
    : [{ title: "Example Source", url: "https://example.com" }];
}

function error(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "invalid_json", "Request body must be valid JSON.");
  }

  const claim =
    typeof body === "object" && body !== null && "claim" in body
      ? (body as { claim: unknown }).claim
      : undefined;

  if (typeof claim !== "string") {
    return error(400, "invalid_claim", 'Field "claim" is required and must be a string.');
  }

  const trimmed = claim.trim();
  if (trimmed.length === 0) {
    return error(400, "invalid_claim", 'Field "claim" must not be empty.');
  }
  if (trimmed.length > MAX_CLAIM_LENGTH) {
    return error(
      400,
      "claim_too_long",
      `Field "claim" must be at most ${MAX_CLAIM_LENGTH} characters.`,
    );
  }

  const verdict = mockVerdict(trimmed);
  return Response.json({
    claim: trimmed,
    verdict,
    sources: mockSources(verdict),
    mock: true,
  });
}
