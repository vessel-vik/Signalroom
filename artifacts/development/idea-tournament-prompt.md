# Idea tournament prompt

You are an uncompromising hackathon judge and product-engineering lead. Evaluate six candidate concepts for the micro1 Frontier Engineering Challenge 2026.

The submission must solve a specific real-world bottleneck with a purposeful agentic workflow, present a simple baseline and a meaningfully improved solution, run on at least 10 fixed evaluation cases including a hard case, remain reproducible from a clean environment, keep consequential actions sandboxed with human approval, and produce a polished final artifact a professional would sign their name to.

Weights: Agent Solution & Engineering 30; End-to-End Quality 20; Problem & User Value 15; Measured Improvement 15; Reproducibility 15; Hot Take/Insights 5. The team has roughly 10 hours for a strong draft. Local tools include Python, TypeScript/JavaScript, Claude Code, Ollama, qwen2.5:7b-instruct, qwen3.5:4b, and Ornith 9B. Avoid paid APIs and private data.

Candidates:

A. SignalRoom — an incident evidence agent for on-call engineers. It ingests a synthetic incident packet (alerts, logs, service map, recent deploy diff, runbook), forms competing hypotheses, executes only read-only diagnostic tools in a sandbox, verifies every conclusion against cited evidence, and produces a human-approval incident decision brief. Baseline: one direct prompt over the packet. Primary metric: correct root-cause decision with supported evidence and zero unsafe actions across 12 fixed incidents.

B. ReleaseProof — a release-readiness agent for teams merging AI-generated code. It maps issue acceptance criteria to a diff, runs tests and static checks, identifies unsupported claims, and creates an evidence-backed go/no-go memo with a human sign-off gate. Baseline: direct LLM review of the diff. Primary metric: defect/requirement-gap detection F1 across synthetic repositories.

C. HandoffZero — a verified shift-handoff agent for operations teams. It reconciles logs, tickets, and operator notes; detects contradictions and missing ownership; and outputs a traceable handoff with unresolved risks and explicit acknowledgments. Baseline: summarization prompt. Primary metric: critical-fact recall minus unsupported claims across 12 synthetic shifts.

D. BidLens — an RFP compliance agent for small vendors. It decomposes requirements, maps proposal evidence, flags gaps and contradictions, and produces a traceable final submission checklist for human approval. Baseline: direct prompt asking whether the proposal is compliant. Primary metric: requirement-gap detection F1 across synthetic RFP/proposal pairs.

E. BoardProof — an evidence compiler for startup finance/operations leads. It turns source metrics and notes into a board-update draft where every quantitative and causal claim is checked, cited, and uncertainty-labeled. Baseline: direct drafting prompt. Primary metric: supported-claim precision plus reviewer edit distance across 12 synthetic reporting packs.

F. AccessLoop — an accessibility launch-gate agent for frontend teams. It runs automated checks against small fixture sites, inspects DOM/context to reject false positives, proposes a minimal patch, reruns the checks, and produces an evidence pack for human approval. Baseline: raw automated accessibility output. Primary metric: verified issue remediation rate without regressions across 10 fixture sites.

Your job:

1. Score every candidate 0–100 using the challenge weights. Be harsh about generic wrappers, unverifiable metrics, fragile scope, and workflows that do not genuinely need agents.
2. For each, name the strongest differentiator, the fatal risk, and the smallest credible 10-hour version.
3. Rank them and select one winner.
4. Stress-test the winner: what will judges distrust, what hard case should be included, what experiment should probably be removed, and what single design choice is most likely to create a measurable gain over baseline?
5. If no candidate is strong enough, propose one replacement.

Return concise JSON with keys `model_perspective`, `scores`, `ranking`, `winner`, `winner_rationale`, `judge_distrust`, `hard_case`, `remove_experiment`, `highest_leverage_change`, and `replacement_if_needed`.
