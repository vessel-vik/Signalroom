"use strict";

// SignalRoom evidence dashboard.
// Reads the committed evaluation (results.json) plus the case packets (data/cases.json).
// It never reads or renders `ground_truth`: the model never saw it, and neither does this view.

const FALLBACK = {
  model: "qwen2.5:7b-instruct",
  baseline: { mean_score: 61.6, decision_accuracy: 62.5, safety_pass_rate: 93.8 },
  advanced: { mean_score: 94.4, decision_accuracy: 93.8, safety_pass_rate: 100 },
  improvement_points: 32.8,
  cases: [],
};

const $ = (id) => document.getElementById(id);
const label = (v = "") => String(v).replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
const check = (v) => (v ? "PASS" : "FAIL");
const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let report = FALLBACK;
let catalog = null; // data/cases.json, used only for incident packets + tool catalog
let ablation = null; // artifacts/ablation.json, component decomposition
let selected = 0;
let stepIndex = 0;
let highlight = null; // "source:line" to pulse in the evidence step
const auditLog = {}; // caseId -> [{action, who, at}]
const liveByCase = {}; // caseId -> freshly produced advanced result
let viewLive = false; // show the live run instead of the committed one
const canLive = typeof location !== "undefined" && /^https?:$/.test(location.protocol);

// ---------- data helpers ----------

function caseAt(i) {
  return report.cases[i];
}

// The advanced result the detail view renders: committed by default, live when toggled.
function activeAdv(item) {
  return viewLive && liveByCase[item.id] ? liveByCase[item.id] : item.advanced;
}

function packetFor(id) {
  const c = catalog?.cases?.find((x) => x.id === id);
  return c?.initial_packet || [];
}

// The exact sources the verifier resolved against: packet + the tools the planner executed.
function executedSources(adv, id) {
  const sources = { packet: packetFor(id) };
  const exec = adv.trajectory.find((s) => s.step === "execute_read_only_tools");
  if (exec) Object.assign(sources, exec.tool_responses);
  return sources;
}

// Set of "source:line" that a valid citation points at.
function citedLines(adv) {
  const set = new Set();
  for (const ck of adv.verification.citations.checks) {
    if (ck.valid) set.add(`${ck.source}:${ck.line}`);
  }
  return set;
}

// ---------- top scoreboard (unchanged behaviour) ----------

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

// ---------- ablation: where the improvement comes from ----------

function renderAblation() {
  const panel = $("ablation");
  if (!panel) return;
  const d = ablation && ablation.decomposition;
  if (!d) { panel.hidden = true; return; }
  panel.hidden = false;
  const delta = Math.round((d.advanced.total - d.baseline.total) * 10) / 10;
  $("ablation-eyebrow").textContent = `Where the +${delta} comes from`;
  const body = $("decomp-body");
  body.replaceChildren();
  [["Baseline", d.baseline], ["SignalRoom", d.advanced]].forEach(([name, v]) => {
    const row = document.createElement("div");
    row.className = "decomp-row";
    row.innerHTML = `
      <span class="decomp-label">${esc(name)}</span>
      <div class="decomp-bar" role="img" aria-label="${esc(name)}: decision ${v.decision}, citations ${v.citation}, safety ${v.safety} of 100">
        <span class="seg decision" style="width:${v.decision}%"></span>
        <span class="seg citation" style="width:${v.citation}%"></span>
        <span class="seg safety" style="width:${v.safety}%"></span>
      </div>
      <strong class="decomp-total">${v.total}</strong>`;
    body.append(row);
  });
}

// ---------- overview: all cases at a glance ----------

function renderOverview() {
  const body = $("overview-body");
  body.replaceChildren();
  $("case-count").textContent = `${report.cases.length} cases`;
  report.cases.forEach((item, i) => {
    const adv = activeAdv(item);
    const base = item.baseline;
    const pass = adv.score.decision_correct;
    const row = document.createElement("button");
    row.type = "button";
    row.className = "ov-row";
    row.setAttribute("role", "row");
    row.setAttribute("aria-current", i === selected ? "true" : "false");
    row.innerHTML = `
      <span class="ov-id">${esc(item.id)}</span>
      <span class="ov-title">${esc(item.title)}</span>
      <span class="ov-diff ${esc(item.difficulty)}">${esc(item.difficulty.replace("-", " "))}</span>
      <span class="ov-bar" aria-hidden="true"><span class="ov-fill base" style="width:${base.score.total}%"></span></span>
      <span class="ov-num">${base.score.total}</span>
      <span class="ov-bar" aria-hidden="true"><span class="ov-fill adv" style="width:${adv.score.total}%"></span></span>
      <span class="ov-num strong">${adv.score.total}</span>
      <span class="ov-flag ${pass ? "ok" : "miss"}">${adv.prediction.decision === "abstain" ? "abstain" : pass ? "pass" : "miss"}</span>`;
    row.addEventListener("click", () => selectCase(i, true));
    body.append(row);
  });
}

// ---------- detail: one incident, fully traced ----------

function renderDetail() {
  const item = caseAt(selected);
  if (!item) return;
  const adv = activeAdv(item);
  const p = adv.prediction;
  const abstain = p.decision === "abstain";

  $("case-id").textContent = `${item.id} / ${label(item.difficulty)}`;
  $("case-title").textContent = item.title;
  const status = $("decision-status");
  status.textContent = abstain ? "Evidence insufficient" : "Diagnosis supported";
  status.className = `decision-status ${abstain ? "abstain" : ""}`;

  // incident input (what the on-call engineer starts with)
  const packet = packetFor(item.id);
  const packetEl = $("packet-lines");
  packetEl.replaceChildren();
  packet.forEach((line, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="ln">${i + 1}</span><span>${esc(line)}</span>`;
    packetEl.append(li);
  });

  // brief
  $("confidence").textContent = `${p.confidence}% confidence`;
  $("diagnosis").textContent = abstain ? "Abstain and request evidence" : label(p.diagnosis);
  $("summary").textContent = p.summary || "—";

  // score
  $("case-score").textContent = adv.score.total;
  $("decision-check").textContent = check(adv.score.decision_correct);
  $("citation-check").textContent = check(adv.verification.citations.passed);
  $("safety-check").textContent = check(adv.verification.safety.passed);

  renderApproval(item);
  renderLiveBar(item);
  buildSteps(item);
  renderStep();
}

// live reproduce: re-run the real model on this case and compare to the committed result
function renderLiveBar(item) {
  const bar = $("live-bar");
  bar.replaceChildren();
  if (!canLive) { bar.hidden = true; return; }
  bar.hidden = false;
  const hasLive = !!liveByCase[item.id];
  const toggle = hasLive
    ? `<div class="live-toggle" role="group" aria-label="Result source">
         <button type="button" class="lt ${!viewLive ? "on" : ""}" data-src="committed">Committed</button>
         <button type="button" class="lt ${viewLive ? "on" : ""}" data-src="live">Live</button>
       </div>`
    : "";
  const wrap = document.createElement("div");
  wrap.className = "live-inner";
  wrap.innerHTML = `
    <div class="live-lead"><span class="live-k">Reproduce</span><p>Re-run the real model on this incident and compare it to the committed result.</p></div>
    <div class="live-actions">${toggle}<button type="button" class="btn run" id="btn-run">▶ Run this case live</button></div>
    <p class="live-status" id="live-status" role="status" aria-live="polite"></p>`;
  bar.append(wrap);
  $("btn-run").addEventListener("click", () => runLive(item));
  bar.querySelectorAll("[data-src]").forEach((b) =>
    b.addEventListener("click", () => { viewLive = b.getAttribute("data-src") === "live"; renderDetail(); })
  );
  if (hasLive) {
    const live = liveByCase[item.id];
    const c = item.advanced;
    const same =
      live.prediction.decision === c.prediction.decision &&
      (live.prediction.decision === "abstain" || live.prediction.diagnosis === c.prediction.diagnosis);
    $("live-status").innerHTML = `<span class="live-badge ${same ? "ok" : "diff"}">${same ? "✓ reproduced" : "≠ diverged"}</span> live run scored ${live.score.total}/100 in ${live.latency_seconds}s — ${same ? "same decision as the committed run." : "a different decision from committed."}`;
  }
}

async function runLive(item) {
  const btn = $("btn-run");
  const status = $("live-status");
  btn.disabled = true;
  btn.textContent = "Investigating…";
  status.innerHTML = `<span class="live-badge run">running</span> the model is investigating — plan, tools, citations, verify (~20–50s).`;
  try {
    const res = await fetch("../api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ case_id: item.id, mode: "advanced" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
    liveByCase[item.id] = data.result;
    viewLive = true;
    renderDetail();
  } catch (e) {
    btn.disabled = false;
    btn.textContent = "▶ Run this case live";
    status.innerHTML = `<span class="live-badge diff">error</span> ${esc(e.message || "run failed")} — is Ollama running? (ollama serve)`;
  }
}

// interactive human-approval gate
function renderApproval(item) {
  const adv = activeAdv(item);
  const p = adv.prediction;
  const wrap = $("approval");
  wrap.replaceChildren();
  const consequential = adv.verification.safety.consequential_action_proposed;
  const remediation = p.proposed_remediation && p.proposed_remediation !== "" ? p.proposed_remediation : null;

  const head = document.createElement("div");
  head.className = "approval-head";
  head.innerHTML = `
    <div class="approval-icon" aria-hidden="true">H</div>
    <div>
      <span class="approval-title">Human approval gate</span>
      <p class="approval-body">${remediation ? esc(remediation) : "No system change proposed."}</p>
    </div>
    <span class="approval-pill ${consequential ? "req" : "ro"}">${consequential ? "Approval required" : "Read-only"}</span>`;
  wrap.append(head);

  if (consequential && remediation) {
    const controls = document.createElement("div");
    controls.className = "approval-controls";
    controls.innerHTML = `
      <label class="reviewer">Reviewer
        <input id="reviewer-name" type="text" value="On-call reviewer" maxlength="40" autocomplete="off" />
      </label>
      <button class="btn approve" type="button" id="btn-approve">Approve action</button>
      <button class="btn reject" type="button" id="btn-reject">Request changes</button>`;
    wrap.append(controls);

    const logEl = document.createElement("ol");
    logEl.className = "audit-log";
    logEl.id = "audit-log";
    wrap.append(logEl);

    const record = (action) => {
      const who = ($("reviewer-name").value || "Reviewer").trim().slice(0, 40);
      (auditLog[item.id] ||= []).push({ action, who, at: new Date() });
      renderAudit(item.id);
    };
    $("btn-approve").addEventListener("click", () => record("Approved"));
    $("btn-reject").addEventListener("click", () => record("Requested changes"));
    renderAudit(item.id);
  }
}

function renderAudit(id) {
  const logEl = $("audit-log");
  if (!logEl) return;
  logEl.replaceChildren();
  const entries = auditLog[id] || [];
  if (!entries.length) {
    logEl.innerHTML = `<li class="audit-empty">Recommendation is held pending an operator decision. Nothing has been executed.</li>`;
    return;
  }
  entries.forEach((e) => {
    const li = document.createElement("li");
    li.className = `audit-entry ${e.action === "Approved" ? "ok" : "changes"}`;
    const t = e.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    li.innerHTML = `<span class="audit-when">${esc(t)}</span><span><strong>${esc(e.action)}</strong> by ${esc(e.who)}</span>`;
    logEl.append(li);
  });
}

// ---------- trajectory stepper ----------

let steps = [];

function buildSteps(item) {
  const adv = activeAdv(item);
  const traj = adv.trajectory;
  steps = [
    { key: "plan", label: "Plan", detail: "Falsifiable hypotheses", render: () => renderPlan(adv) },
    { key: "tools", label: "Evidence", detail: `${adv.selected_tools.length} read-only calls`, render: () => renderEvidence(item) },
    { key: "cite", label: "Cite", detail: "Claims point to lines", render: () => renderCite(item) },
  ];
  if (traj.some((s) => s.step === "citation_repair")) {
    steps.push({ key: "repair", label: "Repair", detail: "One verifier retry", render: () => renderRepair(traj.find((s) => s.step === "citation_repair")) });
  }
  steps.push({ key: "verify", label: "Verify", detail: "Citations + safety", render: () => renderVerify(adv) });
  if (stepIndex >= steps.length) stepIndex = 0;
}

function renderStep() {
  const tabs = $("step-tabs");
  tabs.replaceChildren();
  steps.forEach((s, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `step-tab ${i === stepIndex ? "on" : ""} ${i < stepIndex ? "done" : ""}`;
    b.innerHTML = `<span class="step-num">0${i + 1}</span><span class="step-label">${esc(s.label)}</span><span class="step-detail">${esc(s.detail)}</span>`;
    b.addEventListener("click", () => { stepIndex = i; renderStep(); });
    tabs.append(b);
  });
  $("stage").innerHTML = steps[stepIndex].render();
  wireStageLinks();
  $("step-prev").disabled = stepIndex === 0;
  $("step-next").disabled = stepIndex === steps.length - 1;
  $("step-progress").textContent = `Step ${stepIndex + 1} of ${steps.length}`;
}

function renderPlan(adv) {
  const plan = adv.plan || {};
  const hyps = Array.isArray(plan.hypotheses) ? plan.hypotheses : [];
  const cards = hyps
    .map(
      (h) => `
      <div class="hyp">
        <span class="hyp-dx">${esc(label(h.diagnosis || "—"))}</span>
        <p class="hyp-why">${esc(h.rationale || "")}</p>
        <p class="hyp-falsifier"><span>Falsifier</span>${esc(h.falsifier || "")}</p>
      </div>`
    )
    .join("");
  const tools = (adv.selected_tools || []).map((t) => `<span class="chip">${esc(t)}</span>`).join("");
  return `
    <p class="stage-lead">The planner writes hypotheses it could <em>disprove</em>, then chooses the smallest set of read-only tools that would separate them.</p>
    <div class="hyp-grid">${cards || '<div class="empty-state">No structured hypotheses recorded.</div>'}</div>
    <div class="stage-foot"><span class="stage-k">Tools selected</span><div class="chips">${tools}</div></div>
    ${plan.stop_condition ? `<div class="stage-foot"><span class="stage-k">Stop condition</span><p>${esc(plan.stop_condition)}</p></div>` : ""}`;
}

function renderEvidence(item) {
  const adv = activeAdv(item);
  const sources = executedSources(adv, item.id);
  const cited = citedLines(adv);
  const blocks = Object.entries(sources)
    .filter(([, lines]) => Array.isArray(lines) && lines.length)
    .map(([name, lines]) => {
      const rows = lines
        .map((line, i) => {
          const key = `${name}:${i + 1}`;
          const isCited = cited.has(key);
          const pulse = key === highlight ? " pulse" : "";
          return `<li class="ev-line${isCited ? " cited" : ""}${pulse}" data-key="${esc(key)}"><span class="ln">${i + 1}</span><span>${esc(line)}</span>${isCited ? '<span class="ev-tag">cited</span>' : ""}</li>`;
        })
        .join("");
      return `<div class="ev-source"><div class="ev-source-head"><span>${esc(name)}</span><span>${name === "packet" ? "incident input" : "read-only tool"}</span></div><ul class="ev-lines">${rows}</ul></div>`;
    })
    .join("");
  return `
    <p class="stage-lead">Every executed tool returns exact lines. Highlighted rows are the ones a citation resolves to — the verifier checks the quote against this text, character for character.</p>
    <div class="ev-sources">${blocks}</div>`;
}

function renderCite(item) {
  const adv = activeAdv(item);
  const p = adv.prediction;
  const checks = adv.verification.citations.checks;
  const abstain = p.decision === "abstain";
  const rows = checks
    .map(
      (c) => `
      <button type="button" class="cite-row ${c.valid ? "ok" : "bad"}" data-jump="${esc(c.source)}:${esc(c.line)}">
        <span class="cite-src">${esc(c.source)} · L${esc(c.line)}</span>
        <span class="cite-quote">“${esc(c.quote)}”</span>
        <span class="cite-state">${c.valid ? "✓ resolved" : "× unresolved"}</span>
      </button>`
    )
    .join("");
  const missing =
    abstain && Array.isArray(p.missing_evidence) && p.missing_evidence.length
      ? `<div class="stage-foot missing"><span class="stage-k">Evidence requested</span><ul>${p.missing_evidence.map((m) => `<li>${esc(m)}</li>`).join("")}</ul></div>`
      : "";
  return `
    <p class="stage-lead">${abstain ? "No cause is asserted. The brief cites the lines that show the decisive signal is absent, and names what is missing." : "The brief asserts one cause. Each claim must point to a returned line — click a citation to see it highlighted in the evidence."}</p>
    <div class="verdict ${abstain ? "abstain" : ""}"><span>${abstain ? "Decision" : "Diagnosis"}</span><strong>${abstain ? "Abstain" : esc(label(p.diagnosis))}</strong><em>${p.confidence}% confidence</em></div>
    <p class="verdict-summary">${esc(p.summary || "")}</p>
    <div class="cite-list">${rows || '<div class="empty-state">No citations recorded.</div>'}</div>
    ${missing}`;
}

function renderRepair(step) {
  return `
    <p class="stage-lead">When a quote fails to resolve, the analyst gets the failed checks and the exact available lines, and repairs the citation once. The feedback carries no answer key — only which quotes did not match.</p>
    <pre class="raw">${esc((step.feedback || "").trim())}</pre>`;
}

function renderVerify(adv) {
  const cite = adv.verification.citations;
  const safe = adv.verification.safety;
  return `
    <p class="stage-lead">This stage is code, not the model. It resolves every citation and gates any consequential action.</p>
    <div class="verify-grid">
      <div class="verify-card ${cite.passed ? "ok" : "bad"}">
        <span class="verify-k">Citations</span>
        <strong>${check(cite.passed)}</strong>
        <p>${Math.round(cite.valid_fraction * 100)}% of citations resolve to an exact line${cite.has_supporting_evidence ? "; at least one hits a ground-truth support source." : "."}</p>
      </div>
      <div class="verify-card ${safe.passed ? "ok" : "bad"}">
        <span class="verify-k">Action safety</span>
        <strong>${check(safe.passed)}</strong>
        <p>${safe.consequential_action_proposed ? "A consequential action was proposed" : "No consequential action proposed"}${safe.consequential_action_proposed ? `; human approval ${safe.human_approval_required ? "is required and set." : "was NOT required — blocked."}` : "."}</p>
      </div>
    </div>`;
}

// clicking a citation jumps to the evidence step and pulses the line
function wireStageLinks() {
  document.querySelectorAll("[data-jump]").forEach((b) => {
    b.addEventListener("click", () => {
      highlight = b.getAttribute("data-jump");
      stepIndex = steps.findIndex((s) => s.key === "tools");
      renderStep();
      const target = document.querySelector(`[data-key="${CSS.escape(highlight)}"]`);
      if (target) target.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  });
}

// ---------- selection + controls ----------

function selectCase(i, scroll) {
  selected = i;
  stepIndex = 0;
  highlight = null;
  viewLive = false;
  renderOverview();
  renderDetail();
  if (scroll) $("case-detail").scrollIntoView({ behavior: "smooth", block: "start" });
}

function wireControls() {
  $("step-prev").addEventListener("click", () => { if (stepIndex > 0) { stepIndex--; renderStep(); } });
  $("step-next").addEventListener("click", () => { if (stepIndex < steps.length - 1) { stepIndex++; renderStep(); } });
  $("hard-case-button").addEventListener("click", () => {
    const i = report.cases.findIndex((c) => c.id === "inc-12");
    if (i >= 0) selectCase(i, true);
  });
}

// ---------- boot ----------

function boot() {
  renderMetrics();
  renderAblation();
  if (!report.cases.length) {
    $("overview-body").innerHTML = '<div class="empty-state">No evaluation artifact loaded. Serve the site (python3 signalroom.py serve) so the browser can read results.json.</div>';
    return;
  }
  renderOverview();
  renderDetail();
  wireControls();
}

Promise.all([
  fetch("results.json").then((r) => (r.ok ? r.json() : Promise.reject())),
  fetch("../data/cases.json").then((r) => (r.ok ? r.json() : null)).catch(() => null),
  fetch("../artifacts/ablation.json").then((r) => (r.ok ? r.json() : null)).catch(() => null),
])
  .then(([data, cases, ablate]) => { report = data; catalog = cases; ablation = ablate; })
  .catch(() => { report = FALLBACK; })
  .finally(boot);
