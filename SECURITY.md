# Security and scope

RuleDelta binds localhost only and must not be deployed to public networks
without separate authentication, rate limiting and a security review.
It is not a legal decision engine and it may produce false review alerts.

Latest private audit, 2026-10-13: zero critical, zero HIGH, nine MODERATE
npm alerts after pinning sharp to version 0.35.5 in the lockfile.
Remaining chains involve onnxruntime-node, global-agent, roarr, sprintf-js,
Mastra, gray-matter, js-yaml and argparse. Advisory counts may change.
Run npm run audit:release in a normal Git clone before publication or use.
The audit checks common secrets in tracked text; it is not exhaustive.

Source text is processed locally by the running model, though model
weights may be downloaded on first execution. Do not place real
private customer inputs into screenshots, videos or public bug reports.
