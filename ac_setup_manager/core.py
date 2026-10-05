from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path


SECTION_RE = re.compile(r"^\s*\[([^]]+)]\s*(?:;.*)?$")
VALUE_RE = re.compile(r"^\s*([^;=][^=]*?)\s*=\s*([^;]*?)(\s*;.*)?$")
REFERENCE_RE = re.compile(r"(?i)^(.+\.(?:lut|rto|ini))$")


@dataclass
class SetupSection:
    name: str
    start: int
    end: int
    values: dict[str, str] = field(default_factory=dict)

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
        headers: list[tuple[int, str]] = []
        for index, line in enumerate(self.lines):
            match = SECTION_RE.match(line)
            if match:
                headers.append((index, match.group(1).strip()))
        sections: list[SetupSection] = []
        for position, (start, name) in enumerate(headers):
            end = headers[position + 1][0] if position + 1 < len(headers) else len(self.lines)
            values: dict[str, str] = {}
            for line in self.lines[start + 1:end]:
                match = VALUE_RE.match(line)
                if match:
                    values[match.group(1).strip().upper()] = match.group(2).strip()
            sections.append(SetupSection(name=name, start=start, end=end, values=values))
        return sections

    def section(self, name: str) -> SetupSection | None:
        wanted = name.upper()
        return next((section for section in self.sections if section.name.upper() == wanted), None)

    def render(
        self,
        edits: dict[str, dict[str, str]],
        deleted: set[str] | None = None,
        added: list[tuple[str, dict[str, str]]] | None = None,
    ) -> str:
        deleted_upper = {name.upper() for name in (deleted or set())}
        output: list[str] = []
        cursor = 0
        for section in self.sections:
            output.extend(self.lines[cursor:section.start])
            cursor = section.end
            if section.name.upper() in deleted_upper:
                continue
            section_lines = self.lines[section.start:section.end]
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
            output.extend(rewritten)
        output.extend(self.lines[cursor:])
        for name, values in added or []:
            if output and output[-1].strip():
                output.append("")
            output.append(f"[{name.strip().upper()}]")
            output.extend(f"{key.strip().upper()}={value}" for key, value in values.items() if value != "")
            output.append("")
        text = self.newline.join(output)
        if self.trailing_newline or added:
            text += self.newline
        return text

    def save(self, edits: dict[str, dict[str, str]], deleted: set[str], added: list[tuple[str, dict[str, str]]]) -> None:
        self.path.write_text(self.render(edits, deleted, added), encoding="utf-8", newline="")

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
