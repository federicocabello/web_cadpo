import tempfile
import unittest
from pathlib import Path

from modules import scan_vehicle_modules, set_module_enabled


class VehicleModuleTests(unittest.TestCase):
    def test_turbo_can_be_disabled_and_restored_without_losing_values(self):
        with tempfile.TemporaryDirectory() as temp:
            data = Path(temp)
            original = "[ENGINE_DATA]\nLIMITER=8000\n\n[TURBO_0]\nMAX_BOOST=1.2\nWASTEGATE=0.8 ; conservar\n"
            (data / "engine.ini").write_text(original, encoding="utf-8")

            turbo = next(item for item in scan_vehicle_modules(data) if item.definition.id == "turbo")
            self.assertTrue(turbo.detected)
            self.assertTrue(turbo.enabled)
            set_module_enabled(data, turbo, False)
            disabled = (data / "engine.ini").read_text(encoding="utf-8")
            self.assertIn("; CADPO_DISABLED [TURBO_0]", disabled)
            self.assertIn("; CADPO_DISABLED MAX_BOOST=1.2", disabled)

            turbo = next(item for item in scan_vehicle_modules(data) if item.definition.id == "turbo")
            self.assertFalse(turbo.enabled)
            set_module_enabled(data, turbo, True)
            self.assertEqual((data / "engine.ini").read_text(encoding="utf-8"), original)

    def test_ers_files_are_disabled_and_restored_as_a_group(self):
        with tempfile.TemporaryDirectory() as temp:
            data = Path(temp)
            (data / "ers.ini").write_text("[HEADER]\nVERSION=1\n", encoding="utf-8")
            (data / "ctrl_ers_0.ini").write_text("[HEADER]\nNAME=Race\n", encoding="utf-8")
            ers = next(item for item in scan_vehicle_modules(data) if item.definition.id == "ers")
            set_module_enabled(data, ers, False)
            self.assertTrue((data / "ers.ini.disabled").is_file())
            self.assertTrue((data / "ctrl_ers_0.ini.disabled").is_file())
            ers = next(item for item in scan_vehicle_modules(data) if item.definition.id == "ers")
            set_module_enabled(data, ers, True)
            self.assertTrue((data / "ers.ini").is_file())
            self.assertTrue((data / "ctrl_ers_0.ini").is_file())


if __name__ == "__main__":
    unittest.main()
