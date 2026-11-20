import type { NextRequest } from "next/server";

const MAX_CLAIM_LENGTH = 2000;

type Verdict = "VERIFIED" | "DISPUTED";

// MOCK: stands in for the real verification engine. A claim containing the
// word "fake" is DISPUTED; everything else is VERIFIED.
function mockVerdict(claim: string): Verdict {
  return /\bfake\b/i.test(claim) ? "DISPUTED" : "VERIFIED";
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

  return Response.json({
    claim: trimmed,
    verdict: mockVerdict(trimmed),
    mock: true,
  });
}
