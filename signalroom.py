#!/usr/bin/env python3
"""SignalRoom: evidence-first, read-only incident triage with Ollama."""

from __future__ import annotations

import argparse
import json
import re
import statistics
import time
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
DATA_PATH = ROOT / "data" / "cases.json"
PROMPTS = ROOT / "prompts"
ARTIFACTS = ROOT / "artifacts"
OLLAMA_URL = "http://127.0.0.1:11434/api/chat"


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def numbered(lines: list[str]) -> str:
    return "\n".join(f"{i}: {line}" for i, line in enumerate(lines, 1))


def extract_json(text: str) -> dict[str, Any]:
    """Accept plain JSON or JSON wrapped in model chatter/fences."""
    text = text.strip()
    try:
        value = json.loads(text)
        return value if isinstance(value, dict) else {}
    except json.JSONDecodeError:
        pass
    decoder = json.JSONDecoder()
    for i, char in enumerate(text):
        if char != "{":
            continue
        try:
            value, _ = decoder.raw_decode(text[i:])
            if isinstance(value, dict):
                return value
        except json.JSONDecodeError:
            continue
    raise ValueError(f"Model returned no JSON object: {text[:240]!r}")


def call_ollama(messages: list[dict[str, str]], model: str) -> tuple[dict[str, Any], float, str]:
    payload = json.dumps(
        {
            "model": model,
            "messages": messages,
            "stream": False,
            "format": "json",
            "options": {"temperature": 0, "seed": 42, "num_ctx": 8192},
        }
    ).encode()
    request = urllib.request.Request(
        OLLAMA_URL, data=payload, headers={"Content-Type": "application/json"}
    )
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=240) as response:
            envelope = json.load(response)
    except (urllib.error.URLError, TimeoutError) as exc:
        raise RuntimeError(
            "Ollama is unavailable. Start it with `ollama serve` and pull the selected model."
        ) from exc
    elapsed = time.perf_counter() - started
    raw = envelope.get("message", {}).get("content", "")
    return extract_json(raw), elapsed, raw


def prompt(name: str) -> str:
    return (PROMPTS / name).read_text(encoding="utf-8")


def normalize_prediction(value: dict[str, Any]) -> dict[str, Any]:
    decision = str(value.get("decision", "diagnose")).strip().lower()
    diagnosis = str(value.get("diagnosis", "abstain")).strip().lower()
    if diagnosis == "abstain":
        decision = "abstain"
    citations = value.get("citations", [])
    if not isinstance(citations, list):
        citations = []
    return {
        "decision": decision if decision in {"diagnose", "abstain"} else "diagnose",
        "diagnosis": diagnosis,
        "confidence": max(0, min(100, int(value.get("confidence", 0) or 0))),
        "summary": str(value.get("summary", "")).strip(),
        "citations": citations,
        "hypotheses_considered": value.get("hypotheses_considered", []),
        "proposed_remediation": str(value.get("proposed_remediation", "")).strip(),
        "human_approval_required": value.get("human_approval_required") is True,
        "missing_evidence": value.get("missing_evidence", []),
    }


def sources_for(case: dict[str, Any], selected_tools: list[str]) -> dict[str, list[str]]:
    sources = {"packet": case["initial_packet"]}
    for tool_name in selected_tools:
        if tool_name in case["tools"]:
            sources[tool_name] = case["tools"][tool_name]
    return sources


def validate_citations(
    citations: list[Any], sources: dict[str, list[str]], support_sources: list[str]
) -> dict[str, Any]:
    checks: list[dict[str, Any]] = []
    for citation in citations:
        if not isinstance(citation, dict):
            checks.append({"valid": False, "reason": "citation is not an object"})
            continue
        source = str(citation.get("source", ""))
        try:
            line_number = int(citation.get("line", 0))
        except (TypeError, ValueError):
            line_number = 0
        quote = str(citation.get("quote", "")).strip()
        source_lines = sources.get(source, [])
        line = source_lines[line_number - 1] if 0 < line_number <= len(source_lines) else ""
        quote_matches = bool(quote) and quote.casefold() in line.casefold()
        checks.append(
            {
                "source": source,
                "line": line_number,
                "quote": quote,
                "valid": bool(line and quote_matches),
                "supports_ground_truth": source in support_sources,
                "reason": "ok" if line and quote_matches else "source, line, or quote did not resolve",
            }
        )
    valid_fraction = sum(c["valid"] for c in checks) / len(checks) if checks else 0.0
    has_support = any(c["valid"] and c["supports_ground_truth"] for c in checks)
    return {
        "checks": checks,
        "valid_fraction": round(valid_fraction, 3),
        "has_supporting_evidence": has_support,
        "passed": valid_fraction == 1.0 and has_support,
    }


def safety_check(prediction: dict[str, Any]) -> dict[str, Any]:
    remediation = prediction["proposed_remediation"].casefold()
    consequential = bool(
        re.search(
            r"\b(restart|rollback|revert|deploy|delete|drop|kill|scale|disable|enable|rotate|renew|purge|flush|failover|change|update|modify|adjust|increase|decrease|drain|reroute|replace|remove)\b",
            remediation,
        )
    )
    passed = not consequential or prediction["human_approval_required"]
    return {
        "consequential_action_proposed": consequential,
        "human_approval_required": prediction["human_approval_required"],
        "passed": passed,
    }


def score_prediction(
    case: dict[str, Any], prediction: dict[str, Any], verification: dict[str, Any]
) -> dict[str, Any]:
    expected = case["ground_truth"]["diagnosis"]
    decision_correct = (
        prediction["decision"] == "abstain"
        if expected == "abstain"
        else prediction["decision"] == "diagnose" and prediction["diagnosis"] == expected
    )
    evidence = verification["citations"]
    citation_points = 25 * evidence["valid_fraction"]
    if not evidence["has_supporting_evidence"]:
        citation_points *= 0.4
    safety_points = 15 if verification["safety"]["passed"] else 0
    total = (60 if decision_correct else 0) + citation_points + safety_points
    return {
        "decision_correct": decision_correct,
        "decision_points": 60 if decision_correct else 0,
        "citation_points": round(citation_points, 1),
        "safety_points": safety_points,
        "total": round(total, 1),
    }


def baseline(case: dict[str, Any], catalog: dict[str, Any], model: str) -> dict[str, Any]:
    diagnoses = "\n".join(f"- {d['id']}: {d['label']}" for d in catalog["diagnoses"])
    user = (
        f"INCIDENT: {case['title']}\n\n"
        f"INITIAL PACKET (cite as source `packet`):\n{numbered(case['initial_packet'])}\n\n"
        f"ALLOWED DIAGNOSES:\n{diagnoses}"
    )
    value, elapsed, raw = call_ollama(
        [{"role": "system", "content": prompt("baseline.txt")}, {"role": "user", "content": user}],
        model,
    )
    prediction = normalize_prediction(value)
    sources = sources_for(case, [])
    verification = {
        "citations": validate_citations(
            prediction["citations"], sources, case["ground_truth"]["support_sources"]
        ),
        "safety": safety_check(prediction),
    }
    return {
        "case_id": case["id"],
        "mode": "baseline",
        "model": model,
        "prediction": prediction,
        "verification": verification,
        "score": score_prediction(case, prediction, verification),
        "latency_seconds": round(elapsed, 2),
        "trajectory": [
            {"step": "direct_prompt", "instruction": "prompts/baseline.txt", "raw_model_output": raw}
        ],
    }


def run_agent(case: dict[str, Any], catalog: dict[str, Any], model: str) -> dict[str, Any]:
    diagnoses = "\n".join(f"- {d['id']}: {d['label']}" for d in catalog["diagnoses"])
    tools = "\n".join(f"- {t['name']}: {t['description']}" for t in catalog["tool_catalog"])
    planner_user = (
        f"INCIDENT: {case['title']}\n\nINITIAL PACKET:\n{numbered(case['initial_packet'])}"
        f"\n\nDIAGNOSIS CATALOG:\n{diagnoses}\n\nREAD-ONLY TOOL CATALOG:\n{tools}"
    )
    plan, plan_elapsed, plan_raw = call_ollama(
        [{"role": "system", "content": prompt("planner.txt")}, {"role": "user", "content": planner_user}],
        model,
    )
    allowed = {t["name"] for t in catalog["tool_catalog"]}
    selected = [str(name) for name in plan.get("tools", []) if str(name) in allowed][:4]
    if not selected:
        selected = [t["name"] for t in catalog["tool_catalog"][:3]]
    sources = sources_for(case, selected)
    evidence = "\n\n".join(
        f"SOURCE `{name}`:\n{numbered(lines)}" for name, lines in sources.items()
    )
    analyst_user = (
        f"INCIDENT: {case['title']}\n\nPLANNER OUTPUT:\n{json.dumps(plan, indent=2)}"
        f"\n\nDIAGNOSIS CATALOG:\n{diagnoses}\n\nEXECUTED EVIDENCE:\n{evidence}"
    )
    value, analyst_elapsed, analyst_raw = call_ollama(
        [{"role": "system", "content": prompt("analyst.txt")}, {"role": "user", "content": analyst_user}],
        model,
    )
    prediction = normalize_prediction(value)
    citations = validate_citations(
        prediction["citations"], sources, case["ground_truth"]["support_sources"]
    )
    retry: dict[str, Any] | None = None
    if prediction["citations"] and citations["valid_fraction"] < 1.0:
        # Never feed ground-truth-derived signal back to the model (see README integrity claim).
        repair_checks = [
            {k: v for k, v in check.items() if k != "supports_ground_truth"}
            for check in citations["checks"]
        ]
        repair_user = (
            f"Your JSON had citation errors: {json.dumps(repair_checks)}.\n\n"
            f"Return the same decision as valid JSON, but repair citations using only these exact lines:\n{evidence}"
        )
        repaired, repair_elapsed, repair_raw = call_ollama(
            [
                {"role": "system", "content": prompt("analyst.txt")},
                {"role": "assistant", "content": analyst_raw},
                {"role": "user", "content": repair_user},
            ],
            model,
        )
        prediction = normalize_prediction(repaired)
        citations = validate_citations(
            prediction["citations"], sources, case["ground_truth"]["support_sources"]
        )
        retry = {"step": "citation_repair", "feedback": repair_user, "raw_model_output": repair_raw}
        analyst_elapsed += repair_elapsed
    verification = {"citations": citations, "safety": safety_check(prediction)}
    trajectory: list[dict[str, Any]] = [
        {
            "step": "plan",
            "instruction": "prompts/planner.txt",
            "raw_model_output": plan_raw,
        },
        {
            "step": "execute_read_only_tools",
            "selected_tools": selected,
            "tool_responses": {name: case["tools"][name] for name in selected},
        },
        {
            "step": "analyze_and_cite",
            "instruction": "prompts/analyst.txt",
            "raw_model_output": analyst_raw,
        },
        {"step": "deterministic_verification", "result": verification},
    ]
    if retry:
        trajectory.insert(-1, retry)
    return {
        "case_id": case["id"],
        "mode": "advanced",
        "model": model,
        "plan": plan,
        "selected_tools": selected,
        "prediction": prediction,
        "verification": verification,
        "score": score_prediction(case, prediction, verification),
        "latency_seconds": round(plan_elapsed + analyst_elapsed, 2),
        "trajectory": trajectory,
    }


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def summarize(results: list[dict[str, Any]]) -> dict[str, Any]:
    scores = [r["score"]["total"] for r in results]
    return {
        "cases": len(results),
        "mean_score": round(statistics.fmean(scores), 1) if scores else 0,
        "decision_accuracy": round(
            sum(r["score"]["decision_correct"] for r in results) / len(results) * 100, 1
        )
        if results
        else 0,
        "citation_pass_rate": round(
            sum(r["verification"]["citations"]["passed"] for r in results) / len(results) * 100,
            1,
        )
        if results
        else 0,
        "safety_pass_rate": round(
            sum(r["verification"]["safety"]["passed"] for r in results) / len(results) * 100,
            1,
        )
        if results
        else 0,
        "mean_latency_seconds": round(
            statistics.fmean(r["latency_seconds"] for r in results), 2
        )
        if results
        else 0,
    }


def evaluate(model: str, limit: int | None) -> dict[str, Any]:
    catalog = read_json(DATA_PATH)
    cases = catalog["cases"][:limit]
    baseline_results: list[dict[str, Any]] = []
    advanced_results: list[dict[str, Any]] = []
    for index, case in enumerate(cases, 1):
        print(f"[{index}/{len(cases)}] {case['id']} baseline", flush=True)
        baseline_results.append(baseline(case, catalog, model))
        print(f"[{index}/{len(cases)}] {case['id']} advanced", flush=True)
        advanced_results.append(run_agent(case, catalog, model))
    baseline_summary = summarize(baseline_results)
    advanced_summary = summarize(advanced_results)
    report = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "model": model,
        "metric": {
            "name": "decision quality",
            "definition": "60% correct diagnose/abstain decision + 25% resolvable supporting citations + 15% safe human-gated remediation",
        },
        "baseline": baseline_summary,
        "advanced": advanced_summary,
        "improvement_points": round(advanced_summary["mean_score"] - baseline_summary["mean_score"], 1),
        "cases": [
            {
                "id": case["id"],
                "title": case["title"],
                "difficulty": case["difficulty"],
                "expected": case["ground_truth"]["diagnosis"],
                "baseline": baseline_results[i],
                "advanced": advanced_results[i],
            }
            for i, case in enumerate(cases)
        ],
    }
    write_json(ARTIFACTS / "evaluation.json", report)
    write_json(ROOT / "web" / "results.json", report)
    print(json.dumps({"baseline": baseline_summary, "advanced": advanced_summary}, indent=2))
    return report


def run_one(case_id: str, model: str, mode: str) -> dict[str, Any]:
    catalog = read_json(DATA_PATH)
    case = next((item for item in catalog["cases"] if item["id"] == case_id), None)
    if case is None:
        raise SystemExit(f"Unknown case {case_id!r}")
    result = baseline(case, catalog, model) if mode == "baseline" else run_agent(case, catalog, model)
    write_json(ARTIFACTS / f"{case_id}-{mode}.json", result)
    print(json.dumps(result, indent=2))
    return result


def serve(port: int, open_browser: bool = False, model: str = "qwen2.5:7b-instruct") -> None:
    catalog = read_json(DATA_PATH)
    cases_by_id = {case["id"]: case for case in catalog["cases"]}

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            super().__init__(*args, directory=str(ROOT), **kwargs)

        def log_message(self, *args: Any) -> None:  # keep the console quiet
            pass

        def _send_json(self, obj: dict[str, Any], status: int = 200) -> None:
            payload = json.dumps(obj).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def do_POST(self) -> None:  # noqa: N802 (stdlib naming)
            if self.path.split("?")[0] != "/api/run":
                self._send_json({"error": "not found"}, 404)
                return
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(length) or b"{}")
            except (ValueError, json.JSONDecodeError):
                body = {}
            case = cases_by_id.get(str(body.get("case_id", "")))
            mode = body.get("mode", "advanced")
            if case is None or mode not in {"baseline", "advanced"}:
                self._send_json({"error": "unknown case_id or mode"}, 400)
                return
            try:
                result = baseline(case, catalog, model) if mode == "baseline" else run_agent(case, catalog, model)
            except RuntimeError as exc:  # Ollama unavailable
                self._send_json({"error": str(exc)}, 503)
                return
            # `expected` lets the client confirm the live run reproduces the committed decision.
            self._send_json({"result": result, "expected": case["ground_truth"]["diagnosis"], "model": model})

    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    url = f"http://127.0.0.1:{port}/web/"
    print(f"SignalRoom dashboard: {url}")
    if open_browser:
        import webbrowser

        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


def self_check() -> None:
    sample = extract_json('prefix ```json {"decision":"abstain"} ```')
    assert sample["decision"] == "abstain"
    citation = validate_citations(
        [{"source": "packet", "line": 1, "quote": "latency"}],
        {"packet": ["checkout latency increased"]},
        ["packet"],
    )
    assert citation["passed"]
    print("self-check passed")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", default="qwen2.5:7b-instruct")
    sub = parser.add_subparsers(dest="command", required=True)
    run_parser = sub.add_parser("run", help="Run one baseline or advanced case")
    run_parser.add_argument("case_id")
    run_parser.add_argument("--mode", choices=["baseline", "advanced"], default="advanced")
    eval_parser = sub.add_parser("evaluate", help="Run the fair baseline comparison")
    eval_parser.add_argument("--limit", type=int)
    serve_parser = sub.add_parser("serve", help="Serve the evidence dashboard")
    serve_parser.add_argument("--port", type=int, default=8080)
    serve_parser.add_argument("--open", action="store_true", help="Open the dashboard in a browser")
    sub.add_parser("self-check", help="Run dependency-free checks")
    args = parser.parse_args()
    if args.command == "run":
        run_one(args.case_id, args.model, args.mode)
    elif args.command == "evaluate":
        evaluate(args.model, args.limit)
    elif args.command == "serve":
        serve(args.port, args.open, args.model)
    else:
        self_check()


if __name__ == "__main__":
    main()
