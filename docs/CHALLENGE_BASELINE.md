# Challenge baseline

SignalRoom was designed against the official micro1 Agentic Workflows Hackathon PDF and the HackerEarth challenge page.

## Four questions

1. Who has this problem?
2. What bottleneck makes it worth solving?
3. Does the agent solve it well?
4. Can another person reproduce the result?

## Mandatory design consequences

- A simple baseline and an advanced solution run on the same cases.
- Agent use is purposeful: context, tools, verification, and orchestration only where they improve the result.
- One primary metric is defined before evaluation.
- Sixteen cases include standard, challenging (adversarial-distractor), and under-evidenced examples.
- Consequential actions remain simulated and human-approved.
- All data is synthetic and shareable.
- Exact commands, versions, runtime, cost, prompts, and trajectories are included.

## Published scoring weights

| Criterion | Points | SignalRoom response |
|---|---:|---|
| Agent Solution & Engineering | 30 | Hypotheses, read-only tools, exact citation checks, one feedback retry, approval gate |
| End-to-End Quality | 20 | Finished decision brief and evidence dashboard |
| Problem & User Value | 15 | On-call operator deciding under incomplete evidence |
| Measured Improvement | 15 | Same-model 16-case baseline comparison |
| Reproducibility | 15 | Standard-library Python, local Ollama, frozen data, exact commands |
| Hot Take / Insights | 5 | Abstention is a capability, not a failure |

## Visual baseline

The dashboard translates the official brief's visual grammar rather than copying its assets: warm off-white canvas, near-black/navy typography, muted terracotta and slate accents, oversized geometric headlines, monospaced uppercase metadata, thin rules, wide whitespace, numbered stages, and disciplined comparison tables.
