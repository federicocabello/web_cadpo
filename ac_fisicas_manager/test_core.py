import tempfile
import unittest
from pathlib import Path

from core import apply_to_receptor, build_plan


class PhysicsTransferTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        root = Path(self.temporary.name)
        self.receptor = root / "receptor" / "data"
        self.donor = root / "donor" / "data"
        self.output = root / "output"
        self.receptor.mkdir(parents=True)
        self.donor.mkdir(parents=True)
        (self.receptor / "car.ini").write_text("[INFO]\nSCREEN_NAME=RECEPTOR\n\n[BASIC]\nGRAPHICS_OFFSET=0,-0.30,0\nTOTALMASS=1000\nINERTIA=1,1,2\n\n[GRAPHICS]\nDRIVEREYES=0,1,0\n\n[CONTROLS]\nFFMULT=1.0\nSTEER_RATIO=-12\nLINEAR_STEER_ROD_RATIO=-0.00200\n\n[FUELTANK]\nPOSITION=0,0,0\n", encoding="utf-8")
        (self.receptor / "engine.ini").write_text("[ENGINE_DATA]\nLIMITER=7000\n", encoding="utf-8")
        (self.donor / "car.ini").write_text("[INFO]\nSCREEN_NAME=DONANTE\n\n[BASIC]\nGRAPHICS_OFFSET=0,-0.50,0\nTOTALMASS=1200\nINERTIA=2,2,4\n\n[GRAPHICS]\nDRIVEREYES=0,2,0\n\n[CONTROLS]\nFFMULT=1.8\nSTEER_RATIO=9\nLINEAR_STEER_ROD_RATIO=0.00150\n\n[FUEL]\nFUEL=30\nMAX_FUEL=60\n\n[FUELTANK]\nPOSITION=0,-0.2,0.3\n", encoding="utf-8")
        (self.donor / "engine.ini").write_text("[HEADER]\nPOWER_CURVE=power.lut\n", encoding="utf-8")
        (self.donor / "power.lut").write_text("1000|100\n7000|200\n", encoding="utf-8")
        (self.receptor / "tyres.ini").write_text("[FRONT]\nRADIUS=0.30\nRIM_RADIUS=0.20\nWIDTH=0.18\nDX_REF=1.0\n", encoding="utf-8")
        (self.donor / "tyres.ini").write_text("[FRONT]\nRADIUS=0.36\nRIM_RADIUS=0.24\nWIDTH=0.22\nDX_REF=1.7\n\n[FRONT_1]\nRADIUS=0.37\nRIM_RADIUS=0.25\nWIDTH=0.23\nDX_REF=1.8\n", encoding="utf-8")
        (self.receptor / "digital_instruments.ini").write_text("[RPM]\nOBJECT_NAME=LCD_ORIGINAL\n", encoding="utf-8")
        (self.donor / "digital_instruments.ini").write_text("[RPM]\nOBJECT_NAME=LCD_DONANTE\n", encoding="utf-8")
        (self.receptor / "suspensions.ini").write_text("[BASIC]\nWHEELBASE=2.50\nCG_LOCATION=0.50\n\n[ARB]\nFRONT=10000\nREAR=9000\n\n[FRONT]\nTYPE=DWB\nBASEY=-0.10\nTRACK=1.55\nSPRING_RATE=40000\nDAMP_BUMP=2500\n", encoding="utf-8")
        (self.donor / "suspensions.ini").write_text("[BASIC]\nWHEELBASE=2.80\nCG_LOCATION=0.57\n\n[ARB]\nFRONT=22000\nREAR=18000\n\n[FRONT]\nTYPE=STRUT\nBASEY=-0.20\nTRACK=1.70\nSPRING_RATE=65000\nDAMP_BUMP=4100\n", encoding="utf-8")
        (self.receptor / "setup.ini").write_text("[OLD]\nVALUE=1\n", encoding="utf-8")
        (self.donor / "setup.ini").write_text("[SPRING_RATE_LF]\nLUT=springs.lut\n", encoding="utf-8")
        (self.donor / "springs.lut").write_text("40|40000\n65|65000\n", encoding="utf-8")

    def tearDown(self):
        self.temporary.cleanup()

    def test_plan_only_includes_selected_physics_and_discovers_dependency(self):
        _, _, plan = build_plan(self.receptor, self.donor, {"motor"})
        actions = {item.file: item.action for item in plan}
        self.assertNotIn("car.ini", actions)
        self.assertEqual(actions["engine.ini"], "REEMPLAZAR")
        self.assertEqual(actions["power.lut"], "AGREGAR")

    def test_direct_apply_never_replaces_protected_car_ini(self):
        output_data, _ = apply_to_receptor(self.receptor, self.donor, {"motor"})
        self.assertIn("TOTALMASS=1000", (output_data / "car.ini").read_text(encoding="utf-8"))
        self.assertIn("POWER_CURVE", (output_data / "engine.ini").read_text(encoding="utf-8"))
        self.assertTrue((output_data / "power.lut").is_file())

    def test_empty_selection_transfers_nothing(self):
        _, _, plan = build_plan(self.receptor, self.donor, set())
        self.assertFalse(any(item.action in {"REEMPLAZAR", "AGREGAR", "FUSIONAR"} for item in plan))

    def test_direct_apply_merges_tyre_physics_and_preserves_visual_files(self):
        _, plan = apply_to_receptor(self.receptor, self.donor, {"neumaticos"})
        actions = {item.file: item.action for item in plan}
        tyres = (self.receptor / "tyres.ini").read_text(encoding="utf-8")
        instruments = (self.receptor / "digital_instruments.ini").read_text(encoding="utf-8")
        self.assertEqual(actions["tyres.ini"], "FUSIONAR")
        self.assertIn("RADIUS=0.30", tyres)
        self.assertIn("RIM_RADIUS=0.20", tyres)
        self.assertIn("WIDTH=0.18", tyres)
        self.assertIn("DX_REF=1.7", tyres)
        self.assertEqual(tyres.count("RADIUS=0.30"), 2)
        self.assertEqual(tyres.count("RIM_RADIUS=0.20"), 2)
        self.assertEqual(tyres.count("WIDTH=0.18"), 2)
        self.assertIn("DX_REF=1.8", tyres)
        self.assertIn("LCD_ORIGINAL", instruments)

    def test_suspension_behavior_is_merged_without_moving_geometry(self):
        _, plan = apply_to_receptor(self.receptor, self.donor, {"suspension", "setup"})
        actions = {item.file: item.action for item in plan}
        suspension = (self.receptor / "suspensions.ini").read_text(encoding="utf-8")
        setup = (self.receptor / "setup.ini").read_text(encoding="utf-8")
        self.assertEqual(actions["suspensions.ini"], "FUSIONAR")
        self.assertIn("WHEELBASE=2.50", suspension)
        self.assertIn("CG_LOCATION=0.50", suspension)
        self.assertIn("TYPE=DWB", suspension)
        self.assertIn("BASEY=-0.10", suspension)
        self.assertIn("TRACK=1.55", suspension)
        self.assertIn("SPRING_RATE=65000", suspension)
        self.assertIn("DAMP_BUMP=4100", suspension)
        self.assertIn("FRONT=22000", suspension)
        self.assertIn("REAR=18000", suspension)
        self.assertIn("LUT=springs.lut", setup)
        self.assertTrue((self.receptor / "springs.lut").is_file())

    def test_car_physics_are_merged_while_visual_alignment_is_preserved(self):
        _, plan = apply_to_receptor(self.receptor, self.donor, {"chasis"})
        actions = {item.file: item.action for item in plan}
        car = (self.receptor / "car.ini").read_text(encoding="utf-8")
        self.assertEqual(actions["car.ini"], "FUSIONAR")
        self.assertIn("SCREEN_NAME=RECEPTOR", car)
        self.assertIn("GRAPHICS_OFFSET=0,-0.30,0", car)
        self.assertIn("DRIVEREYES=0,1,0", car)
        self.assertIn("TOTALMASS=1200", car)
        self.assertIn("INERTIA=2,2,4", car)
        self.assertIn("FFMULT=1.8", car)
        self.assertIn("STEER_RATIO=-9.0", car)
        self.assertIn("LINEAR_STEER_ROD_RATIO=-0.00150", car)
        self.assertIn("FUEL=30", car)
        self.assertIn("MAX_FUEL=60", car)
        self.assertIn("POSITION=0,-0.2,0.3", car)


if __name__ == "__main__":
    unittest.main()
