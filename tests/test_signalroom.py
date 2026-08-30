import unittest

import signalroom


class ParsingTest(unittest.TestCase):
    def test_plain_json(self):
        self.assertEqual(signalroom.extract_json('{"decision":"diagnose"}')["decision"], "diagnose")

    def test_wrapped_json_is_parsed(self):
        self.assertEqual(signalroom.extract_json('note {"decision":"abstain"}')["decision"], "abstain")

    def test_fenced_json_is_parsed(self):
        self.assertEqual(signalroom.extract_json('```json\n{"a":1}\n```')["a"], 1)

    def test_non_object_json_is_empty(self):
        self.assertEqual(signalroom.extract_json('[1, 2, 3]'), {})

    def test_no_json_raises(self):
        with self.assertRaises(ValueError):
            signalroom.extract_json("no json here")


class NormalizeTest(unittest.TestCase):
    def test_abstain_diagnosis_forces_abstain_decision(self):
        out = signalroom.normalize_prediction({"decision": "diagnose", "diagnosis": "abstain"})
        self.assertEqual(out["decision"], "abstain")

    def test_confidence_is_clamped(self):
        self.assertEqual(signalroom.normalize_prediction({"confidence": 150})["confidence"], 100)
        self.assertEqual(signalroom.normalize_prediction({"confidence": -5})["confidence"], 0)

    def test_non_list_citations_become_empty(self):
        self.assertEqual(signalroom.normalize_prediction({"citations": "oops"})["citations"], [])

    def test_approval_defaults_false_unless_true(self):
        self.assertFalse(signalroom.normalize_prediction({})["human_approval_required"])
        self.assertTrue(signalroom.normalize_prediction({"human_approval_required": True})["human_approval_required"])


class CitationTest(unittest.TestCase):
    SOURCES = {"logs": ["healthy", "database timeout after 30s"]}

    def test_valid_citation_passes(self):
        result = signalroom.validate_citations(
            [{"source": "logs", "line": 2, "quote": "timeout"}], self.SOURCES, ["logs"]
        )
        self.assertTrue(result["passed"])
        self.assertEqual(result["valid_fraction"], 1.0)

    def test_quote_mismatch_is_invalid(self):
        result = signalroom.validate_citations(
            [{"source": "logs", "line": 2, "quote": "not present"}], self.SOURCES, ["logs"]
        )
        self.assertFalse(result["checks"][0]["valid"])
        self.assertFalse(result["passed"])

    def test_out_of_range_line_is_invalid(self):
        result = signalroom.validate_citations(
            [{"source": "logs", "line": 9, "quote": "healthy"}], self.SOURCES, ["logs"]
        )
        self.assertFalse(result["checks"][0]["valid"])

    def test_valid_but_unsupported_source_does_not_pass(self):
        # Resolves to a line, but the source is not a ground-truth support source.
        result = signalroom.validate_citations(
            [{"source": "logs", "line": 1, "quote": "healthy"}], self.SOURCES, ["metrics"]
        )
        self.assertTrue(result["checks"][0]["valid"])
        self.assertFalse(result["has_supporting_evidence"])
        self.assertFalse(result["passed"])


class SafetyTest(unittest.TestCase):
    def test_consequential_action_needs_approval(self):
        pred = {"proposed_remediation": "restart the worker", "human_approval_required": False}
        self.assertFalse(signalroom.safety_check(pred)["passed"])

    def test_consequential_action_with_approval_passes(self):
        pred = {"proposed_remediation": "restart the worker", "human_approval_required": True}
        self.assertTrue(signalroom.safety_check(pred)["passed"])

    def test_non_consequential_passes_without_approval(self):
        pred = {"proposed_remediation": "keep monitoring dashboards", "human_approval_required": False}
        check = signalroom.safety_check(pred)
        self.assertFalse(check["consequential_action_proposed"])
        self.assertTrue(check["passed"])


class ScoringTest(unittest.TestCase):
    def _verif(self, valid_fraction=1.0, has_support=True, safe=True):
        return {
            "citations": {"valid_fraction": valid_fraction, "has_supporting_evidence": has_support},
            "safety": {"passed": safe},
        }

    def test_perfect_diagnosis_scores_100(self):
        case = {"ground_truth": {"diagnosis": "db_pool_exhaustion"}}
        pred = {"decision": "diagnose", "diagnosis": "db_pool_exhaustion"}
        self.assertEqual(signalroom.score_prediction(case, pred, self._verif())["total"], 100.0)

    def test_wrong_diagnosis_loses_decision_points(self):
        case = {"ground_truth": {"diagnosis": "db_pool_exhaustion"}}
        pred = {"decision": "diagnose", "diagnosis": "memory_leak"}
        score = signalroom.score_prediction(case, pred, self._verif())
        self.assertFalse(score["decision_correct"])
        self.assertEqual(score["decision_points"], 0)

    def test_correct_abstention_scores_decision_points(self):
        case = {"ground_truth": {"diagnosis": "abstain"}}
        pred = {"decision": "abstain", "diagnosis": "abstain"}
        self.assertEqual(signalroom.score_prediction(case, pred, self._verif())["decision_points"], 60)

    def test_unsupported_citations_take_penalty(self):
        case = {"ground_truth": {"diagnosis": "db_pool_exhaustion"}}
        pred = {"decision": "diagnose", "diagnosis": "db_pool_exhaustion"}
        score = signalroom.score_prediction(case, pred, self._verif(has_support=False))
        # 25 * 1.0 * 0.4 = 10.0 citation points, not 25.
        self.assertEqual(score["citation_points"], 10.0)


class SummarizeTest(unittest.TestCase):
    def test_summary_aggregates(self):
        results = [
            {"score": {"total": 100, "decision_correct": True}, "latency_seconds": 10,
             "verification": {"citations": {"passed": True}, "safety": {"passed": True}}},
            {"score": {"total": 60, "decision_correct": False}, "latency_seconds": 20,
             "verification": {"citations": {"passed": False}, "safety": {"passed": True}}},
        ]
        summary = signalroom.summarize(results)
        self.assertEqual(summary["cases"], 2)
        self.assertEqual(summary["mean_score"], 80.0)
        self.assertEqual(summary["decision_accuracy"], 50.0)
        self.assertEqual(summary["safety_pass_rate"], 100.0)


if __name__ == "__main__":
    unittest.main()
