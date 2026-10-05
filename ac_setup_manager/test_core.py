import tempfile
import unittest
from pathlib import Path

from core import SetupDocument, range_summary, validate_range


SAMPLE = "; encabezado\r\n[ARB_FRONT]\r\nNAME=Front ARB\r\nMIN=10000\r\nMAX=50000\r\nSTEP=5000 ; conservar\r\nTAB=SUSPENSION\r\n\r\n[FINAL_GEAR_RATIO]\r\nRATIOS=final.rto\r\n"


class SetupDocumentTests(unittest.TestCase):
    def test_parse_and_preserve_comments(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "setup.ini"
            path.write_text(SAMPLE, encoding="utf-8")
            document = SetupDocument(path, SAMPLE)
            self.assertEqual(document.section("ARB_FRONT").values["STEP"], "5000")
            rendered = document.render({"ARB_FRONT": {"STEP": "2500"}})
            self.assertIn("STEP=2500 ; conservar", rendered)
            self.assertNotIn("STEP =", rendered)

    def test_delete_and_add(self):
        document = SetupDocument(Path("setup.ini"), SAMPLE)
        rendered = document.render({}, {"FINAL_GEAR_RATIO"}, [("BRAKE_BIAS", {"MIN": "50", "MAX": "70", "STEP": "1"})])
        self.assertNotIn("[FINAL_GEAR_RATIO]", rendered)
        self.assertIn("[BRAKE_BIAS]", rendered)

    def test_range_validation(self):
        self.assertEqual(validate_range({"MIN": "0", "MAX": "10", "STEP": "2"}), [])
        self.assertTrue(validate_range({"MIN": "0", "MAX": "10", "STEP": "3"}))
        self.assertIn("6 posiciones", range_summary({"MIN": "0", "MAX": "10", "STEP": "2"}))


if __name__ == "__main__":
    unittest.main()
