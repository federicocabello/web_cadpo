from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from core import SECTION_RE, VALUE_RE, ini_sections


DISABLED_PREFIX = "; CADPO_DISABLED "


@dataclass(frozen=True)
class ModuleDefinition:
    id: str
    title: str
    category: str
    description: str
    mode: str
    filename: str = ""
    section_patterns: tuple[str, ...] = ()
    extra_globs: tuple[str, ...] = ()


@dataclass
class VehicleModule:
    definition: ModuleDefinition
    detected: bool
    enabled: bool
    custom: bool
    files: list[Path]
    detail: str


MODULE_DEFINITIONS = (
    ModuleDefinition(
        "turbo", "Turbo / sobrealimentación", "MOTOR",
        "Turbos TURBO_n, presión, wastegate, lag, referencia de RPM y controladores de boost.",
        "sections", "engine.ini", (r"TURBO_\d+",), ("ctrl_turbo*.ini",),
    ),
    ModuleDefinition(
        "engine_maps", "Mapas de motor", "MOTOR",
        "Mapas de entrega de potencia declarados en engine.ini.",
        "sections", "engine.ini", (r"MAP",),
    ),
    ModuleDefinition(
        "abs", "ABS", "ELECTRÓNICA",
        "Sistema antibloqueo de frenos, estado inicial, frecuencia y límite de deslizamiento.",
        "sections", "electronics.ini", (r"ABS", r"ABS_V2"),
    ),
    ModuleDefinition(
        "tc", "Control de tracción", "ELECTRÓNICA",
        "Control de tracción, curvas, velocidad mínima y límites de intervención.",
        "sections", "electronics.ini", (r"TC", r"TRACTION_CONTROL"), ("ctrl_tc*.ini",),
    ),
    ModuleDefinition(
        "edl", "Diferencial electrónico EDL", "ELECTRÓNICA",
        "Bloqueo electrónico mediante frenos para tracción y retención.",
        "sections", "electronics.ini", (r"EDL",),
    ),
    ModuleDefinition(
        "drs_electronics", "DRS electrónico", "AERODINÁMICA",
        "Interruptor DRS declarado en electronics.ini.",
        "sections", "electronics.ini", (r"DRS",),
    ),
    ModuleDefinition(
        "drs", "DRS aerodinámico", "AERODINÁMICA",
        "Ranuras DRS, ala controlada, zonas, activaciones y cierre por freno o acelerador.",
        "files", "drs.ini",
    ),
    ModuleDefinition(
        "ers", "ERS / KERS híbrido", "ENERGÍA",
        "Recuperación cinética, entrega, energía por vuelta, MGU-H y controladores ERS.",
        "files", "ers.ini", extra_globs=("ctrl_ers_*.ini", "ctrl_kers*.ini"),
    ),
    ModuleDefinition(
        "awd", "Tracción integral controlada", "TRANSMISIÓN",
        "Controladores de reparto AWD y diferencial central.",
        "files", extra_globs=("ctrl_awd*.ini",),
    ),
    ModuleDefinition(
        "four_wheel_steer", "Dirección en las cuatro ruedas", "SUSPENSIÓN",
        "Controladores 4WS/HICAS para el eje trasero direccional.",
        "files", extra_globs=("ctrl_4ws*.ini",),
    ),
    ModuleDefinition(
        "electronic_brake_bias", "Reparto electrónico de frenada", "FRENOS",
        "Controladores EBB para modificar dinámicamente el reparto de frenada.",
        "files", extra_globs=("ctrl_ebb*.ini",),
    ),
    ModuleDefinition(
        "brake_temperature", "Temperatura avanzada de frenos", "FRENOS",
        "Modelo térmico de discos y pastillas, refrigeración y curvas de rendimiento.",
        "files", "brakes_temp.ini",
    ),
    ModuleDefinition(
        "fuel_consumption", "Consumo avanzado de combustible", "MOTOR",
        "Modelo adicional de consumo de combustible cuando está declarado por el mod.",
        "files", "fuel_cons.ini",
    ),
    ModuleDefinition(
        "flames", "Llamas y backfire", "EFECTOS",
        "Efectos de llama del escape y sus condiciones de activación.",
        "files", "flames.ini", extra_globs=("flame_presets.ini",),
    ),
    ModuleDefinition(
        "damage", "Daños del vehículo", "EFECTOS",
        "Parámetros de daño, sensibilidad, ganancias y comportamiento de impacto.",
        "files", "damage.ini",
    ),
    ModuleDefinition(
        "active_aero", "Controladores aerodinámicos", "AERODINÁMICA",
        "Controladores de alas o superficies aerodinámicas activas.",
        "files", extra_globs=("ctrl_wing*.ini", "ctrl_aero*.ini"),
    ),
)


def _read_lines(path: Path) -> tuple[str, bool, list[str]]:
    text = path.read_text(encoding="utf-8-sig", errors="replace")
    return ("\r\n" if "\r\n" in text else "\n", text.endswith(("\n", "\r")), text.splitlines())


def _write_lines(path: Path, newline: str, trailing: bool, lines: list[str]) -> None:
    path.write_text(newline.join(lines) + (newline if trailing else ""), encoding="utf-8", newline="")


def _disabled_header(line: str) -> str | None:
    if not line.lstrip().startswith(DISABLED_PREFIX):
        return None
    restored = line[line.index(DISABLED_PREFIX) + len(DISABLED_PREFIX):]
    match = SECTION_RE.match(restored)
    return match.group(1).strip().upper() if match else None


def section_states(path: Path) -> dict[str, bool]:
    if not path.is_file():
        return {}
    _newline, _trailing, lines = _read_lines(path)
    states: dict[str, bool] = {}
    for line in lines:
        match = SECTION_RE.match(line)
        if match:
            states[match.group(1).strip().upper()] = True
            continue
        disabled = _disabled_header(line)
        if disabled:
            states[disabled] = False
    return states


def _matches(name: str, patterns: tuple[str, ...]) -> bool:
    return any(re.fullmatch(pattern, name, flags=re.IGNORECASE) for pattern in patterns)


def set_sections_enabled(path: Path, patterns: tuple[str, ...], enabled: bool) -> None:
    newline, trailing, lines = _read_lines(path)
    inside_target = False
    found = False
    output: list[str] = []
    for line in lines:
        active_header = SECTION_RE.match(line)
        disabled_name = _disabled_header(line)
        header_name = active_header.group(1).strip().upper() if active_header else disabled_name
        if header_name is not None:
            inside_target = _matches(header_name, patterns)
            found = found or inside_target
        if inside_target:
            if enabled and line.lstrip().startswith(DISABLED_PREFIX):
                prefix_index = line.index(DISABLED_PREFIX)
                output.append(line[:prefix_index] + line[prefix_index + len(DISABLED_PREFIX):])
            elif not enabled and not line.lstrip().startswith(DISABLED_PREFIX):
                output.append(f"{DISABLED_PREFIX}{line}")
            else:
                output.append(line)
        else:
            output.append(line)
    if not found:
        raise ValueError("No se encontraron las secciones del módulo.")
    _write_lines(path, newline, trailing, output)


def _module_files(data_folder: Path, definition: ModuleDefinition, include_disabled: bool = True) -> list[Path]:
    files: list[Path] = []
    if definition.filename:
        main = data_folder / definition.filename
        disabled = data_folder / f"{definition.filename}.disabled"
        if main.is_file():
            files.append(main)
        elif include_disabled and disabled.is_file():
            files.append(disabled)
    for pattern in definition.extra_globs:
        files.extend(sorted(data_folder.glob(pattern)))
        if include_disabled:
            files.extend(sorted(data_folder.glob(f"{pattern}.disabled")))
    return list(dict.fromkeys(files))


def scan_vehicle_modules(data_folder: Path) -> list[VehicleModule]:
    modules: list[VehicleModule] = []
    for definition in MODULE_DEFINITIONS:
        files = _module_files(data_folder, definition)
        if definition.mode == "sections":
            main = data_folder / definition.filename
            states = section_states(main)
            matching = {name: active for name, active in states.items() if _matches(name, definition.section_patterns)}
            detected = bool(matching)
            enabled = any(matching.values())
            detail = ", ".join(f"[{name}]" for name in matching) if matching else "No detectado"
        else:
            main = data_folder / definition.filename
            disabled = data_folder / f"{definition.filename}.disabled"
            detected = bool(files)
            enabled = any(not path.name.lower().endswith(".disabled") for path in files)
            detail = ", ".join(path.name for path in files) if detected else "No detectado"
        modules.append(VehicleModule(definition, detected, enabled, False, files, detail))

    custom_sources = [
        data_folder / "script.lua",
        data_folder / "digital_panels.ini",
        data_folder.parent / "extension" / "ext_car_controls.ini",
        data_folder.parent / "extension" / "ext_config.ini",
    ]
    signatures = {
        "push_to_pass": ("Push-to-pass / P2P", re.compile(r"PUSH\s*2?\s*PASS|\bP2P\b", re.I)),
        "custom_kers": ("KERS/ERS personalizado por CSP", re.compile(r"\bKERS\b|\bERS\b", re.I)),
        "custom_drs": ("DRS personalizado por CSP", re.compile(r"\bDRS\b", re.I)),
        "launch_control": ("Launch control personalizado", re.compile(r"LAUNCH[_ ]?CONTROL|START[_ ]?ECU", re.I)),
        "nitrous": ("Nitro / overboost personalizado", re.compile(r"NITROUS|\bN2O\b|\bNOS\b|OVERBOOST", re.I)),
        "physics_script": ("Script de física CSP", re.compile(r"function\s+script\.", re.I)),
    }
    for module_id, (title, signature) in signatures.items():
        matches = []
        for path in custom_sources:
            if path.is_file() and signature.search(path.read_text(encoding="utf-8-sig", errors="replace")):
                matches.append(path)
        if matches:
            modules.append(VehicleModule(
                ModuleDefinition(module_id, title, "CSP / PERSONALIZADO", "Sistema personalizado detectado. Se permite inspeccionarlo, pero no se desactiva automáticamente para evitar romper otras funciones del script.", "custom"),
                True, True, True, matches, ", ".join(path.name for path in matches),
            ))
    return modules


def set_module_enabled(data_folder: Path, module: VehicleModule, enabled: bool) -> None:
    definition = module.definition
    if module.custom:
        raise ValueError("Este módulo usa una implementación personalizada y no puede desactivarse de forma automática.")
    if definition.mode == "sections":
        set_sections_enabled(data_folder / definition.filename, definition.section_patterns, enabled)
        return
    main = data_folder / definition.filename if definition.filename else None
    disabled = data_folder / f"{definition.filename}.disabled" if definition.filename else None
    if enabled and disabled and disabled.is_file():
        disabled.rename(main)
    elif not enabled and main and main.is_file():
        main.rename(disabled)
    for pattern in definition.extra_globs:
        if enabled:
            for path in data_folder.glob(f"{pattern}.disabled"):
                path.rename(path.with_name(path.name.removesuffix(".disabled")))
        else:
            for path in data_folder.glob(pattern):
                path.rename(path.with_name(f"{path.name}.disabled"))


def module_parameter_files(data_folder: Path, module: VehicleModule) -> list[Path]:
    if module.custom:
        return module.files
    return _module_files(data_folder, module.definition)


def update_ini_value(path: Path, section: str, key: str, value: str) -> None:
    newline, trailing, lines = _read_lines(path)
    current = ""
    replaced = False
    for index, line in enumerate(lines):
        header = SECTION_RE.match(line)
        if header:
            current = header.group(1).strip().upper()
            continue
        match = VALUE_RE.match(line)
        if current != section.upper() or not match or match.group(1).strip().upper() != key.upper():
            continue
        lines[index] = f"{key.upper()}={value}{match.group(3) or ''}"
        replaced = True
        break
    if not replaced:
        raise ValueError(f"No se encontró [{section}] {key} en {path.name}.")
    _write_lines(path, newline, trailing, lines)


def parameters_for_file(path: Path) -> dict[str, dict[str, str]]:
    if path.suffix.lower() == ".lua" or path.name.lower().endswith(".disabled"):
        return {}
    return ini_sections(path)
