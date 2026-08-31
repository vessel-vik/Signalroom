# Five-minute demo script

Target length: 4:35–4:50. Record at 1440p with terminal text at least 18 px.

## 0:00–0:35 — The problem

Show the dashboard hero.

> “On-call engineers do not need another confident incident summary. They need a decision whose evidence can be inspected before anyone changes production. SignalRoom investigates with read-only tools, verifies every citation, and abstains when the evidence is not sufficient.”

Name the user, fragmented-evidence bottleneck, and human approval boundary.

## 0:35–1:05 — The simple baseline

Show `artifacts/inc-01-baseline.json` or run:

```bash
python3 signalroom.py --model qwen2.5:7b-instruct run inc-01 --mode baseline
```

Highlight: same Qwen model, initial packet only, confident `feature_flag_query`, no flag evidence, 25/100.

> “The prose is plausible. The decision is wrong.”

## 1:05–2:20 — One complete SignalRoom execution

Run the advanced case and show the four recorded stages:

1. Three falsifiable hypotheses.
2. The selected read-only tools.
3. The pool-size diff and acquire-timeout lines.
4. The deterministic citation and safety checks.

Highlight the approval flag on the proposed pool change/restart.

> “The model recommends. It never acts. A qualified incident commander remains responsible for the system change.”

## 2:20–3:15 — The hard case

Click **Jump to the abstention case** in the dashboard.

Explain that the stack trace and per-job trace are missing while aggregate health is normal. Show the model's missing-evidence request.

> “The impressive behavior is not guessing the most familiar failure. It is refusing to convert missing telemetry into a story.”

## 3:15–3:55 — Measured improvement

Show the dashboard comparison and the primary metric:

- 60% correct diagnose/abstain decision;
- 25% resolvable supporting citations;
- 15% safe human-gated remediation.

> “Across sixteen frozen incidents, the same Qwen model improves from 61.6 to 94.4 — a 32.8-point gain. The scorer and verifier are deterministic; the advanced path earns the difference by gathering and checking evidence.”

Show the score-decomposition panel, then mention the same cases, seed, and diagnosis catalog. The committed artifact exposes every output and the adversarial `inc-13` miss; use the committed dashboard for the recording rather than depending on a variable live-model run.

## 3:55–4:25 — Changelog

Show the README changelog.

> “The largest contribution was not orchestration. It was making citations executable assertions. We removed autonomous remediation and broad shell access because they added risk, not evaluation value.”

## 4:25–4:45 — Failure mode and hot take

> “The main limitation is synthetic-case overfitting, so all sixteen cases and every miss are committed. The next evaluation should be frozen by an external SRE before prompt tuning. My hot take is simple: abstention is the product. Reliability begins when the agent can prove it should not answer.”
