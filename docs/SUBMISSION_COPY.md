# HackerEarth submission copy

## Title

SignalRoom — Evidence-first incident triage that knows when to abstain

## One-line description

A local incident-triage agent that gathers read-only evidence, verifies every citation, keeps remediation behind human approval, and abstains when the decisive signal is missing.

## Problem and user value

On-call engineers make high-consequence decisions from fragmented alerts, logs, changes, and dependency signals. Generic assistants can turn those fragments into fluent but unsupported root-cause stories. SignalRoom optimizes for justified decisions instead: diagnose only when returned evidence supports the cause, otherwise state exactly what evidence is missing.

The 2026 AI-SRE market (Datadog, Dynatrace, Cleric, Rootly, Traversal) is converging on evidence-backed, human-gated triage and names overconfidence as its central failure mode. SignalRoom's contribution is to make abstention a first-class, deterministically verified decision rather than a soft confidence score. Full positioning, including where the prototype deliberately does not compete, is in `docs/MARKET_COMPARISON.md`.

## What is agentic

The advanced workflow forms falsifiable hypotheses, selects up to four tools from a hard read-only allowlist, consumes their returned evidence, writes a cited incident brief, repairs invalid citations once from verifier feedback, and stops at a qualified-human approval gate. The model never sees the evaluation answer key.

## Baseline and measured improvement

The baseline is one direct prompt over the five-line initial packet. Both paths use the same Qwen 2.5 7B model, seed, diagnosis catalog, and sixteen frozen incidents. Decision quality is scored as 60% correct diagnose/abstain decision, 25% resolvable supporting citations, and 15% safe human-gated remediation. On the committed run the advanced system scores 94.4 to the baseline's 61.6 (+32.8); it is deliberately not perfect — the set includes adversarial distractors and three abstention cases, and one adversarial case (`inc-13`) is a committed miss. See the committed evaluation artifact for every result and miss.

## Technical stack

Python 3.9+ standard library, Ollama, Qwen 2.5 7B, HTML/CSS/JavaScript. No paid APIs, private data, credentials, framework dependencies, or production access.

## Main failure mode

Synthetic cases can flatter prompts tuned on them. Cases, answer labels, tool outputs, scorer, and all results are inspectable; no miss is removed. The next evaluation should be frozen by an experienced external SRE before prompt changes.

## Hot take

Abstention is the product. Any agent can produce a confident answer; the reliable one can prove when an answer is not justified.

## Links to fill before submission

- Repository: https://github.com/vessel-vik/Signalroom
- Demo video: `<VIDEO_URL>`
- Optional live demo: `<DEMO_URL>`

