from __future__ import annotations

import re
import tkinter as tk
from collections import Counter
from tkinter import messagebox, simpledialog, ttk
from typing import Callable


BG = "#090b0f"
CARD = "#11151b"
CARD_ALT = "#171c24"
BORDER = "#2b3340"
TEXT = "#f4f7fb"
MUTED = "#8993a3"
CYAN = "#00ffcd"
YELLOW = "#facc15"
RED = "#fb7185"

X_VALUES = (0.0, 0.5, 1.0)
X_LABELS = ("IZQUIERDA", "CENTRO", "DERECHA")
MARGIN_X = 26
HEADER_H = 48
COL_W = 286
ROW_H = 82

TAB_TRANSLATIONS = {
    "GENERIC": "GENERAL",
    "GENERAL": "GENERAL",
    "TYRES": "NEUMÁTICOS",
    "SUSPENSION": "SUSPENSIÓN",
    "SUSPENSIONS": "SUSPENSIÓN",
    "SUSPENSION ADV.": "SUSPENSIÓN AVANZADA",
    "SUSPENSION SHOCKS": "AMORTIGUADORES",
    "DAMPERS": "AMORTIGUADORES",
    "ALIGNMENT": "ALINEACIÓN",
    "AERO": "AERODINÁMICA",
    "BRAKES": "FRENOS",
    "DRIVETRAIN": "TRANSMISIÓN",
    "DIFFERENTIAL": "DIFERENCIAL",
    "GEARS": "RELACIONES DE CAJA",
    "ELECTRONICS": "ELECTRÓNICA",
    "CUSTOMIZATION": "PERSONALIZACIÓN",
}

CONTROL_TRANSLATIONS = {
    "FUEL": "Combustible",
    "FRONT_BIAS": "Reparto de frenada",
    "BRAKE_POWER_MULT": "Potencia de frenado",
    "ENGINE_LIMITER": "Limitador del motor",
    "FINAL_GEAR_RATIO": "Relación final",
    "DIFF_POWER": "Diferencial en aceleración",
    "DIFF_COAST": "Diferencial en retención",
    "DIFF_PRELOAD": "Precarga del diferencial",
    "ARB_FRONT": "Barra estabilizadora delantera",
    "ARB_REAR": "Barra estabilizadora trasera",
}

CORNER_TRANSLATIONS = {
    "LF": "rueda delantera izquierda",
    "RF": "rueda delantera derecha",
    "LR": "rueda trasera izquierda",
    "RR": "rueda trasera derecha",
}


def translated_tab(tab: str) -> str:
    technical = (tab or "GENERAL").strip()
    translated = TAB_TRANSLATIONS.get(technical.upper(), technical)
    return translated if translated.upper() == technical.upper() else f"{translated}  [{technical}]"


def translated_control(section: str, original: str) -> str:
    name = section.upper()
    if name in CONTROL_TRANSLATIONS:
        return CONTROL_TRANSLATIONS[name]
    corner = re.fullmatch(r"(PRESSURE|CAMBER|TOE_OUT|SPRING_RATE|ROD_LENGTH|DAMP_BUMP|DAMP_FAST_BUMP|DAMP_REBOUND|DAMP_FAST_REBOUND|BUMP_STOP_RATE|PACKER_RANGE)_([LR][FR])", name)
    if corner:
        labels = {
            "PRESSURE": "Presión",
            "CAMBER": "Caída",
            "TOE_OUT": "Convergencia",
            "SPRING_RATE": "Rigidez del resorte",
            "ROD_LENGTH": "Altura",
            "DAMP_BUMP": "Compresión lenta",
            "DAMP_FAST_BUMP": "Compresión rápida",
            "DAMP_REBOUND": "Rebote lento",
            "DAMP_FAST_REBOUND": "Rebote rápido",
            "BUMP_STOP_RATE": "Rigidez del tope",
            "PACKER_RANGE": "Recorrido del tope",
        }
        return f"{labels[corner.group(1)]} · {CORNER_TRANSLATIONS[corner.group(2)]}"
    wing = re.fullmatch(r"WING_(\d+)", name)
    if wing:
        return f"Alerón {wing.group(1)} · {original}"
    gear = re.fullmatch(r"GEAR_(\d+)", name)
    if gear:
        return f"Relación de {gear.group(1)}.ª marcha"
    return original


class SetupLayoutDialog(tk.Toplevel):
    def __init__(
        self,
        parent: tk.Misc,
        get_sections: Callable[[], list],
        get_values: Callable[[str], dict[str, str]],
        apply_position: Callable[[str, str, str, str], None],
        is_enabled: Callable[[str], bool],
        set_enabled: Callable[[str, bool], None],
        get_available_controls: Callable[[], tuple[str, ...]],
        enable_available_control: Callable[[str], str],
        add_custom_control: Callable[[], str],
        save_setup: Callable[[], None],
    ) -> None:
        super().__init__(parent)
        self.get_sections = get_sections
        self.get_values = get_values
        self.apply_position = apply_position
        self.is_enabled = is_enabled
        self.set_enabled = set_enabled
        self.get_available_controls = get_available_controls
        self.enable_available_control = enable_available_control
        self.add_custom_control = add_custom_control
        self.save_setup = save_setup
        self.current_tab = tk.StringVar()
        self.target_tab = tk.StringVar()
        self.available_var = tk.StringVar()
        self.tab_display_to_raw: dict[str, str] = {}
        self.extra_tabs: list[str] = []
        self.x_var = tk.StringVar(value="0.5")
        self.y_var = tk.StringVar(value="0")
        self.selected_section = ""
        self.card_items: dict[int, str] = {}
        self.drag_section = ""
        self.drag_offset = (0.0, 0.0)
        self.status_var = tk.StringVar(value="Arrastrá un control o usá los botones de posición.")

        self.title("CADPO LAB • Distribución del setup")
        self.geometry("1450x880")
        self.minsize(1080, 680)
        self.configure(bg=BG)
        self.transient(parent)
        self._build_ui()
        self._refresh_available_controls()
        self._refresh_tabs()
        self.after_idle(self._maximize)

    def _maximize(self) -> None:
        try:
            self.state("zoomed")
        except tk.TclError:
            pass

    @staticmethod
    def _number(value: str, fallback: float = 0.0) -> float:
        try:
            return float(str(value).replace(",", "."))
        except ValueError:
            return fallback

    @classmethod
    def _column(cls, value: str) -> int:
        number = cls._number(value, 0.5)
        return min(range(3), key=lambda index: abs(X_VALUES[index] - number))

    def _build_ui(self) -> None:
        header = tk.Frame(self, bg=BG, padx=20, pady=14)
        header.pack(fill="x")
        title_row = tk.Frame(header, bg=BG)
        title_row.pack(fill="x")
        tk.Label(title_row, text="DISTRIBUCIÓN DEL SETUP", bg=BG, fg=TEXT, font=("Arial Black", 22)).pack(side="left")
        tab_control = tk.Frame(title_row, bg=BG)
        tab_control.pack(side="right")
        tk.Label(tab_control, text="PESTAÑA", bg=BG, fg=MUTED, font=("Segoe UI", 8, "bold")).pack(side="left", padx=(0, 7))
        self.tab_combo = ttk.Combobox(tab_control, textvariable=self.current_tab, values=(), state="readonly", width=25)
        self.tab_combo.pack(side="left")
        self.tab_combo.bind("<<ComboboxSelected>>", lambda _event: self._draw())
        tk.Button(tab_control, text="GUARDAR SETUP.INI", command=self.save_setup, bg=CYAN, fg="#03110e", relief="flat", padx=16, pady=8, font=("Segoe UI", 9, "bold"), cursor="hand2").pack(side="left", padx=(10, 0))
        tk.Label(header, text="POS_X usa tres columnas: 0 izquierda, 0.5 centro y 1 derecha. POS_Y define la fila dentro de cada pestaña.", bg=BG, fg=MUTED, font=("Segoe UI", 10)).pack(anchor="w", pady=(3, 0))
        available_row = tk.Frame(header, bg=BG)
        available_row.pack(fill="x", pady=(8, 0))
        tk.Label(available_row, text="AGREGAR CONFIGURACIÓN AL SETUP", bg=BG, fg=YELLOW, font=("Segoe UI", 8, "bold")).pack(side="left", padx=(0, 8))
        self.available_combo = ttk.Combobox(available_row, textvariable=self.available_var, values=(), state="readonly", width=54)
        self.available_combo.pack(side="left", fill="x", expand=True)
        tk.Button(available_row, text="HABILITAR CONTROL", command=self._enable_available, bg=YELLOW, fg="#171203", relief="flat", padx=14, pady=6, font=("Segoe UI", 8, "bold"), cursor="hand2").pack(side="left", padx=(7, 0))
        tk.Button(available_row, text="+ CONTROL MANUAL", command=self._add_custom, bg=CARD_ALT, fg=CYAN, relief="flat", padx=14, pady=6, font=("Segoe UI", 8, "bold"), cursor="hand2").pack(side="left", padx=(7, 0))
        legend = tk.Frame(header, bg=BG)
        legend.pack(anchor="w", pady=(7, 0))
        tk.Label(legend, text="  ", bg=RED, width=3).pack(side="left")
        tk.Label(legend, text=" ROJO: dos controles ocupan la misma columna y fila; en el juego se mostrarían superpuestos.", bg=BG, fg="#fda4af", font=("Segoe UI", 8, "bold")).pack(side="left")
        tk.Label(legend, text="   ■ ", bg=BG, fg=CYAN, font=("Segoe UI", 9, "bold")).pack(side="left")
        tk.Label(legend, text="TURQUESA: control seleccionado.", bg=BG, fg=MUTED, font=("Segoe UI", 8)).pack(side="left")
        tk.Label(legend, text="   ■ ", bg=BG, fg="#5f6b7a", font=("Segoe UI", 9, "bold")).pack(side="left")
        tk.Label(legend, text="GRIS: control desactivado.", bg=BG, fg=MUTED, font=("Segoe UI", 8)).pack(side="left")

        body = tk.Frame(self, bg=BG)
        body.pack(fill="both", expand=True, padx=20, pady=(0, 12))
        body.columnconfigure(0, weight=1)
        body.rowconfigure(0, weight=1)

        canvas_frame = tk.Frame(body, bg=CARD, highlightbackground=BORDER, highlightthickness=1)
        canvas_frame.grid(row=0, column=0, sticky="nsew", padx=(0, 10))
        self.canvas = tk.Canvas(canvas_frame, bg=CARD, highlightthickness=0)
        y_scroll = ttk.Scrollbar(canvas_frame, orient="vertical", command=self.canvas.yview)
        x_scroll = ttk.Scrollbar(canvas_frame, orient="horizontal", command=self.canvas.xview)
        self.canvas.configure(yscrollcommand=y_scroll.set, xscrollcommand=x_scroll.set)
        y_scroll.pack(side="right", fill="y")
        x_scroll.pack(side="bottom", fill="x")
        self.canvas.pack(fill="both", expand=True)
        self.canvas.bind("<ButtonPress-1>", self._drag_start)
        self.canvas.bind("<B1-Motion>", self._drag_motion)
        self.canvas.bind("<ButtonRelease-1>", self._drag_end)
        self.canvas.bind_all("<MouseWheel>", lambda event: self.canvas.yview_scroll(int(-event.delta / 120), "units"))

        side = tk.Frame(body, bg=CARD, highlightbackground=BORDER, highlightthickness=1, width=300, padx=14, pady=14)
        side.grid(row=0, column=1, sticky="ns")
        side.grid_propagate(False)
        tk.Label(side, text="CONTROL SELECCIONADO", bg=CARD, fg=CYAN, font=("Segoe UI", 9, "bold")).pack(anchor="w")
        self.selected_label = tk.Label(side, text="Ninguno", bg=CARD, fg=TEXT, justify="left", wraplength=260, font=("Arial Black", 14))
        self.selected_label.pack(anchor="w", pady=(5, 8))
        self.toggle_button = tk.Button(
            side, text="SELECCIONÁ UN CONTROL", command=self._toggle_selected,
            state="disabled", bg=CARD_ALT, fg=MUTED, disabledforeground=MUTED,
            relief="flat", pady=8, font=("Segoe UI", 8, "bold"), cursor="hand2",
        )
        self.toggle_button.pack(fill="x", pady=(0, 14))

        tk.Label(side, text="COLUMNA · POS_X", bg=CARD, fg=MUTED, font=("Segoe UI", 8, "bold")).pack(anchor="w")
        x_buttons = tk.Frame(side, bg=CARD)
        x_buttons.pack(fill="x", pady=(5, 12))
        for index, (label, value) in enumerate(zip(X_LABELS, X_VALUES)):
            tk.Button(x_buttons, text=label, command=lambda selected=value: self._set_x(selected), bg=CARD_ALT, fg=TEXT, relief="flat", pady=7, font=("Segoe UI", 7, "bold"), cursor="hand2").grid(row=0, column=index, sticky="ew", padx=(0 if index == 0 else 3, 0))
            x_buttons.columnconfigure(index, weight=1)

        tk.Label(side, text="FILA · POS_Y", bg=CARD, fg=MUTED, font=("Segoe UI", 8, "bold")).pack(anchor="w")
        row_controls = tk.Frame(side, bg=CARD)
        row_controls.pack(fill="x", pady=(5, 12))
        tk.Button(row_controls, text="▲", command=lambda: self._move_y(-1), bg=CARD_ALT, fg=TEXT, relief="flat", width=5, pady=7, font=("Segoe UI", 10, "bold"), cursor="hand2").pack(side="left")
        tk.Entry(row_controls, textvariable=self.y_var, bg=BG, fg=TEXT, insertbackground=TEXT, justify="center", relief="flat", font=("Consolas", 12, "bold")).pack(side="left", fill="x", expand=True, padx=5, ipady=7)
        tk.Button(row_controls, text="▼", command=lambda: self._move_y(1), bg=CARD_ALT, fg=TEXT, relief="flat", width=5, pady=7, font=("Segoe UI", 10, "bold"), cursor="hand2").pack(side="left")
        tk.Button(side, text="APLICAR FILA MANUAL", command=self._apply_manual_y, bg=CARD_ALT, fg=TEXT, relief="flat", pady=7, font=("Segoe UI", 8, "bold"), cursor="hand2").pack(fill="x", pady=(0, 14))

        tk.Label(side, text="MOVER A OTRA PESTAÑA", bg=CARD, fg=MUTED, font=("Segoe UI", 8, "bold")).pack(anchor="w")
        self.target_combo = ttk.Combobox(side, textvariable=self.target_tab, values=(), state="normal")
        self.target_combo.pack(fill="x", pady=(5, 6))
        tk.Button(side, text="MOVER CONTROL", command=self._move_tab, bg=YELLOW, fg="#171203", relief="flat", pady=8, font=("Segoe UI", 8, "bold"), cursor="hand2").pack(fill="x")

        tk.Frame(side, bg=BORDER, height=1).pack(fill="x", pady=16)
        tk.Label(side, text="GESTIONAR PESTAÑAS", bg=CARD, fg=MUTED, font=("Segoe UI", 8, "bold")).pack(anchor="w")
        tab_buttons = tk.Frame(side, bg=CARD)
        tab_buttons.pack(fill="x", pady=(6, 12))
        tk.Button(tab_buttons, text="+ NUEVA", command=self._add_tab, bg=CARD_ALT, fg=CYAN, relief="flat", pady=7, font=("Segoe UI", 8, "bold"), cursor="hand2").pack(side="left", fill="x", expand=True)
        tk.Button(tab_buttons, text="RENOMBRAR", command=self._rename_tab, bg=CARD_ALT, fg=TEXT, relief="flat", pady=7, font=("Segoe UI", 8, "bold"), cursor="hand2").pack(side="left", fill="x", expand=True, padx=4)
        tk.Button(tab_buttons, text="ELIMINAR", command=self._delete_tab, bg=CARD_ALT, fg=RED, relief="flat", pady=7, font=("Segoe UI", 8, "bold"), cursor="hand2").pack(side="left", fill="x", expand=True)
        tk.Label(side, text="Las pestañas se muestran en el mismo orden en que aparecen por primera vez dentro de setup.ini.", bg=CARD, fg=MUTED, justify="left", wraplength=260, font=("Segoe UI", 8)).pack(anchor="w", pady=(0, 4))

        tk.Frame(side, bg=BORDER, height=1).pack(fill="x", pady=12)
        tk.Button(side, text="ORDENAR SIN SUPERPOSICIONES", command=self._auto_arrange, bg=CYAN, fg="#03110e", relief="flat", pady=9, font=("Segoe UI", 8, "bold"), cursor="hand2").pack(fill="x")
        tk.Label(side, text="Distribuye los controles de la pestaña actual de izquierda a derecha y de arriba hacia abajo.", bg=CARD, fg=MUTED, justify="left", wraplength=260, font=("Segoe UI", 8)).pack(anchor="w", pady=(6, 0))

        tk.Label(self, textvariable=self.status_var, bg="#050608", fg=MUTED, anchor="w", padx=20, pady=8, font=("Segoe UI", 9)).pack(fill="x", side="bottom")

    def _tabs(self) -> list[str]:
        tabs: list[str] = []
        for section in self.get_sections():
            tab = (self.get_values(section.name).get("TAB") or "GENERAL").strip()
            if tab not in tabs:
                tabs.append(tab)
        for tab in self.extra_tabs:
            if tab not in tabs:
                tabs.append(tab)
        return tabs

    def _raw_current_tab(self) -> str:
        return self.tab_display_to_raw.get(self.current_tab.get(), self.current_tab.get() or "GENERAL")

    def _refresh_available_controls(self) -> None:
        labels = self.get_available_controls()
        self.available_combo.configure(values=labels)
        if self.available_var.get() not in labels:
            self.available_var.set(labels[0] if labels else "")

    def _enable_available(self) -> None:
        label = self.available_var.get()
        if not label:
            messagebox.showinfo(
                "Sin controles disponibles",
                "El mod no tiene controles físicos pendientes de agregar al setup.",
                parent=self,
            )
            return
        section = self.enable_available_control(label)
        self._refresh_available_controls()
        if not section:
            return
        tab = (self.get_values(section).get("TAB") or "GENERAL").strip()
        self._refresh_tabs(tab)
        self._select(section)
        self.status_var.set(f"[{section}] agregado al setup. Ajustá sus valores y guardá setup.ini.")

    def _add_custom(self) -> None:
        section = self.add_custom_control()
        self._refresh_available_controls()
        if not section:
            return
        tab = (self.get_values(section).get("TAB") or "GENERAL").strip()
        self._refresh_tabs(tab)
        self._select(section)

    def _refresh_tabs(self, preferred: str = "") -> None:
        tabs = self._tabs()
        current_raw = self._raw_current_tab()
        self.tab_display_to_raw = {translated_tab(tab): tab for tab in tabs}
        display_tabs = tuple(self.tab_display_to_raw)
        self.tab_combo.configure(values=display_tabs)
        self.target_combo.configure(values=display_tabs)
        selected = preferred if preferred in tabs else (current_raw if current_raw in tabs else (tabs[0] if tabs else "GENERAL"))
        selected_display = translated_tab(selected)
        self.current_tab.set(selected_display)
        self.target_tab.set(selected_display)
        self._draw()

    def _tab_sections(self) -> list:
        tab = self._raw_current_tab()
        return [section for section in self.get_sections() if (self.get_values(section.name).get("TAB") or "GENERAL").strip() == tab]

    def _draw(self) -> None:
        self.canvas.delete("all")
        self.card_items.clear()
        sections = self._tab_sections()
        positions = []
        for section in sections:
            values = self.get_values(section.name)
            column = self._column(values.get("POS_X", "0.5"))
            row = max(0, int(round(self._number(values.get("POS_Y", "0"), 0))))
            enabled = self.is_enabled(section.name)
            positions.append((section, values, column, row, enabled))
        counts = Counter((column, row) for _section, _values, column, row, enabled in positions if enabled)
        max_row = max([row for _section, _values, _column, row, _enabled in positions], default=5)
        width = MARGIN_X * 2 + COL_W * 3
        height = HEADER_H + (max(max_row + 2, 7) * ROW_H)
        self.canvas.configure(scrollregion=(0, 0, width, height))
        for column, label in enumerate(X_LABELS):
            x0 = MARGIN_X + column * COL_W
            self.canvas.create_text(x0 + COL_W / 2, 24, text=f"{label}  ·  POS_X={X_VALUES[column]:g}", fill=CYAN, font=("Segoe UI", 9, "bold"))
            self.canvas.create_line(x0, HEADER_H, x0, height, fill=BORDER)
        self.canvas.create_line(width - MARGIN_X, HEADER_H, width - MARGIN_X, height, fill=BORDER)
        for row in range(max(max_row + 2, 7)):
            y = HEADER_H + row * ROW_H
            self.canvas.create_line(MARGIN_X, y, width - MARGIN_X, y, fill="#202731")
            self.canvas.create_text(8, y + ROW_H / 2, text=str(row), fill=MUTED, font=("Consolas", 8))
        for section, values, column, row, enabled in positions:
            x0 = MARGIN_X + column * COL_W + 8
            y0 = HEADER_H + row * ROW_H + 7
            x1 = x0 + COL_W - 16
            y1 = y0 + ROW_H - 14
            collision = enabled and counts[(column, row)] > 1
            selected = section.name == self.selected_section
            fill = "#173b35" if selected and enabled else ("#20242b" if not enabled else ("#39161d" if collision else CARD_ALT))
            outline = CYAN if selected else ("#5f6b7a" if not enabled else (RED if collision else BORDER))
            rectangle = self.canvas.create_rectangle(
                x0, y0, x1, y1, fill=fill, outline=outline,
                width=2 if selected or collision else 1,
                dash=(5, 3) if not enabled else (), tags=("card", section.name),
            )
            self.card_items[rectangle] = section.name
            original_name = values.get("NAME", section.name)
            name = translated_control(section.name, original_name)
            self.canvas.create_text(x0 + 10, y0 + 13, text=name, anchor="w", fill=TEXT if enabled else MUTED, width=COL_W - 36, font=("Segoe UI", 9, "bold"), tags=("card", section.name))
            summary = "DESACTIVADO" if not enabled else f"[{section.name}]  ·  {values.get('MIN', '—')} → {values.get('MAX', '—')}  ·  STEP {values.get('STEP', '—')}"
            self.canvas.create_text(x0 + 10, y0 + 39, text=summary, anchor="w", fill="#94a3b8" if not enabled else (YELLOW if collision else MUTED), width=COL_W - 36, font=("Consolas", 7, "bold" if not enabled else "normal"), tags=("card", section.name))
        collision_count = sum(1 for count in counts.values() if count > 1)
        tab_label = translated_tab(self._raw_current_tab()).split("  [", 1)[0]
        if collision_count:
            self.status_var.set(f"Se detectaron {collision_count} posiciones superpuestas en {tab_label}. Mové los cuadros rojos a otra fila o columna.")
        else:
            disabled_count = sum(1 for _section, _values, _column, _row, enabled in positions if not enabled)
            suffix = f" · {disabled_count} desactivados" if disabled_count else ""
            self.status_var.set(f"{len(sections)} controles en {tab_label} · sin superposiciones{suffix}.")

    def _section_from_event(self, event) -> str:
        items = self.canvas.find_overlapping(self.canvas.canvasx(event.x), self.canvas.canvasy(event.y), self.canvas.canvasx(event.x), self.canvas.canvasy(event.y))
        for item in reversed(items):
            tags = self.canvas.gettags(item)
            if "card" in tags:
                return next((tag for tag in tags if tag != "card"), "")
        return ""

    def _select(self, section_name: str) -> None:
        self.selected_section = section_name
        if not section_name:
            return
        values = self.get_values(section_name)
        self.selected_label.configure(text=f"{translated_control(section_name, values.get('NAME', section_name))}\n[{section_name}]")
        self.x_var.set(values.get("POS_X", "0.5"))
        self.y_var.set(values.get("POS_Y", "0"))
        self.target_tab.set(translated_tab(values.get("TAB", self._raw_current_tab())))
        enabled = self.is_enabled(section_name)
        self.toggle_button.configure(
            state="normal",
            text="DESACTIVAR CONTROL" if enabled else "ACTIVAR CONTROL",
            bg="#3a1820" if enabled else "#123c34",
            fg=RED if enabled else CYAN,
            activebackground="#52202b" if enabled else "#18564a",
            activeforeground=TEXT,
        )
        self._draw()

    def _toggle_selected(self) -> None:
        if not self.selected_section:
            return
        enabled = not self.is_enabled(self.selected_section)
        self.set_enabled(self.selected_section, enabled)
        action = "activado" if enabled else "desactivado"
        self.status_var.set(f"[{self.selected_section}] {action}. Guardá setup.ini para confirmar.")
        self._select(self.selected_section)

    def _drag_start(self, event) -> None:
        section = self._section_from_event(event)
        if not section:
            return
        self._select(section)
        self.drag_section = section
        self.drag_offset = (self.canvas.canvasx(event.x), self.canvas.canvasy(event.y))

    def _drag_motion(self, event) -> None:
        if not self.drag_section:
            return
        x, y = self.canvas.canvasx(event.x), self.canvas.canvasy(event.y)
        last_x, last_y = self.drag_offset
        self.canvas.move(self.drag_section, x - last_x, y - last_y)
        self.drag_offset = (x, y)

    def _drag_end(self, event) -> None:
        if not self.drag_section:
            return
        x, y = self.canvas.canvasx(event.x), self.canvas.canvasy(event.y)
        column = max(0, min(2, int((x - MARGIN_X) // COL_W)))
        row = max(0, int((y - HEADER_H) // ROW_H))
        self._apply(self.drag_section, self._raw_current_tab(), f"{X_VALUES[column]:g}", str(row))
        self.drag_section = ""

    def _apply(self, section: str, tab: str, x_value: str, y_value: str) -> None:
        self.apply_position(section, tab, x_value, y_value)
        self.x_var.set(x_value)
        self.y_var.set(y_value)
        self.status_var.set(f"[{section}] → {tab} · POS_X={x_value} · POS_Y={y_value}. Guardá setup.ini para confirmar.")
        self._refresh_tabs(tab)
        self._select(section)

    def _set_x(self, value: float) -> None:
        if self.selected_section:
            self._apply(self.selected_section, self._raw_current_tab(), f"{value:g}", self.y_var.get())

    def _move_y(self, amount: int) -> None:
        if not self.selected_section:
            return
        row = max(0, int(round(self._number(self.y_var.get(), 0))) + amount)
        self._apply(self.selected_section, self._raw_current_tab(), self.x_var.get(), str(row))

    def _apply_manual_y(self) -> None:
        if not self.selected_section:
            return
        try:
            row = max(0, int(self.y_var.get()))
        except ValueError:
            messagebox.showwarning("Fila inválida", "POS_Y debe ser un número entero mayor o igual a cero.", parent=self)
            return
        self._apply(self.selected_section, self._raw_current_tab(), self.x_var.get(), str(row))

    def _move_tab(self) -> None:
        if not self.selected_section:
            return
        selected = self.target_tab.get().strip()
        tab = self.tab_display_to_raw.get(selected, selected).upper()
        if not tab:
            messagebox.showwarning("Pestaña inválida", "Ingresá el nombre de la pestaña.", parent=self)
            return
        self._apply(self.selected_section, tab, self.x_var.get(), self.y_var.get())

    def _add_tab(self) -> None:
        name = simpledialog.askstring("Nueva pestaña", "Nombre de la nueva pestaña:", parent=self)
        if not name:
            return
        name = " ".join(name.strip().upper().split())
        if not name:
            return
        existing = {tab.upper() for tab in self._tabs()}
        if name in existing:
            messagebox.showwarning("Pestaña existente", f"La pestaña {name} ya existe.", parent=self)
            return
        self.extra_tabs.append(name)
        self._refresh_tabs(name)
        self.status_var.set(f"Pestaña {name} creada. Mové al menos un control para que quede registrada en setup.ini.")

    def _rename_tab(self) -> None:
        current = self._raw_current_tab()
        name = simpledialog.askstring("Renombrar pestaña", "Nuevo nombre:", initialvalue=current, parent=self)
        if not name:
            return
        name = " ".join(name.strip().upper().split())
        if not name or name == current:
            return
        if name in {tab.upper() for tab in self._tabs()}:
            messagebox.showwarning("Pestaña existente", f"La pestaña {name} ya existe.", parent=self)
            return
        affected = self._tab_sections()
        if not affected and current in self.extra_tabs:
            self.extra_tabs[self.extra_tabs.index(current)] = name
        else:
            for section in affected:
                values = self.get_values(section.name)
                self.apply_position(section.name, name, values.get("POS_X", "0.5"), values.get("POS_Y", "0"))
        self.extra_tabs = [name if tab == current else tab for tab in self.extra_tabs]
        self._refresh_tabs(name)
        self.status_var.set(f"Pestaña {current} renombrada como {name}. Guardá setup.ini para confirmar.")

    def _delete_tab(self) -> None:
        current = self._raw_current_tab()
        affected = self._tab_sections()
        remaining = [tab for tab in self._tabs() if tab != current]
        if not affected:
            self.extra_tabs = [tab for tab in self.extra_tabs if tab != current]
            self._refresh_tabs(remaining[0] if remaining else "GENERAL")
            self.status_var.set(f"Pestaña vacía {current} eliminada.")
            return
        destination_default = remaining[0] if remaining else "GENERAL"
        destination = simpledialog.askstring(
            "Eliminar pestaña",
            f"Los {len(affected)} controles de {current} deben moverse a otra pestaña.\nDestino:",
            initialvalue=destination_default,
            parent=self,
        )
        if not destination:
            return
        destination = " ".join(destination.strip().upper().split())
        if destination == current:
            messagebox.showwarning("Destino inválido", "La pestaña de destino debe ser diferente.", parent=self)
            return
        if not messagebox.askyesno("Eliminar pestaña", f"¿Mover {len(affected)} controles de {current} a {destination} y eliminar la pestaña?", icon="warning", parent=self):
            return
        for section in affected:
            values = self.get_values(section.name)
            self.apply_position(section.name, destination, values.get("POS_X", "0.5"), values.get("POS_Y", "0"))
        self.extra_tabs = [tab for tab in self.extra_tabs if tab != current]
        self._refresh_tabs(destination)
        self.status_var.set(f"Pestaña {current} eliminada; sus controles fueron movidos a {destination}.")

    def _auto_arrange(self) -> None:
        sections = sorted(self._tab_sections(), key=lambda section: (
            int(round(self._number(self.get_values(section.name).get("POS_Y", "0"), 0))),
            self._column(self.get_values(section.name).get("POS_X", "0.5")),
            section.name,
        ))
        if not sections:
            return
        current_tab = self._raw_current_tab()
        if not messagebox.askyesno("Ordenar pestaña", f"¿Distribuir automáticamente los {len(sections)} controles de {translated_tab(current_tab)}?", parent=self):
            return
        for index, section in enumerate(sections):
            row, column = divmod(index, 3)
            self.apply_position(section.name, current_tab, f"{X_VALUES[column]:g}", str(row))
        self.status_var.set(f"{translated_tab(current_tab)} ordenada sin superposiciones. Guardá setup.ini para confirmar.")
        self._draw()
