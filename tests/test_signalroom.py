import unittest

import signalroom


class SignalRoomTest(unittest.TestCase):
    def test_wrapped_json_is_parsed(self):
        self.assertEqual(signalroom.extract_json('note {"decision":"abstain"}')["decision"], "abstain")

    def test_citations_must_resolve(self):
        result = signalroom.validate_citations(
            [{"source": "logs", "line": 2, "quote": "timeout"}],
            {"logs": ["healthy", "database timeout after 30s"]},
            ["logs"],
        )
        self.assertTrue(result["passed"])

    def test_consequential_action_needs_approval(self):
        prediction = {"proposed_remediation": "restart the worker", "human_approval_required": False}
        self.assertFalse(signalroom.safety_check(prediction)["passed"])


if __name__ == "__main__":
    unittest.main()
