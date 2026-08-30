"use strict";
// Headless render test for web/app.js: drives the real dashboard code against the
// committed evaluation with a minimal DOM shim, asserting the whole pipeline runs
// (overview, detail, and every trajectory step for every case) without throwing.
// Run: node tests/test_dashboard.js    (no browser, no dependencies)

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "web/app.js"), "utf8");
const body = source.slice(0, source.indexOf("\nPromise.all(")); // drop the async bootstrap
const results = require(path.join(root, "web/results.json"));
const cases = require(path.join(root, "data/cases.json"));

const cache = {};
const fakeEl = () => ({
  textContent: "", className: "", innerHTML: "", value: "", disabled: false, id: "", hidden: false, style: {},
  setAttribute() {}, getAttribute() { return ""; }, addEventListener() {},
  append() {}, replaceChildren() {}, scrollIntoView() {}, querySelectorAll: () => [],
});
const document = {
  getElementById: (id) => (cache[id] ||= Object.assign(fakeEl(), { id })),
  createElement: () => fakeEl(),
  querySelectorAll: () => [],
  querySelector: () => null,
};

const out = {};
const sandbox = {
  document, console, CSS: { escape: (s) => s }, requestAnimationFrame: (cb) => cb(),
  __RESULTS: results, __CASES: cases, __out: out,
};

const driver = `
report = __RESULTS; catalog = __CASES;
let rendered = 0;
for (let i = 0; i < report.cases.length; i++) {
  selected = i; stepIndex = 0; highlight = null; viewLive = false;
  renderMetrics(); renderOverview(); renderDetail();
  for (let s = 0; s < steps.length; s++) { stepIndex = s; renderStep(); }
  rendered++;
}
selected = report.cases.findIndex((c) => c.id === "inc-12"); renderDetail();
__out.inc12_status = document.getElementById("decision-status").textContent;
__out.inc12_steps = steps.length;
selected = report.cases.findIndex((c) => c.id === "inc-03"); renderDetail();
__out.inc03_steps = steps.length;
__out.advanced_score = document.getElementById("advanced-score").textContent;
__out.rendered = rendered;
`;

vm.runInNewContext(body + driver, sandbox);

let passed = 0;
function assert(cond, msg) {
  if (!cond) { console.error("FAIL: " + msg); process.exit(1); }
  passed++;
}

assert(out.rendered === results.cases.length, `rendered all cases (${out.rendered}/${results.cases.length})`);
assert(out.advanced_score === "100/100", `advanced score renders (${out.advanced_score})`);
assert(out.inc12_status === "Evidence insufficient", `abstain case shows insufficient evidence (${out.inc12_status})`);
assert(out.inc12_steps === 4, `abstain case has 4 trajectory steps (${out.inc12_steps})`);
assert(out.inc03_steps === 5, `repair case has 5 trajectory steps incl. citation repair (${out.inc03_steps})`);

console.log(`dashboard render test: ${passed} assertions passed across ${out.rendered} cases`);
