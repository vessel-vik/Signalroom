# Final-round prompt

Act as the final chair of a hackathon judging panel. Select one concept to build in a 10-hour draft. Do not average votes; choose the concept with the best defensible path to a high score.

Finalists:

1. SignalRoom: on-call incident evidence agent with falsifiable hypotheses, a read-only tool allowlist, exact citation verification, human approval, 12 fixed cases, and a correct abstention case.
2. ReleaseProof: AI-generated pull-request review against requirements and executed tests; strong measurement but close to the organizer's repository-analysis example.
3. AccessLoop: accessibility triage, patch, and recheck; strong before/after metric but risks becoming a linter wrapper.

Known first-round preferences: Claude Sonnet chose AccessLoop; Qwen 3.5 chose ReleaseProof; Qwen 2.5 and Ornith chose SignalRoom. All agreed that executed-tool evidence and verification matter more than unsupported model prose.

Return JSON with the winner, why it wins, why not the others, minimum scope, primary metric, hard case, fatal risk and mitigation, demo moment, and hot take.

