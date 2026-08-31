# Ablation: what each component earns

Every number here is derived from committed artifacts (`artifacts/evaluation.json` and the preserved `artifacts/evaluation-v1-pre-abstention-rule.json`) and re-scored with the same deterministic scorer. No model calls, no new runs — reproduce it with:

```bash
python3 signalroom.py ablate      # writes artifacts/ablation.json
```

The point: the advanced system's result is not one opaque jump from 70 to 100. Each component earns a measurable share, and one of them earns its keep by *changing a decision*, not by adding points.

## 1. Capability progression (build up from the baseline)

| Stage | Mean /100 | Decision accuracy | Citations resolve |
|---|---:|---:|---:|
| Baseline — single prompt, no tools | 70.0 | 75.0% | 0% |
| + tools, citations, approval gate | 95.0 | 91.7% | 100% |
| Full system (+ abstention rule) | 100.0 | 100% | 100% |

Adding read-only evidence, citation verification, and the approval gate moves the baseline **+25**. The abstention rule adds the final **+5** — but see §3 for why that number understates it.

## 2. Where the +30 comes from (score decomposition)

The metric is 60 decision + 25 citations + 15 safety. Splitting the mean by component:

| System | Decision (of 60) | Citations (of 25) | Safety (of 15) | Total |
|---|---:|---:|---:|---:|
| Baseline | 45.0 | 10.0 | 15.0 | 70.0 |
| Full | 60.0 | 25.0 | 15.0 | 100.0 |
| **Δ** | **+15** | **+15** | **0** | **+30** |

- **Decision +15** comes from *evidence access*: with tools the model diagnoses causes it could only guess at from the packet.
- **Citations +15** comes from *verification*: the baseline cites the packet, but those quotes rarely resolve to a ground-truth support source, so it earns only 10 of 25. The advanced system's citations resolve exactly, earning the full 25.
- **Safety +0** is the honest part. Both systems score the full 15. The approval gate's value is not that the baseline proposed unsafe actions — it is that the gate *guarantees* any consequential action is held for approval, rather than leaving it to prompt compliance. It is insurance, and it reads as zero until the day it isn't.

## 3. Component cuts (remove one thing from the full system)

| Removed | Mean /100 | What breaks |
|---|---:|---|
| — (full system) | 100.0 | — |
| Citation repair | 97.9 | `inc-03` and `inc-09` lose citation credit — one unresolved quote each that the single verifier-fed retry would have fixed |
| Abstention rule | 95.0 | `inc-12` flips from `abstain` to a confident **`memory_leak`** (40/100) |

**Citation repair** is a small, precise recovery: +2.1 mean, and it is the mechanism that turns a 90%-ish citation-resolution rate into 100%. Cheap, deterministic, one retry.

**The abstention rule is the important cut.** Removing it costs only 5 mean points, but that average hides the real effect: on the one case where the decisive evidence was never captured, the system stops abstaining and invents a confident, unsupported root cause. The pre-fix run is committed as `artifacts/evaluation-v1-pre-abstention-rule.json`. This is the project's thesis, measured: the abstention rule barely moves the score, and entirely changes whether the hard decision is defensible.

## Reading it

Two components (evidence access, citation verification) split the headline improvement evenly. Two more (the approval gate, the abstention rule) barely register in the mean and matter most — the gate on the incident that would otherwise execute an unapproved action, the abstention rule on the incident that has no supportable answer. A system tuned only to maximize mean score would drop both. That is exactly the failure mode SignalRoom is built against.
