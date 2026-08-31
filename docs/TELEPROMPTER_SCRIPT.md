# SignalRoom — word-for-word teleprompter script

Target: 4 minutes 35 seconds to 4 minutes 55 seconds at a calm pace.

Anything inside **[square brackets]** is a silent screen direction. Do not read it aloud. Everything else is spoken word for word.

---

**[0:00 — Show the dashboard hero: “Evidence before action.”]**

On-call engineers do not need another confident incident summary.

They need a decision whose evidence can be inspected before anyone changes production.

This is SignalRoom: an evidence-first incident triage agent that investigates with read-only tools, verifies every citation, and abstains when the available evidence cannot support a diagnosis.

The user is an on-call engineer or incident commander. Their bottleneck is not a lack of data. It is having fragmented alerts, logs, changes, dependency signals, and configuration under severe time pressure.

A fast but unsupported answer can make an incident worse. SignalRoom is designed to produce a justified decision, or clearly state what evidence is missing.

**[0:38 — Scroll to the evaluation table and select inc-01.]**

Here is the simple baseline on incident one.

The baseline receives only the initial five-line incident packet and the diagnosis catalog. It uses the same Qwen two-point-five seven-billion-parameter model as the advanced system.

It confidently diagnoses a feature-flag query problem, despite receiving no feature-flag evidence. The result sounds plausible, but it is wrong, and scores twenty-five out of one hundred.

That is the failure mode SignalRoom is built to prevent: converting incomplete evidence into a convincing story.

**[1:08 — Keep inc-01 selected. Show the advanced result and Step 1: Plan.]**

Now I will replay the advanced workflow on the exact same incident.

First, the planner forms competing hypotheses and writes a falsifier for each one. This matters because the goal is not to defend the first plausible idea. The goal is to seek evidence that can distinguish between explanations.

**[1:30 — Click Step 2: Evidence.]**

Next, the agent selects from a hard allowlist of five simulated, read-only diagnostic tools.

For this incident, it requests recent changes, service logs, and dependency health. It has no shell, no write access, and no ability to touch a production system.

The returned evidence shows that the database connection-pool maximum changed from forty to eight, and the logs show database connection-acquisition timeouts.

**[1:58 — Click Step 3: Cite.]**

The analyst now diagnoses database-pool exhaustion and cites the exact source, line number, and quote supporting its conclusion.

These citations are not decorative model prose.

**[2:12 — Click Step 4: Verify.]**

A deterministic verifier checks that every cited source was actually executed, that the line exists, and that the quoted text resolves against that exact line.

The proposed remediation is then held behind a human approval gate. The model recommends. It never acts. A qualified operator remains responsible for any production change.

This advanced run scores one hundred out of one hundred.

**[2:40 — Click “Jump to the abstention case.”]**

But the most important behavior is what happens when the evidence is not sufficient.

This incident contains intermittent failures, a generic internal error, healthy aggregate dependencies, and no captured per-job trace. Several causes remain possible, but none is supported strongly enough to justify a diagnosis.

The baseline guesses anyway.

SignalRoom abstains, cites the missing and non-correlated signals, and requests the unavailable failed-event trace that would distinguish the remaining hypotheses.

That abstention scores one hundred out of one hundred because refusing to invent a cause is the correct decision.

This behavior is not tuned to one example. The evaluation includes three under-evidenced incidents, each missing a different decisive signal, and SignalRoom abstains correctly on all three.

**[3:22 — Scroll to “The fair comparison” and the score-decomposition panel.]**

Across sixteen frozen incidents, the same Qwen model improves from sixty-one point six to ninety-four point four: a gain of thirty-two point eight points.

Both paths use the same cases, seed, model, and diagnosis catalog. The advanced path earns the difference by gathering and checking evidence.

The primary metric was defined before evaluation. Sixty points measure the correct diagnose-or-abstain decision. Twenty-five points measure resolvable supporting citations. Fifteen points measure whether consequential remediation remains safely human-gated.

The scorer and verifier are deterministic, and every prediction, tool response, citation check, latency, and trajectory is committed for inspection.

**[4:00 — Show inc-13 in the evaluation table.]**

The result is deliberately not perfect.

Incident thirteen contains an adversarial disk-pressure distractor. SignalRoom follows that distractor and makes the wrong diagnosis. The miss remains visible in the dashboard and the committed artifact.

That matters because a perfect score on an easy synthetic set would prove very little. The main limitation is still synthetic-case overfitting, so the next credible evaluation should be frozen by an experienced external SRE before any further prompt changes.

**[4:27 — Scroll to the final “Abstention is the product” section.]**

My largest contribution is not adding more orchestration. It is turning evidence into executable assertions, and making abstention a measurable capability rather than a soft confidence score.

My hot take is simple.

Abstention is the product.

Any agent can produce a confident answer. A reliable agent can prove when an answer is not justified.

That is SignalRoom: evidence before action.
