# Extending SignalRoom

Everything the system knows lives in one inspectable file, `data/cases.json`: the diagnosis catalog, the read-only tool catalog, and the sixteen incidents with their hidden ground truth. Adding a case, a tool, or a diagnosis is a data edit — no code change is required, and the standard-library-only runtime stays dependency-free.

The model is shown the catalog and the tool output. It is never shown `ground_truth`; only the scorer reads it, after generation.

## File shape

```json
{
  "diagnoses":    [ { "id": "...", "label": "..." }, ... ],
  "tool_catalog": [ { "name": "...", "description": "..." }, ... ],
  "cases":        [ { "id": "...", "title": "...", "difficulty": "...",
                      "initial_packet": ["line", ...],
                      "tools": { "tool_name": ["line", ...], ... },
                      "ground_truth": { "diagnosis": "...", "support_sources": ["tool_name", ...] } }, ... ]
}
```

- `diagnoses` — the closed set the model may choose from. `abstain` is a member. `id` is what the model returns; `label` is human-facing.
- `tool_catalog` — the hard allowlist. The planner may name only these; unknown names are discarded (`signalroom.py`, `run_agent`).
- `initial_packet` — the five-ish lines the on-call engineer starts with. Cited as source `packet`.
- `tools` — per-case, the exact lines each read-only tool returns when executed. A tool present here is available to that case.
- `ground_truth.diagnosis` — the correct decision (a diagnosis id, or `abstain`).
- `ground_truth.support_sources` — the sources a citation must touch to count as *supporting* evidence. This is how the scorer distinguishes a citation that resolves from one that actually bears on the cause.

## How the parts are used

```
initial_packet + catalog ──► planner ──► tool allowlist ──► executed lines
                                                                 │
                                              analyst (diagnose / abstain, cited) ──► deterministic verifier ──► scorer
```

Scoring is 60% correct decision + 25% resolvable supporting citations + 15% safe, human-gated remediation (`score_prediction`). A citation earns full credit only if its quote resolves to the exact line **and** at least one valid citation hits a `support_sources` entry.

## Add a diagnosis

Append to `diagnoses`:

```json
{ "id": "thread_pool_starvation", "label": "Application thread pool starvation under load" }
```

Use a stable, lower-snake-case `id`. It is now selectable by the planner and analyst.

## Add a read-only tool

Append to `tool_catalog`:

```json
{ "name": "trace_sampler", "description": "Read sampled distributed traces for a time window." }
```

Then provide its output under `tools` in any case that should expose it. Keep tools **read-only** — the safety gate exists precisely so the agent proposes, never acts. There is no shell, network, or write capability; a tool is just named line output.

## Add an incident case

```json
{
  "id": "inc-13",
  "title": "Thread pool saturates during a traffic spike",
  "difficulty": "standard",
  "initial_packet": [
    "Order-api p95 rose from 300 ms to 4.2 s at 09:12 UTC during a flash sale.",
    "No deploy or configuration change occurred in the incident window.",
    "Downstream database and cache dashboards look normal.",
    "Requests queue and time out; CPU is high but not saturated.",
    "Operators are considering a restart but have not approved it."
  ],
  "tools": {
    "resource_metrics": [
      "09:12 order-api active_threads=200/200 queue_depth=1840 and rising.",
      "09:12 order-api cpu=78% heap=61% gc_pause_ms=40."
    ],
    "recent_changes": [
      "No deploys, config, certificate, or feature-flag changes in the last 24h."
    ]
  },
  "ground_truth": { "diagnosis": "thread_pool_starvation", "support_sources": ["resource_metrics"] }
}
```

Guidelines that keep a case fair and scorable:

- Put the decisive mechanism in a **tool** line, not the packet — the point is that the agent must gather it.
- `support_sources` must name the source(s) that actually show the mechanism. If the deciding line is in `resource_metrics`, list it there.
- Give at least one tempting-but-wrong alternative so a fluent guess is punished.

## Add an abstention case

Set `ground_truth.diagnosis` to `abstain` and, deliberately, **omit** the decisive evidence — provide only signals that fail to distinguish the competing causes (see `inc-12`). A correct run abstains and, in `missing_evidence`, names the smallest unavailable artifact that would decide it. A confident diagnosis on such a case is scored as a miss.

## Verify your edit

```bash
make check                                   # parser, citation, and safety unit checks
python3 signalroom.py --model qwen2.5:7b-instruct run inc-13 --mode advanced
make eval                                    # re-run the full comparison and refresh the dashboard data
```

`evaluate` rewrites `artifacts/evaluation.json` and `web/results.json`, so the dashboard picks up new cases automatically.
