from __future__ import annotations

import hashlib
import re
import shutil
from dataclasses import dataclass
from pathlib import Path


GROUPS = {
    "chasis": {
        "label": "Chasis, masa y combustible",
        "files": {"car.ini"},
        "description": "Masa, inercias, FFB, dirección, combustible y posición del tanque.",
    },
    "motor": {
        "label": "Motor y entrega de potencia",
        "files": {"engine.ini", "turbo.ini", "fuel_cons.ini"},
        "description": "Curva de potencia, limitador, inercia, turbo y consumo.",
    },
    "transmision": {
        "label": "Transmisión y diferencial",
        "files": {"drivetrain.ini"},
        "description": "Tracción, marchas, diferencial, embrague y tiempos de cambio.",
    },
    "frenos": {
        "label": "Frenos",
        "files": {"brakes.ini", "brakes_temp.ini"},
        "description": "Potencia, reparto y comportamiento térmico de los frenos.",
    },
    "aerodinamica": {
        "label": "Aerodinámica",
        "files": {"aero.ini", "drs.ini"},
        "description": "Carga, resistencia, alas y DRS. Puede requerir ajuste por dimensiones.",
    },
    "neumaticos": {
        "label": "Neumáticos",
        "files": {"tyres.ini"},
        "description": "Compuestos, agarre, temperatura y desgaste, conservando las dimensiones del receptor.",
    },
    "suspension": {
        "label": "Suspensión",
        "files": {"suspensions.ini"},
        "description": "Resortes, amortiguadores, barras y topes, conservando la geometría del receptor.",
    },
    "setup": {
        "label": "Opciones de setup",
        "files": {"setup.ini"},
        "description": "Opciones configurables del donante y sus archivos LUT/RTO.",
    },
    "electronica": {
        "label": "Electrónica e híbridos",
        "files": {"electronics.ini", "ers.ini", "kers.ini"},
        "description": "ABS, control de tracción, ERS, KERS y controladores asociados.",
    },
    "ia_danos": {
        "label": "IA y daños",
        "files": {"ai.ini", "damage.ini"},
        "description": "Parámetros de conducción de IA y tolerancias de daño.",
    },
}

# Estos archivos contienen geometría, dimensiones o referencias al modelo receptor.
# En esta primera versión nunca se reemplazan automáticamente.
PROTECTED_FILES = {
    "suspension_graphics.ini": "Controla la representación visual de ruedas y suspensión.",
    "colliders.ini": "Los colisionadores deben coincidir con la carrocería receptora.",
    "lods.ini": "Referencia los modelos 3D del auto receptor.",
    "cameras.ini": "Las posiciones de cámara dependen del habitáculo receptor.",
    "driver3d.ini": "La posición del piloto depende del modelo receptor.",
    "lights.ini": "Referencia objetos del modelo 3D receptor.",
    "mirrors.ini": "Referencia espejos y posiciones del modelo receptor.",
    "flames.ini": "Referencia la posición visual de los escapes del receptor.",
    "flame_presets.ini": "Configuración visual de las llamas del receptor.",
    "digital_instruments.ini": "Instrumentos y tacómetro del habitáculo receptor.",
    "analog_instruments.ini": "Instrumentos y agujas del habitáculo receptor.",
    "sounds.ini": "Referencias de audio propias del mod receptor.",
    "ambient_shadows.ini": "Sombras vinculadas a la geometría del receptor.",
    "blurred_objects.ini": "Objetos gráficos animados del receptor.",
    "wing_animations.ini": "Animaciones visuales del modelo receptor.",
    "extra_animations.ini": "Animaciones visuales adicionales del receptor.",
    "dash_cam.ini": "Posición de cámara del habitáculo receptor.",
}

HYBRID_FILES = {
    "tyres.ini": {
        "RADIUS",
        "RIM_RADIUS",
        "WIDTH",
    },
}

SUSPENSION_BEHAVIOR_KEYS = {
    "SPRING_RATE",
    "PROGRESSIVE_SPRING_RATE",
    "BUMP_STOP_RATE",
    "BUMPSTOP_RATE",
    "BUMP_STOP_UP",
    "BUMP_STOP_DN",
    "PACKER_RANGE",
    "DAMP_BUMP",
    "DAMP_FAST_BUMP",
    "DAMP_FAST_BUMPTHRESHOLD",
    "DAMP_REBOUND",
    "DAMP_FAST_REBOUND",
    "DAMP_FAST_REBOUNDTHRESHOLD",
    "HUB_MASS",
}

TARGET_PATCH_FILES = {"suspensions.ini"}

CAR_FULL_PHYSICS_SECTIONS = {
    "CONTROLS",
    "FUEL",
    "FUEL_EXT",
    "FUELTANK",
    "RULES",
    "PIT_STOP",
    "EXPLICIT_INERTIA",
}

CAR_BASIC_VISUAL_KEYS = {
    "GRAPHICS_OFFSET",
    "GRAPHICS_PITCH_ROTATION",
}

STEERING_ORIENTATION_KEYS = {
    "STEER_RATIO",
    "LINEAR_STEER_ROD_RATIO",
}

REFERENCE_PATTERN = re.compile(
    r"(?i)([a-z0-9_./\\-]+\.(?:lut|rto|ini))"
)


@dataclass(frozen=True)
class PlanItem:
    file: str
    action: str
    group: str
    reason: str
    source_exists: bool
    target_exists: bool
    different: bool


def normalize_data_folder(value: str | Path) -> Path:
    path = Path(value).expanduser().resolve()
    if path.name.lower() != "data" and (path / "data").is_dir():
        path = path / "data"
    if not path.is_dir():
        raise ValueError(f"No se encontró una carpeta válida: {path}")
    return path


def list_files(folder: Path) -> dict[str, Path]:
    return {
        file.relative_to(folder).as_posix().lower(): file
        for file in folder.rglob("*")
        if file.is_file()
    }


def file_digest(path: Path | None) -> str:
    if path is None or not path.is_file():
        return ""
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def read_references(path: Path) -> set[str]:
    if path.suffix.lower() != ".ini":
        return set()
    try:
        text = path.read_text(encoding="utf-8-sig", errors="ignore")
    except OSError:
        return set()
    references = set()
    for raw_line in text.splitlines():
        line = raw_line.split(";", 1)[0]
        for match in REFERENCE_PATTERN.finditer(line):
            references.add(match.group(1).replace("\\", "/").lower())
    return references


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig", errors="ignore")


def ini_values(text: str, keys: set[str]) -> dict[tuple[str, str], str]:
    section = ""
    values: dict[tuple[str, str], str] = {}
    for raw_line in text.splitlines():
        stripped = raw_line.strip()
        if stripped.startswith("[") and "]" in stripped:
            section = stripped[1:stripped.index("]")].strip().upper()
            continue
        if not stripped or stripped.startswith(";") or "=" not in raw_line:
            continue
        key, value = raw_line.split("=", 1)
        normalized_key = key.strip().upper()
        if normalized_key in keys:
            values[(section, normalized_key)] = value.split(";", 1)[0].strip()
    return values


def tyre_axle(section: str) -> str:
    normalized = section.upper()
    if normalized == "FRONT" or normalized.startswith("FRONT_"):
        return "FRONT"
    if normalized == "REAR" or normalized.startswith("REAR_"):
        return "REAR"
    return ""


def preserved_hybrid_value(
    filename: str,
    section: str,
    key: str,
    receptor_values: dict[tuple[str, str], str],
) -> str | None:
    exact = receptor_values.get((section, key))
    if exact is not None or filename != "tyres.ini":
        return exact
    axle = tyre_axle(section)
    if not axle:
        return None
    base_value = receptor_values.get((axle, key))
    if base_value is not None:
        return base_value
    for (candidate_section, candidate_key), value in receptor_values.items():
        if candidate_key == key and tyre_axle(candidate_section) == axle:
            return value
    return None


def should_patch_suspension_value(section: str, key: str) -> bool:
    normalized_section = section.upper()
    normalized_key = key.upper()
    if normalized_section == "ARB":
        return normalized_key in {"FRONT", "REAR"}
    return normalized_section in {"FRONT", "REAR", "HEAVE_FRONT", "HEAVE_REAR"} and normalized_key in SUSPENSION_BEHAVIOR_KEYS


def merge_suspension_behavior(receptor: Path, donor: Path) -> str:
    receptor_text = read_text(receptor)
    donor_text = read_text(donor)
    donor_sections = parse_ini_raw_values(donor_text)
    current_section = ""
    output: list[str] = []
    for raw_line in receptor_text.splitlines():
        stripped = raw_line.strip()
        if stripped.startswith("[") and "]" in stripped:
            current_section = stripped[1:stripped.index("]")].strip().upper()
            output.append(raw_line)
            continue
        if not stripped or stripped.startswith(";") or "=" not in raw_line:
            output.append(raw_line)
            continue
        key, value = raw_line.split("=", 1)
        normalized_key = key.strip().upper()
        if not should_patch_suspension_value(current_section, normalized_key):
            output.append(raw_line)
            continue
        donor_value = donor_sections.get((current_section, normalized_key))
        if donor_value is None:
            output.append(raw_line)
            continue
        comment = f" ;{value.split(';', 1)[1]}" if ";" in value else ""
        output.append(f"{key.rstrip()}={donor_value}{comment}")
    newline = "\r\n" if "\r\n" in receptor_text else "\n"
    return newline.join(output) + (newline if receptor_text.endswith(("\n", "\r")) else "")


def parse_ini_raw_values(text: str) -> dict[tuple[str, str], str]:
    section = ""
    values: dict[tuple[str, str], str] = {}
    for raw_line in text.splitlines():
        stripped = raw_line.strip()
        if stripped.startswith("[") and "]" in stripped:
            section = stripped[1:stripped.index("]")].strip().upper()
            continue
        if not stripped or stripped.startswith(";") or "=" not in raw_line:
            continue
        key, value = raw_line.split("=", 1)
        values[(section, key.strip().upper())] = value.split(";", 1)[0].strip()
    return values


def split_ini_document(text: str) -> tuple[list[str], list[tuple[str, list[str]]]]:
    prefix: list[str] = []
    sections: list[tuple[str, list[str]]] = []
    current_name = ""
    current_lines: list[str] = []
    for raw_line in text.splitlines():
        stripped = raw_line.strip()
        if stripped.startswith("[") and "]" in stripped:
            if current_name:
                sections.append((current_name, current_lines))
            elif current_lines:
                prefix.extend(current_lines)
            current_name = stripped[1:stripped.index("]")].strip().upper()
            current_lines = [raw_line]
        else:
            current_lines.append(raw_line)
    if current_name:
        sections.append((current_name, current_lines))
    elif current_lines:
        prefix.extend(current_lines)
    return prefix, sections


def merge_basic_car_section(receptor_lines: list[str], donor_lines: list[str]) -> list[str]:
    donor_values: dict[str, str] = {}
    donor_order: list[str] = []
    for raw_line in donor_lines[1:]:
        stripped = raw_line.strip()
        if not stripped or stripped.startswith(";") or "=" not in raw_line:
            continue
        key = raw_line.split("=", 1)[0].strip().upper()
        if key in CAR_BASIC_VISUAL_KEYS:
            continue
        donor_values[key] = raw_line
        donor_order.append(key)

    output = [receptor_lines[0]]
    used: set[str] = set()
    for raw_line in receptor_lines[1:]:
        stripped = raw_line.strip()
        if not stripped or stripped.startswith(";") or "=" not in raw_line:
            output.append(raw_line)
            continue
        key = raw_line.split("=", 1)[0].strip().upper()
        if key in donor_values and key not in CAR_BASIC_VISUAL_KEYS:
            donor_value = donor_values[key].split("=", 1)[1].split(";", 1)[0].strip()
            target_key, target_value = raw_line.split("=", 1)
            comment = f" ;{target_value.split(';', 1)[1]}" if ";" in target_value else ""
            output.append(f"{target_key.rstrip()}={donor_value}{comment}")
            used.add(key)
        else:
            output.append(raw_line)
    for key in donor_order:
        if key not in used and not any(
            line.split("=", 1)[0].strip().upper() == key
            for line in receptor_lines[1:]
            if "=" in line and not line.strip().startswith(";")
        ):
            output.append(donor_values[key])
    return output


def raw_section_values(lines: list[str]) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in lines[1:]:
        stripped = raw_line.strip()
        if not stripped or stripped.startswith(";") or "=" not in raw_line:
            continue
        key, value = raw_line.split("=", 1)
        values[key.strip().upper()] = value.split(";", 1)[0].strip()
    return values


def number_with_receptor_sign(donor_value: str, receptor_value: str) -> str:
    try:
        donor_number = float(donor_value.replace(",", "."))
        receptor_number = float(receptor_value.replace(",", "."))
    except ValueError:
        return receptor_value
    magnitude = abs(donor_number)
    signed = -magnitude if receptor_number < 0 else magnitude
    decimals = len(donor_value.split(".", 1)[1]) if "." in donor_value else 1
    return f"{signed:.{decimals}f}"


def merge_controls_section(receptor_lines: list[str], donor_lines: list[str]) -> list[str]:
    receptor_values = raw_section_values(receptor_lines)
    donor_keys: set[str] = set()
    output = [donor_lines[0]]
    for raw_line in donor_lines[1:]:
        stripped = raw_line.strip()
        if not stripped or stripped.startswith(";") or "=" not in raw_line:
            output.append(raw_line)
            continue
        key, value = raw_line.split("=", 1)
        normalized_key = key.strip().upper()
        donor_keys.add(normalized_key)
        if normalized_key not in STEERING_ORIENTATION_KEYS or normalized_key not in receptor_values:
            output.append(raw_line)
            continue
        donor_value = value.split(";", 1)[0].strip()
        merged_value = number_with_receptor_sign(donor_value, receptor_values[normalized_key])
        comment = f" ;{value.split(';', 1)[1]}" if ";" in value else ""
        output.append(f"{key.rstrip()}={merged_value}{comment}")
    for raw_line in receptor_lines[1:]:
        if "=" not in raw_line or raw_line.strip().startswith(";"):
            continue
        normalized_key = raw_line.split("=", 1)[0].strip().upper()
        if normalized_key in STEERING_ORIENTATION_KEYS and normalized_key not in donor_keys:
            output.append(raw_line)
    return output


def merge_car_behavior(receptor: Path, donor: Path) -> str:
    receptor_text = read_text(receptor)
    donor_text = read_text(donor)
    receptor_prefix, receptor_sections = split_ini_document(receptor_text)
    _, donor_sections_list = split_ini_document(donor_text)
    donor_sections = {name: lines for name, lines in donor_sections_list}
    output = list(receptor_prefix)
    consumed: set[str] = set()

    for section_name, receptor_lines in receptor_sections:
        donor_lines = donor_sections.get(section_name)
        if section_name == "BASIC" and donor_lines:
            output.extend(merge_basic_car_section(receptor_lines, donor_lines))
            consumed.add(section_name)
        elif section_name == "CONTROLS" and donor_lines:
            output.extend(merge_controls_section(receptor_lines, donor_lines))
            consumed.add(section_name)
        elif section_name in CAR_FULL_PHYSICS_SECTIONS and donor_lines:
            output.extend(donor_lines)
            consumed.add(section_name)
        elif section_name == "EXPLICIT_INERTIA" and not donor_lines:
            # Evita que una inercia explícita vieja anule la INERTIA del BASIC donante.
            continue
        else:
            output.extend(receptor_lines)

    for section_name, donor_lines in donor_sections_list:
        if section_name in CAR_FULL_PHYSICS_SECTIONS and section_name not in consumed:
            output.extend(donor_lines)

    newline = "\r\n" if "\r\n" in receptor_text else "\n"
    return newline.join(output) + (newline if receptor_text.endswith(("\n", "\r")) else "")


def merge_hybrid_file(receptor: Path, donor: Path) -> str:
    filename = donor.name.lower()
    if filename == "car.ini":
        return merge_car_behavior(receptor, donor)
    if filename == "suspensions.ini":
        return merge_suspension_behavior(receptor, donor)
    protected_keys = HYBRID_FILES.get(filename, set())
    donor_text = read_text(donor)
    if not protected_keys or not receptor.is_file():
        return donor_text
    receptor_values = ini_values(read_text(receptor), protected_keys)
    section = ""
    output: list[str] = []
    for raw_line in donor_text.splitlines():
        stripped = raw_line.strip()
        if stripped.startswith("[") and "]" in stripped:
            section = stripped[1:stripped.index("]")].strip().upper()
            output.append(raw_line)
            continue
        if not stripped or stripped.startswith(";") or "=" not in raw_line:
            output.append(raw_line)
            continue
        key, value = raw_line.split("=", 1)
        normalized_key = key.strip().upper()
        preserved = preserved_hybrid_value(filename, section, normalized_key, receptor_values)
        if preserved is None:
            output.append(raw_line)
            continue
        comment = f" ;{value.split(';', 1)[1]}" if ";" in value else ""
        output.append(f"{key.rstrip()}={preserved}{comment}")
    newline = "\r\n" if "\r\n" in donor_text else "\n"
    return newline.join(output) + (newline if donor_text.endswith(("\n", "\r")) else "")


def resolve_reference(reference: str, files: dict[str, Path]) -> str | None:
    normalized = reference.lstrip("./").lower()
    if normalized in files:
        return normalized
    basename = Path(normalized).name.lower()
    matches = [relative for relative in files if Path(relative).name.lower() == basename]
    return matches[0] if len(matches) == 1 else None


def selected_roots(donor_files: dict[str, Path], selected_groups: set[str]) -> dict[str, str]:
    roots: dict[str, str] = {}
    for group_key in selected_groups:
        group = GROUPS.get(group_key)
        if not group:
            continue
        names = group["files"]
        for relative in donor_files:
            basename = Path(relative).name.lower()
            if basename in names or (group_key == "electronica" and basename.startswith("ctrl_") and basename.endswith(".ini")):
                roots[relative] = group_key
    return roots


def collect_dependencies(
    donor_files: dict[str, Path], roots: dict[str, str]
) -> dict[str, str]:
    selected = dict(roots)
    queue = list(roots)
    while queue:
        relative = queue.pop(0)
        group_key = selected[relative]
        for reference in read_references(donor_files[relative]):
            resolved = resolve_reference(reference, donor_files)
            if not resolved or resolved in selected:
                continue
            if Path(resolved).name.lower() in PROTECTED_FILES:
                continue
            selected[resolved] = group_key
            queue.append(resolved)
    return selected


def build_plan(
    receptor_value: str | Path,
    donor_value: str | Path,
    selected_groups: set[str] | None = None,
) -> tuple[Path, Path, list[PlanItem]]:
    receptor = normalize_data_folder(receptor_value)
    donor = normalize_data_folder(donor_value)
    selected_groups = set(GROUPS) if selected_groups is None else selected_groups
    receptor_files = list_files(receptor)
    donor_files = list_files(donor)
    selected = collect_dependencies(donor_files, selected_roots(donor_files, selected_groups))
    items: list[PlanItem] = []

    for relative, group_key in sorted(selected.items()):
        donor_path = donor_files[relative]
        receptor_path = receptor_files.get(relative)
        is_hybrid = Path(relative).name.lower() in {*HYBRID_FILES, *TARGET_PATCH_FILES, "car.ini"} and bool(receptor_path)
        items.append(PlanItem(
            file=relative,
            action="FUSIONAR" if is_hybrid else ("REEMPLAZAR" if receptor_path else "AGREGAR"),
            group=str(GROUPS[group_key]["label"]),
            reason=(
                ("Masa, inercias, FFB y combustible del donante; datos visuales del receptor" if Path(relative).name.lower() == "car.ini" else ("Comportamiento del donante; geometría y posición conservadas del receptor" if Path(relative).name.lower() == "suspensions.ini" else "Física del donante; dimensiones de rueda conservadas del receptor"))
                if is_hybrid
                else ("Archivo principal" if relative in selected_roots(donor_files, {group_key}) else "Dependencia detectada automáticamente")
            ),
            source_exists=True,
            target_exists=bool(receptor_path),
            different=file_digest(donor_path) != file_digest(receptor_path),
        ))

    for filename, reason in PROTECTED_FILES.items():
        matching = sorted(relative for relative in receptor_files if Path(relative).name.lower() == filename)
        for relative in matching:
            items.append(PlanItem(
                file=relative,
                action="CONSERVAR",
                group="Geometría del receptor",
                reason=reason,
                source_exists=any(Path(key).name.lower() == filename for key in donor_files),
                target_exists=True,
                different=False,
            ))

    return receptor, donor, sorted(items, key=lambda item: (item.action != "CONSERVAR", item.group, item.file))


def apply_to_receptor(
    receptor_value: str | Path,
    donor_value: str | Path,
    selected_groups: set[str],
) -> tuple[Path, list[PlanItem]]:
    receptor, donor, plan = build_plan(receptor_value, donor_value, selected_groups)
    donor_files = list_files(donor)
    for item in plan:
        if item.action not in {"REEMPLAZAR", "AGREGAR", "FUSIONAR"}:
            continue
        source = donor_files[item.file]
        destination = receptor / Path(item.file)
        destination.parent.mkdir(parents=True, exist_ok=True)
        if item.action == "FUSIONAR":
            destination.write_text(merge_hybrid_file(destination, source), encoding="utf-8")
        else:
            shutil.copy2(source, destination)
    return receptor, plan
