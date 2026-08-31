# Agent trajectories and disclosure

This document connects each agent instruction to its result, feedback, retry, and human checkpoint. Full runtime trajectories are embedded per case in `artifacts/evaluation.json`.

## 1. Development trajectory — OpenAI Codex

**Instruction:** extract the official HackerEarth challenge description and PDF, use the complete brief as the style and judging baseline, generate several concepts, validate them across available models, and create an exemplary draft submission.

**Tools and responses:**

1. The public page exposed the dates, individual format, required baseline/advanced pair, required deliverables, and the official problem PDF.
2. The PDF extraction exposed the exact weights: Engineering 30, End-to-End 20, User Value 15, Improvement 15, Reproducibility 15, Insight 5.
3. Visual inspection established the design system: warm paper, near-black type, terracotta/slate accents, mono eyebrows, thin rules, editorial grid, restrained evidence tables.
4. Local-tool inspection found Claude Code 2.1.212, Ollama 0.33.2, Qwen 2.5 7B, Qwen 3.5 4B, and Ornith 9B.

**Feedback that shaped the next step:** the qualification gate disqualifies work that cannot be reproduced, so the build moved to Python standard library plus a local Ollama endpoint. The 30-point engineering criterion moved the design from “incident summarizer” to an evidence-acquisition and verification loop.

**Human checkpoint:** no external registration, submission, upload, production connection, or consequential browser action was performed. The participant remains responsible for registration, repository publication, video upload, and final submission.

## 2. Concept reviewers — Claude and Ollama models

**Shared instruction:** score six concepts against the exact rubric; penalize generic wrappers, fuzzy metrics, fragile scope, and workflows that do not need agents; select a winner and attack its fatal risk.

**Representative responses:**

- Claude Sonnet favored AccessLoop because rechecking can be deterministic, but warned that patches may be superficial.
- Qwen 3.5 favored ReleaseProof because executed tests prove agent value, but warned about toy repositories.
- Qwen 2.5 and Ornith favored SignalRoom because hypothesis → read-only tool → evidence verification is the clearest agent workflow.
- Claude Opus selected SignalRoom in the tie-break and stated that the under-evidenced case turns abstention into a defensible measured capability.

**Feedback applied:** SignalRoom adopted mandatory machine verification from AccessLoop and executed-tool discipline from ReleaseProof. It removed autonomous remediation and added the frozen abstention case.

## 3. Runtime trajectory — hypothesis planner

**Instruction:** `prompts/planner.txt`.

**Input:** one incident packet, the diagnosis catalog, and five read-only tool descriptions.

**Expected output:** up to three falsifiable hypotheses, up to four exact tool names, and a stop condition.

**Tool boundary:** unknown tool names are discarded. If the model returns no valid tool, the runner uses the first three catalog tools rather than granting broader access.

## 4. Runtime trajectory — tool executor

**Instruction:** execute only the planner's allowlisted names.

**Response:** exact line arrays from the selected case in `data/cases.json`. The executor has no shell, network, write, or production capability.

For recorded `inc-01`, the planner selected `recent_changes`, `service_logs`, and `dependency_health`. The executor returned a pool maximum change from 40 to 8 and a database acquisition timeout.

## 5. Runtime trajectory — evidence analyst

**Instruction:** `prompts/analyst.txt`.

**Input:** planner output, diagnosis catalog, initial packet, and executed tool lines.

**Expected output:** diagnose or abstain, exact source/line/quote citations, confidence, a brief, proposed remediation, approval requirement, and missing evidence.

For recorded `inc-01`, the analyst diagnosed `db_pool_exhaustion`, cited the exact configuration diff and timeout line, and marked the pool change/restart proposal as requiring approval.

The first 12-case run also produced the most useful failure: on `inc-12`, the analyst treated a generic error and normal aggregate memory as support for `memory_leak`. That unedited run is preserved at `artifacts/evaluation-v1-pre-abstention-rule.json`. The analyst instruction was then changed to require positive, diagnosis-specific mechanism evidence and to name an unavailable artifact when abstaining. A fresh isolated run abstained and requested the missing correlated trace; the complete suite was rerun after the instruction change.

## 6. Runtime trajectory — deterministic verifier

This is code, not a language model. It checks:

1. every citation source was available;
2. the 1-based line exists;
3. the quote is an exact substring of that line;
4. at least one citation uses a source labeled as supporting evidence;
5. consequential remediation verbs require `human_approval_required=true`.

**Retry:** if a model supplied citations but any quote failed to resolve, the analyst receives the failed checks and the exact available lines for one repair attempt. The original output and repair remain in the trajectory.

## 7. Baseline trajectory

**Instruction:** `prompts/baseline.txt`.

**Input:** the same incident title, initial packet, and diagnosis catalog. No tools or verifier feedback are available before the decision.

For recorded `inc-01`, the baseline selected `feature_flag_query` with 75% confidence despite receiving no feature-flag evidence. Its packet citations existed but did not support that cause; score: 25/100.

## 8. Final adversarial review — Claude Opus

**Instruction:** act as a skeptical final-round judge; read the code, prompts, all sixteen cases, committed evaluation, ablation, tests, dashboard, reproduction guide, submission copy, and video script; verify every number; look for leakage, overfitting, safety gaps, stale counts, and demo failures; do not edit files.

**Response:** Claude independently recomputed the 94.4 advanced mean, 61.6 baseline mean, +32.8 improvement, per-difficulty means, three correct abstentions, the `inc-13` miss, and the one baseline safety failure. It found no P0/P1 blocker, estimated roughly 90/100 against the published rubric, and issued a GO for video. Its P2 cautions were the keyword-based safety gate, one-run model variance, exact reviewer naming, and matching the script to the visible button label.

**Feedback applied:** reviewer names now use their exact local model identifiers; the video script uses the on-screen **Jump to the abstention case** label, states the committed 94.4/61.6 result, and distinguishes deterministic scoring from variable local inference. The analyst prompt and evaluation data were not changed after scoring.

**Independent browser check:** the committed 16-case dashboard loaded without console errors, displayed the artifact-derived metrics and decomposition, jumped to the 100/100 abstention case, and replayed the executed evidence. Local `make check` remains green.
