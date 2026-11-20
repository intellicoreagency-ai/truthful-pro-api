# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (user's choice), deployed to Vercel. First surfaces: a marketing site and documentation.

## Users

Developers integrating the API into their own applications. They arrive to evaluate whether the API is trustworthy and easy to adopt, then to read docs and call endpoints.

## Product Purpose

Truthful Pro is a fact-checking / truthfulness API: callers send content or claims and get back a verification result. Success is a developer going from landing page to a working first API call quickly, and trusting the results enough to ship.

## Positioning

Open decision: what Truthful Pro does that a neighboring fact-checking or LLM-verification API could not truthfully claim has not been confirmed yet.

## Capabilities and Constraints

- Open decision: endpoints, request/response shape, verdict format, evidence and confidence output, pricing, rate limits and auth model are not yet specified. Do not invent them.
- No existing code, copy, or docs in the repository beyond `.claude/settings.json` (21st.dev plugin).

## Evidence on Hand

None in the repo. No customers, testimonials, benchmarks, accuracy figures or case studies exist to cite; future work must not fabricate them.

## Product Principles

- Credibility over hype: a truthfulness product must itself make only claims it can substantiate.
- Time to first successful API call is the core success metric for every surface.
- Docs are a primary product surface, not an afterthought to the marketing site.
- Show real request/response examples rather than abstract promises.
