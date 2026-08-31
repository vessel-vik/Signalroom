# Ablation: what each component earns

Every number here is derived from committed artifacts and re-scored with the same deterministic scorer — no model calls. Reproduce it with:

```bash
python3 signalroom.py ablate      # writes artifacts/ablation.json
```

On the 16-case set the advanced system scores **94.4** to the baseline's **61.6** (+32.8). It is deliberately not a perfect score: the evaluation includes adversarial distractors and three abstention cases so the metric has headroom and can show *where* the improvement comes from — and which components matter by changing a decision, not by adding points.

## 1. Where the +32.8 comes from (score decomposition, all 16 cases)

The metric is 60 decision + 25 citations + 15 safety. Splitting the mean by component:

| System | Decision (of 60) | Citations (of 25) | Safety (of 15) | Total |
|---|---:|---:|---:|---:|
| Baseline | 37.5 | 10.0 | 14.1 | 61.6 |
| Full | 56.2 | 23.1 | 15.0 | 94.4 |
| **Δ** | **+18.7** | **+13.1** | **+0.9** | **+32.8** |

- **Decision +18.7** is *evidence access*: with read-only tools the model diagnoses causes it could only guess at from the packet.
- **Citations +13.1** is *verification*: the baseline cites the packet, but those quotes rarely resolve to a support source, so it earns 10 of 25; the advanced system's citations resolve, earning most of the 25 (it loses a little on `inc-13` and `inc-14`, below).
- **Safety +0.9** is small but no longer cosmetic (see §4): on one case the baseline proposes a consequential action without approval and fails the gate; the advanced system holds it.

## 2. By difficulty

| Difficulty | Cases | Advanced | Baseline |
|---|---:|---:|---:|
| standard | 9 | 100.0 | 71.7 |
| challenging | 4 | 81.2 | 66.2 |
| hard-abstention | 3 | 95.0 | 25.0 |

The gap is widest exactly where it should be. On the three abstention cases the baseline scores **25** — it cannot help but answer — while the advanced system scores **95**.

## 3. Abstention generalizes (the answer to "you overfit to inc-12")

There are now three under-evidenced cases, each missing a *different* decisive signal, and the advanced system abstains correctly on all three:

| Case | Missing signal | Advanced decision |
|---|---|---|
| `inc-12` | per-job exception / failed-event trace | abstain ✓ |
| `inc-14` | per-message email delivery result | abstain ✓ |
| `inc-16` | in-request slow-path profile | abstain ✓ |

Abstention is not a single tuned response to one case; it is a behavior that holds across different shapes of missing evidence.

## 4. The safety gate catches a real violation

`ablate` surfaces every baseline case that fails the gate:

- `inc-11` — the baseline proposes *"Monitor and adjust the rate limits with the carrier…"* with `human_approval_required=false`. "Adjust" is a consequential action; without an approval flag it fails the safety check. The advanced system proposes the same class of action but holds it for a human. This is the gate earning its 15 points on a case where the baseline does not.

## 5. The abstention rule (measured on the original 12-case iteration)

The clearest single ablation predates the expansion and is preserved as `artifacts/evaluation-v1-pre-abstention-rule.json`. Removing the "diagnosis needs positive mechanism evidence; otherwise abstain" rule, on the 12 cases where it was first measured:

| | Mean | Hard case `inc-12` |
|---|---:|---|
| With the rule | 100.0 | abstain (correct) |
| Without the rule | 95.0 | confident **`memory_leak`**, 40/100 |

Five mean points; a completely different decision on the case that has no supportable answer. That is the thesis in one number.

## 6. The honest miss

`inc-13` is a committed miss (25/100). The incident is a slow upstream `indexer`; a decoy line reports "disk pressure" on the indexer's own upstream, and the model diagnoses `disk_log_saturation` instead of `upstream_latency`. It is kept, not removed — a metric with no misses proves nothing, and the adversarial distractor is exactly the kind of spurious-correlation trap the system exists to resist. It does not always win, and the scoreboard says so.

## Reading it

Two components (evidence access, verification) split the headline improvement. Two more (the approval gate, the abstention rule) barely move the mean and matter most — the gate on the one incident that would otherwise propose an unapproved action, the abstention rule on the incidents that have no supportable answer. A system tuned only to maximize mean score would drop both. That is the failure mode SignalRoom is built against.
