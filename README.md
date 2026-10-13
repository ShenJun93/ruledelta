# RuleDelta — inspect changed rules before you commit

RuleDelta compares two versions of a freelance scope, contest brief or
grant rule. Real local CPU MiniLM embeddings align clauses. The app quotes
the exact old and new text, flags possible changed deadlines, payments,
eligibility and rights, and asks humans to review each candidate.

## Quick start

Install Node.js 20 or newer. In a cloned repository, run:

1. npm ci --ignore-scripts
2. npm start
3. Open http://127.0.0.1:4318/ in a browser on the same device.

The clearly fictional example contains three edits: a shifted deadline,
cash becoming platform credits, and altered AI-writing permission.
After comparison, review exact source quotes, check each candidate,
then export JSON. Any source edit immediately re-locks the export.

The first local inference may download openly available model weights;
subsequent model uses can work with cached weights. Private pasted text
is not sent to a paid hosted inference API. Initial install is NOT offline.

## Architecture

- Transformers.js and Xenova/all-MiniLM-L6-v2 align related clauses.
- A genuine Mastra four-step workflow validates, compares, annotates
  optional safe NLI paraphrases, and requires explicit human review.
- NLI suggestions never remove candidate flags or dismiss HIGH alerts.
- A localhost-only server enforces Host, Origin, CSP and input limits.
- Export requires every checkbox and the same source text as analyzed.

## Reproduce engineering tests

- npm run test:unit
- npm run test:model
- npm run test:workflow
- npm run test:http
- npm run audit:release

The authored regression suite is NOT an independent legal accuracy
benchmark. In a 28-case authored post-fix set, all 14 expected material
shifts were surfaced and 5 of 14 benign examples were also flagged.

## Security and license

This is a LOCAL prototype, NOT legal advice, a payout determination,
an eligibility judgment, or a production hosted service. Always review
authoritative originals and use professional advice where appropriate.
The project source uses the MIT license; external packages and model
weights retain their own license terms. Read SECURITY.md before use.

The audited lockfile includes a sharp 0.35.5 override. The 2026-10-13
npm scan found zero HIGH but nine MODERATE advisories. Security risk is
NOT zero and these findings are not proof of exploitability.

## Development provenance

Original RuleDelta work began during DEV Hacktoberfest Week 2 in 2026.
The pure embedding and cosine helper were reused from the same author
and the same Week 2 QuoteProof local Git workspace. No customer documents,
credentials, video recordings or model cache are included.
