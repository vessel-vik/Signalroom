# Concept tournament

The concept was selected before implementation against the published 100-point rubric and the ten-hour draft constraint.

## Candidates

1. SignalRoom — incident evidence and abstention.
2. ReleaseProof — AI-generated pull-request readiness.
3. HandoffZero — verified operations handoff.
4. BidLens — RFP compliance.
5. BoardProof — cited board updates.
6. AccessLoop — accessibility repair and recheck.

The full common judging prompt and final tie-break prompt are preserved in `artifacts/development/`.

## Independent results

| Reviewer | Winner | Top-line reason |
|---|---|---|
| Claude Sonnet | AccessLoop (91), ReleaseProof (90), SignalRoom (84) | Automated recheck gives a cheap deterministic metric. |
| Qwen 3.5 4B | ReleaseProof | Executed tests make the agent contribution tangible. |
| Qwen 2.5 7B | SignalRoom (85) | Strongest purposeful agent loop and safety boundary. |
| Ornith 9B | SignalRoom (85) | Hypothesis → tool → verification is distinctly agentic. |
| Claude Opus tie-break | SignalRoom | Best 30-point engineering fit, originality, and a defensible abstention hard case. |

## Decision

SignalRoom won the final round after absorbing the strongest objections:

- From AccessLoop: make verification mandatory and machine-checkable.
- From ReleaseProof: ground claims in tools that actually ran.
- Against SignalRoom: add a deliberately under-evidenced case, freeze all cases, publish every miss, and avoid live remediation.

This selection process prevented implementation momentum from becoming the idea-selection criterion.
