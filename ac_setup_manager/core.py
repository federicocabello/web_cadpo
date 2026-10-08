from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path


SECTION_RE = re.compile(r"^\s*\[([^]]+)]\s*(?:;.*)?$")
VALUE_RE = re.compile(r"^\s*([^;=][^=]*?)\s*=\s*([^;]*?)(\s*;.*)?$")
REFERENCE_RE = re.compile(r"(?i)^(.+\.(?:lut|rto|ini))$")
SETUP_DISABLED_PREFIX = "; CADPO_SETUP_DISABLED "


@dataclass(frozen=True)
class ControlTemplate:
    section: str
    category: str
    title: str
    values: dict[str, str]


@dataclass(frozen=True)
class PhysicsBinding:
    filename: str
    section: str
    key: str
    display_factor: float = 1.0


def _format_number(value: float) -> str:
    return f"{value:.8f}".rstrip("0").rstrip(".") or "0"


def _read_ini(path: Path) -> tuple[str, str, bool, list[str]]:
    text = path.read_text(encoding="utf-8-sig", errors="replace")
    return ("\r\n" if "\r\n" in text else "\n", text, text.endswith(("\n", "\r")), text.splitlines())


def ini_sections(path: Path) -> dict[str, dict[str, str]]:
    if not path.is_file():
        return {}
    _newline, _text, _trailing, lines = _read_ini(path)
    result: dict[str, dict[str, str]] = {}
    current = ""
    for line in lines:
        header = SECTION_RE.match(line)
        if header:
            current = header.group(1).strip().upper()
            result.setdefault(current, {})
            continue
        value = VALUE_RE.match(line)
        if current and value:
            result[current][value.group(1).strip().upper()] = value.group(2).strip()
    return result


def physics_binding(section_name: str) -> PhysicsBinding | None:
    name = section_name.upper()
    if re.fullmatch(r"WING_\d+", name):
        return PhysicsBinding("aero.ini", name, "ANGLE")
    pressure = re.fullmatch(r"PRESSURE_[LR]([FR])", name)
    if pressure:
        return PhysicsBinding("tyres.ini", "FRONT" if pressure.group(1) == "F" else "REAR", "PRESSURE_STATIC")
    axle_value = re.fullmatch(r"(SPRING_RATE|DAMP_BUMP|DAMP_FAST_BUMP|DAMP_REBOUND|DAMP_FAST_REBOUND|BUMP_STOP_RATE)_[LR]([FR])", name)
    if axle_value:
        factor = 0.001 if axle_value.group(1) in {"SPRING_RATE", "BUMP_STOP_RATE"} else 1.0
        return PhysicsBinding("suspensions.ini", "FRONT" if axle_value.group(2) == "F" else "REAR", axle_value.group(1), factor)
    if name in {"ARB_FRONT", "ARB_REAR"}:
        return PhysicsBinding("suspensions.ini", "ARB", name.removeprefix("ARB_"))
    if name in {"DIFF_POWER", "DIFF_COAST"}:
        return PhysicsBinding("drivetrain.ini", "DIFFERENTIAL", name.removeprefix("DIFF_"), 100.0)
    if name == "DIFF_PRELOAD":
        return PhysicsBinding("drivetrain.ini", "DIFFERENTIAL", "PRELOAD")
    if name == "FRONT_BIAS":
        return PhysicsBinding("brakes.ini", "DATA", "FRONT_SHARE", 100.0)
    if name == "FUEL":
        return PhysicsBinding("car.ini", "FUEL", "FUEL")
    return None


def read_physics_default(data_folder: Path, setup_section: str) -> tuple[str, str]:
    binding = physics_binding(setup_section)
    if not binding:
        return "", "Este control no tiene una vinculación predeterminada segura."
    path = data_folder / binding.filename
    values = ini_sections(path).get(binding.section, {})
    raw = values.get(binding.key)
    source = f"{binding.filename} · [{binding.section}] {binding.key}"
    if raw is None:
        return "", f"No se encontró {source}."
    try:
        return _format_number(float(raw.replace(",", ".")) * binding.display_factor), source
    except ValueError:
        return raw, source


def write_physics_default(data_folder: Path, setup_section: str, display_value: str) -> Path:
    binding = physics_binding(setup_section)
    if not binding:
        raise ValueError(f"[{setup_section}] no tiene un valor físico predeterminado vinculado.")
    try:
        raw_value = float(display_value.replace(",", ".")) / binding.display_factor
    except ValueError as error:
        raise ValueError(f"El valor predeterminado de [{setup_section}] debe ser numérico.") from error
    path = data_folder / binding.filename
    if not path.is_file():
        raise ValueError(f"No se encontró {binding.filename}.")
    newline, _text, trailing, lines = _read_ini(path)
    current = ""
    replaced = False
    for index, line in enumerate(lines):
        header = SECTION_RE.match(line)
        if header:
            current = header.group(1).strip().upper()
            continue
        value = VALUE_RE.match(line)
        if current != binding.section or not value or value.group(1).strip().upper() != binding.key:
            continue
        comment = value.group(3) or ""
        lines[index] = f"{binding.key}={_format_number(raw_value)}{comment}"
        replaced = True
        break
    if not replaced:
        raise ValueError(f"No se encontró [{binding.section}] {binding.key} dentro de {binding.filename}.")
    rendered = newline.join(lines) + (newline if trailing else "")
    path.write_text(rendered, encoding="utf-8", newline="")
    return path


def discover_control_templates(data_folder: Path, existing_sections: set[str]) -> list[ControlTemplate]:
    existing = {name.upper() for name in existing_sections}
    templates: list[ControlTemplate] = []

    aero = ini_sections(data_folder / "aero.ini")
    for section, values in aero.items():
        if not re.fullmatch(r"WING_\d+", section) or section in existing or "ANGLE" not in values:
            continue
        physical_name = values.get("NAME", section).strip() or section
        try:
            default = float(values["ANGLE"].replace(",", "."))
        except ValueError:
            default = 0.0
        maximum = max(5.0, default * 2.0, default + 5.0)
        templates.append(ControlTemplate(section, "AERO", physical_name, {
            "SHOW_CLICKS": "0", "TAB": "AERO", "NAME": physical_name.title(),
            "MIN": "0", "MAX": _format_number(maximum), "STEP": "1",
            "POS_X": "0.5", "POS_Y": str(len(templates)), "HELP": "HELP_REAR_WING",
        }))

    common = (
        ("PRESSURE_LF", "TYRES", "Presión delantera izquierda", "10", "40", "1"),
        ("PRESSURE_RF", "TYRES", "Presión delantera derecha", "10", "40", "1"),
        ("PRESSURE_LR", "TYRES", "Presión trasera izquierda", "10", "40", "1"),
        ("PRESSURE_RR", "TYRES", "Presión trasera derecha", "10", "40", "1"),
        ("ARB_FRONT", "SUSPENSIONS", "Barra estabilizadora delantera", "0", "100000", "1000"),
        ("ARB_REAR", "SUSPENSIONS", "Barra estabilizadora trasera", "0", "100000", "1000"),
        ("SPRING_RATE_LF", "SUSPENSIONS", "Resorte delantero izquierdo", "20", "200", "5"),
        ("SPRING_RATE_RF", "SUSPENSIONS", "Resorte delantero derecho", "20", "200", "5"),
        ("SPRING_RATE_LR", "SUSPENSIONS", "Resorte trasero izquierdo", "20", "200", "5"),
        ("SPRING_RATE_RR", "SUSPENSIONS", "Resorte trasero derecho", "20", "200", "5"),
        ("DIFF_POWER", "DRIVETRAIN", "Diferencial en aceleración", "0", "100", "1"),
        ("DIFF_COAST", "DRIVETRAIN", "Diferencial en retención", "0", "100", "1"),
        ("DIFF_PRELOAD", "DRIVETRAIN", "Precarga del diferencial", "0", "200", "5"),
        ("FRONT_BIAS", "BRAKES", "Reparto de frenada", "45", "75", "1"),
        ("FUEL", "GENERIC", "Combustible", "0", "100", "1"),
    )
    for section, category, title, minimum, maximum, step in common:
        binding = physics_binding(section)
        if section in existing or not binding:
            continue
        if binding.key not in ini_sections(data_folder / binding.filename).get(binding.section, {}):
            continue
        templates.append(ControlTemplate(section, category, title, {
            "SHOW_CLICKS": "0", "TAB": category, "NAME": title,
            "MIN": minimum, "MAX": maximum, "STEP": step,
            "POS_X": "0.5", "POS_Y": "0",
        }))
    return sorted(templates, key=lambda item: (item.category, item.title, item.section))


@dataclass
class SetupSection:
    name: str
    start: int
    end: int
    values: dict[str, str] = field(default_factory=dict)
    enabled: bool = True

    @property
    def title(self) -> str:
        return self.values.get("NAME", self.name.replace("_", " ").title())

    @property
    def tab(self) -> str:
        return self.values.get("TAB", "GENERAL") or "GENERAL"

    @property
    def kind(self) -> str:
        if "RATIOS" in self.values or "VALUES" in self.values:
            return "Opciones por archivo"
        if any(key in self.values for key in ("MIN", "MAX", "STEP")):
            return "Rango numérico"
        if self.name == "GEARS" or self.name.startswith("GEAR_SET"):
            return "Transmisión"
        if self.name in {"DISPLAY_METHOD", "HEADER"}:
            return "Configuración"
        return "Sección especial"


class SetupDocument:
    def __init__(self, path: Path, text: str):
        self.path = path
        self.newline = "\r\n" if "\r\n" in text else "\n"
        self.trailing_newline = text.endswith(("\n", "\r"))
        self.lines = text.splitlines()
        self.sections = self._parse_sections()

    @classmethod
    def load(cls, folder: str | Path) -> "SetupDocument":
        data = normalize_data_folder(folder)
        path = data / "setup.ini"
        if not path.is_file():
            raise ValueError(f"No se encontró setup.ini dentro de {data}")
        return cls(path, path.read_text(encoding="utf-8-sig", errors="replace"))

    def _parse_sections(self) -> list[SetupSection]:
        headers: list[tuple[int, str, bool]] = []
        for index, line in enumerate(self.lines):
            match = SECTION_RE.match(line)
            if match:
                headers.append((index, match.group(1).strip(), True))
                continue
            stripped = line.lstrip()
            if stripped.startswith(SETUP_DISABLED_PREFIX):
                restored = stripped[len(SETUP_DISABLED_PREFIX):]
                disabled_match = SECTION_RE.match(restored)
                if disabled_match:
                    headers.append((index, disabled_match.group(1).strip(), False))
        sections: list[SetupSection] = []
        for position, (start, name, enabled) in enumerate(headers):
            end = headers[position + 1][0] if position + 1 < len(headers) else len(self.lines)
            values: dict[str, str] = {}
            for line in self.lines[start + 1:end]:
                normalized = line
                if not enabled and line.lstrip().startswith(SETUP_DISABLED_PREFIX):
                    prefix_index = line.index(SETUP_DISABLED_PREFIX)
                    normalized = line[:prefix_index] + line[prefix_index + len(SETUP_DISABLED_PREFIX):]
                match = VALUE_RE.match(normalized)
                if match:
                    values[match.group(1).strip().upper()] = match.group(2).strip()
            sections.append(SetupSection(name=name, start=start, end=end, values=values, enabled=enabled))
        return sections

    def section(self, name: str) -> SetupSection | None:
        wanted = name.upper()
        return next((section for section in self.sections if section.name.upper() == wanted), None)

    def render(
        self,
        edits: dict[str, dict[str, str]],
        deleted: set[str] | None = None,
        added: list[tuple[str, dict[str, str]]] | None = None,
        disabled: set[str] | None = None,
    ) -> str:
        deleted_upper = {name.upper() for name in (deleted or set())}
        disabled_upper = {name.upper() for name in (disabled or set())}
        output: list[str] = []
        cursor = 0
        for section in self.sections:
            output.extend(self.lines[cursor:section.start])
            cursor = section.end
            if section.name.upper() in deleted_upper:
                continue
            section_lines = []
            for line in self.lines[section.start:section.end]:
                if line.lstrip().startswith(SETUP_DISABLED_PREFIX):
                    prefix_index = line.index(SETUP_DISABLED_PREFIX)
                    line = line[:prefix_index] + line[prefix_index + len(SETUP_DISABLED_PREFIX):]
                section_lines.append(line)
            changes = {key.upper(): value for key, value in edits.get(section.name, {}).items()}
            seen: set[str] = set()
            rewritten: list[str] = [section_lines[0]]
            for line in section_lines[1:]:
                match = VALUE_RE.match(line)
                if not match:
                    rewritten.append(line)
                    continue
                key = match.group(1).strip().upper()
                if key not in changes:
                    rewritten.append(line)
                    continue
                seen.add(key)
                value = changes[key]
                if value == "":
                    continue
                comment = match.group(3) or ""
                rewritten.append(f"{key}={value}{comment}")
            missing = [(key, value) for key, value in changes.items() if key not in seen and value != ""]
            if missing:
                while rewritten and rewritten[-1].strip() == "":
                    rewritten.pop()
                rewritten.extend(f"{key}={value}" for key, value in missing)
                rewritten.append("")
            if section.name.upper() in disabled_upper:
                rewritten = [f"{SETUP_DISABLED_PREFIX}{line}" for line in rewritten]
            output.extend(rewritten)
        output.extend(self.lines[cursor:])
        for name, values in added or []:
            if output and output[-1].strip():
                output.append("")
            section_name = name.strip().upper()
            block = [f"[{section_name}]"]
            block.extend(f"{key.strip().upper()}={value}" for key, value in values.items() if value != "")
            block.append("")
            if section_name in disabled_upper:
                block = [f"{SETUP_DISABLED_PREFIX}{line}" for line in block]
            output.extend(block)
        text = self.newline.join(output)
        if self.trailing_newline or added:
            text += self.newline
        return text

    def save(self, edits: dict[str, dict[str, str]], deleted: set[str], added: list[tuple[str, dict[str, str]]], disabled: set[str] | None = None) -> None:
        self.path.write_text(self.render(edits, deleted, added, disabled), encoding="utf-8", newline="")

    def referenced_files(self, values: dict[str, str]) -> list[Path]:
        result: list[Path] = []
        for value in values.values():
            clean = value.split(";", 1)[0].strip().strip('"\'')
            if REFERENCE_RE.match(clean):
                result.append(self.path.parent / clean.replace("\\", "/"))
        return result


def normalize_data_folder(value: str | Path) -> Path:
    path = Path(value).expanduser().resolve()
    if path.name.lower() != "data" and (path / "data").is_dir():
        path = path / "data"
    if not path.is_dir():
        raise ValueError(f"No se encontró una carpeta data válida: {path}")
    return path


def validate_range(values: dict[str, str]) -> list[str]:
    warnings: list[str] = []
    present = [key for key in ("MIN", "MAX", "STEP") if values.get(key, "") != ""]
    if present and len(present) != 3:
        warnings.append("Un rango numérico debería tener MIN, MAX y STEP.")
        return warnings
    if len(present) != 3:
        return warnings
    try:
        minimum = float(values["MIN"].replace(",", "."))
        maximum = float(values["MAX"].replace(",", "."))
        step = float(values["STEP"].replace(",", "."))
    except ValueError:
        return ["MIN, MAX y STEP deben ser números."]
    if minimum > maximum:
        warnings.append("MIN no puede ser mayor que MAX.")
    if step <= 0:
        warnings.append("STEP debe ser mayor que cero.")
    elif maximum >= minimum:
        clicks = (maximum - minimum) / step
        if abs(clicks - round(clicks)) > 1e-7:
            warnings.append("El recorrido entre MIN y MAX no es divisible exactamente por STEP.")
    return warnings


def range_summary(values: dict[str, str]) -> str:
    try:
        minimum = float(values["MIN"].replace(",", "."))
        maximum = float(values["MAX"].replace(",", "."))
        step = float(values["STEP"].replace(",", "."))
        if step <= 0 or maximum < minimum:
            return "Rango inválido"
        count = int(round((maximum - minimum) / step)) + 1
        return f"{count} posiciones disponibles · desde {minimum:g} hasta {maximum:g} · paso {step:g}"
    except (KeyError, ValueError):
        return "Sin rango numérico completo"
