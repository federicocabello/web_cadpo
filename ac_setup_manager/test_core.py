import tempfile
import unittest
from pathlib import Path

from core import (
    SetupDocument,
    discover_control_templates,
    range_summary,
    read_physics_default,
    validate_range,
    write_physics_default,
)


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

    def test_disable_and_reenable_preserves_values(self):
        document = SetupDocument(Path("setup.ini"), SAMPLE)
        disabled = document.render({}, disabled={"ARB_FRONT"})
        self.assertIn("; CADPO_SETUP_DISABLED [ARB_FRONT]", disabled)
        self.assertIn("; CADPO_SETUP_DISABLED STEP=5000 ; conservar", disabled)

        reopened = SetupDocument(Path("setup.ini"), disabled)
        section = reopened.section("ARB_FRONT")
        self.assertIsNotNone(section)
        self.assertFalse(section.enabled)
        self.assertEqual(section.values["STEP"], "5000")

        enabled = reopened.render({}, disabled=set())
        self.assertIn("[ARB_FRONT]", enabled)
        self.assertIn("STEP=5000 ; conservar", enabled)
        self.assertNotIn("CADPO_SETUP_DISABLED", enabled)

    def test_new_section_can_start_disabled(self):
        document = SetupDocument(Path("setup.ini"), SAMPLE)
        rendered = document.render(
            {}, added=[("BRAKE_BIAS", {"MIN": "50", "MAX": "70", "STEP": "1"})],
            disabled={"BRAKE_BIAS"},
        )
        self.assertIn("; CADPO_SETUP_DISABLED [BRAKE_BIAS]", rendered)
        reopened = SetupDocument(Path("setup.ini"), rendered)
        self.assertFalse(reopened.section("BRAKE_BIAS").enabled)

    def test_range_validation(self):
        self.assertEqual(validate_range({"MIN": "0", "MAX": "10", "STEP": "2"}), [])
        self.assertTrue(validate_range({"MIN": "0", "MAX": "10", "STEP": "3"}))
        self.assertIn("6 posiciones", range_summary({"MIN": "0", "MAX": "10", "STEP": "2"}))

    def test_discover_and_update_missing_rear_wing(self):
        with tempfile.TemporaryDirectory() as temp:
            data = Path(temp)
            (data / "aero.ini").write_text(
                "[WING_1]\nNAME=FRONT\nANGLE=3\n\n[WING_2]\nNAME=REAR\nANGLE=4 ; conservar\n",
                encoding="utf-8",
            )
            templates = discover_control_templates(data, {"WING_1"})
            self.assertEqual([item.section for item in templates], ["WING_2"])
            value, source = read_physics_default(data, "WING_2")
            self.assertEqual(value, "4")
            self.assertIn("aero.ini", source)
            write_physics_default(data, "WING_2", "3")
            rendered = (data / "aero.ini").read_text(encoding="utf-8")
            self.assertIn("ANGLE=3 ; conservar", rendered)

    def test_discovers_rear_arb_missing_only_from_setup(self):
        with tempfile.TemporaryDirectory() as temp:
            data = Path(temp)
            (data / "suspensions.ini").write_text(
                "[ARB]\nFRONT=25000\nREAR=18000\n",
                encoding="utf-8",
            )
            templates = discover_control_templates(data, {"ARB_FRONT"})
            sections = {item.section for item in templates}
            self.assertIn("ARB_REAR", sections)
            self.assertNotIn("ARB_FRONT", sections)


if __name__ == "__main__":
    unittest.main()
