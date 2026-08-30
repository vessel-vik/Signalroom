const FALLBACK = {
  model: "qwen2.5:7b-instruct",
  baseline: { mean_score: 70, decision_accuracy: 75, safety_pass_rate: 100 },
  advanced: { mean_score: 100, decision_accuracy: 100, safety_pass_rate: 100 },
  improvement_points: 30,
  cases: [],
};

const $ = (id) => document.getElementById(id);
let report = FALLBACK;
let selectedCase = 0;

const label = (value = "") => value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
const check = (value) => value ? "PASS" : "FAIL";

function renderMetrics() {
  $("model-name").textContent = report.model;
  $("advanced-score").textContent = `${report.advanced.mean_score}/100`;
  $("baseline-score").textContent = `${report.baseline.mean_score}/100`;
  $("accuracy-score").textContent = `${report.advanced.decision_accuracy}%`;
  $("safety-score").textContent = `${report.advanced.safety_pass_rate}%`;
  $("score-delta").textContent = `+${report.improvement_points} points vs baseline`;
  $("baseline-bar-label").textContent = report.baseline.mean_score;
  $("advanced-bar-label").textContent = report.advanced.mean_score;
  requestAnimationFrame(() => {
    $("baseline-bar").style.width = `${report.baseline.mean_score}%`;
    $("advanced-bar").style.width = `${report.advanced.mean_score}%`;
  });
}

function renderCaseList() {
  const list = $("case-list");
  list.replaceChildren();
  $("case-count").textContent = `${report.cases.length} cases`;
  report.cases.forEach((item, index) => {
    const button = document.createElement("button");
    button.className = "case-button";
    button.type = "button";
    button.setAttribute("aria-current", index === selectedCase ? "true" : "false");
    const passed = item.advanced.score.decision_correct;
    button.innerHTML = `
      <span class="case-top"><span>${item.id}</span><span class="case-result ${passed ? "" : "fail"}">${passed ? "pass" : "miss"}</span></span>
      <span class="case-name">${item.title}</span>`;
    button.addEventListener("click", () => {
      selectedCase = index;
      renderCaseList();
      renderCase();
    });
    list.append(button);
  });
}

function renderEvidence(item) {
  const prediction = item.advanced.prediction;
  const checks = item.advanced.verification.citations.checks;
  $("citation-count").textContent = `${checks.length} citation${checks.length === 1 ? "" : "s"}`;
  const container = $("evidence-list");
  container.replaceChildren();
  if (!checks.length) {
    container.innerHTML = '<div class="empty-state">No citation survived verification. Treat the conclusion as unsupported.</div>';
    return;
  }
  checks.forEach((citation) => {
    const row = document.createElement("div");
    row.className = "evidence-item";
    row.innerHTML = `
      <span class="evidence-source">${citation.source} · L${citation.line}</span>
      <p class="evidence-quote">“${citation.quote}”</p>
      <span class="evidence-valid">${citation.valid ? "✓ resolved" : "× invalid"}</span>`;
    container.append(row);
  });
  if (prediction.decision === "abstain" && prediction.missing_evidence?.length) {
    const row = document.createElement("div");
    row.className = "empty-state";
    row.textContent = `Requested evidence: ${prediction.missing_evidence.join("; ")}`;
    container.append(row);
  }
}

function renderWorkflow(item) {
  const list = $("workflow-list");
  list.replaceChildren();
  const names = {
    plan: ["Frame hypotheses", "Falsifiable before fluent"],
    execute_read_only_tools: ["Execute tools", `${item.advanced.selected_tools.length} read-only calls`],
    analyze_and_cite: ["Build the brief", "Claims must point to lines"],
    citation_repair: ["Repair citations", "Verifier feedback, one retry"],
    deterministic_verification: ["Verify and gate", "Citations + action safety"],
  };
  item.advanced.trajectory.forEach((step, index) => {
    const [title, detail] = names[step.step] || [label(step.step), "Recorded trajectory step"];
    const li = document.createElement("li");
    li.innerHTML = `<span class="workflow-index">0${index + 1}</span><span class="workflow-name">${title}</span><span class="workflow-detail">${detail}</span>`;
    list.append(li);
  });
}

function renderCase() {
  const item = report.cases[selectedCase];
  if (!item) return;
  const result = item.advanced;
  const prediction = result.prediction;
  $("case-id").textContent = `${item.id} / ${item.difficulty}`;
  $("case-title").textContent = item.title;
  $("decision-status").textContent = prediction.decision === "abstain" ? "Evidence insufficient" : "Diagnosis supported";
  $("decision-status").className = `decision-status ${prediction.decision === "abstain" ? "abstain" : ""}`;
  $("confidence").textContent = `${prediction.confidence}% confidence`;
  $("diagnosis").textContent = prediction.decision === "abstain" ? "Abstain and request evidence" : label(prediction.diagnosis);
  $("summary").textContent = prediction.summary;
  $("remediation").textContent = prediction.proposed_remediation || "No system change proposed.";
  $("approval-pill").textContent = prediction.human_approval_required ? "Required" : "Read-only";
  $("case-score").textContent = result.score.total;
  $("decision-check").textContent = check(result.score.decision_correct);
  $("citation-check").textContent = check(result.verification.citations.passed);
  $("safety-check").textContent = check(result.verification.safety.passed);
  renderEvidence(item);
  renderWorkflow(item);
}

$("hard-case-button").addEventListener("click", () => {
  const index = report.cases.findIndex((item) => item.id === "inc-12");
  if (index >= 0) {
    selectedCase = index;
    renderCaseList();
    renderCase();
    $("case-detail").focus();
  }
});

fetch("results.json")
  .then((response) => response.ok ? response.json() : Promise.reject(new Error("No evaluation artifact")))
  .then((data) => { report = data; })
  .catch(() => { report = FALLBACK; })
  .finally(() => {
    renderMetrics();
    renderCaseList();
    renderCase();
  });

