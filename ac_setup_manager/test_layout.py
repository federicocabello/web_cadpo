import unittest

from layout_dialog import translated_control, translated_tab


class SetupLayoutTranslationTests(unittest.TestCase):
    def test_translates_tabs_without_losing_technical_name(self):
        self.assertEqual(translated_tab("TYRES"), "NEUMÁTICOS  [TYRES]")
        self.assertEqual(translated_tab("GENERAL"), "GENERAL")

    def test_translates_common_controls(self):
        self.assertEqual(translated_control("PRESSURE_LF", "Pressure LF"), "Presión · rueda delantera izquierda")
        self.assertEqual(translated_control("DIFF_COAST", "Diff Coast"), "Diferencial en retención")


if __name__ == "__main__":
    unittest.main()
