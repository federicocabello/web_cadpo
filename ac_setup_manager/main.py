from __future__ import annotations

import os
import subprocess
import sys
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, simpledialog, ttk

from core import SetupDocument, range_summary, validate_range


BG = "#090b0f"
CARD = "#11151b"
CARD_ALT = "#171c24"
BORDER = "#2b3340"
TEXT = "#f4f7fb"
MUTED = "#8993a3"
CYAN = "#00ffcd"
YELLOW = "#facc15"
RED = "#fb7185"
ASSETTO_CARS_PATH = Path(r"W:\Steam\steamapps\common\assettocorsa\content\cars")

COMMON_FIELDS = (
    ("NAME", "Nombre visible"), ("TAB", "Pestaña"),
    ("MIN", "Mínimo"), ("MAX", "Máximo"), ("STEP", "Paso"),
    ("SHOW_CLICKS", "Mostrar clicks"), ("POS_X", "Posición X"), ("POS_Y", "Posición Y"),
    ("HELP", "Ayuda"), ("RATIOS", "Archivo RTO"), ("VALUES", "Archivo de valores"),
)


class SetupManagerApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("CADPO LAB • Editor de setup Assetto Corsa")
        self.geometry("1440x900")
        self.minsize(1080, 700)
        self.configure(bg=BG)
        self.after_idle(self._maximize)

        self.document: SetupDocument | None = None
        self.edits: dict[str, dict[str, str]] = {}
        self.deleted: set[str] = set()
        self.added: list[tuple[str, dict[str, str]]] = []
        self.current_section = ""
        self.folder_var = tk.StringVar()
        self.search_var = tk.StringVar()
        self.tab_var = tk.StringVar(value="TODAS")
        self.status_var = tk.StringVar(value="Seleccioná la carpeta data de un mod para comenzar.")
        self.section_title_var = tk.StringVar(value="SIN SETUP CARGADO")
        self.section_type_var = tk.StringVar(value="")
        self.range_var = tk.StringVar(value="")
        self.reference_var = tk.StringVar(value="")
        self.key_var = tk.StringVar()
        self.value_var = tk.StringVar()
        self.field_vars = {key: tk.StringVar() for key, _ in COMMON_FIELDS}

        self._configure_styles()
        self._build_ui()
        self.search_var.trace_add("write", lambda *_: self._refresh_sections())
        self.tab_var.trace_add("write", lambda *_: self._refresh_sections())

    def _maximize(self) -> None:
        try:
            self.state("zoomed")
        except tk.TclError:
            self.attributes("-zoomed", True)

    def _configure_styles(self) -> None:
        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure("Treeview", background=CARD, foreground=TEXT, fieldbackground=CARD, borderwidth=0, rowheight=29)
        style.configure("Treeview.Heading", background=CARD_ALT, foreground=CYAN, relief="flat", font=("Segoe UI", 9, "bold"))
        style.map("Treeview", background=[("selected", "#164e46")], foreground=[("selected", "white")])
        style.configure("TCombobox", fieldbackground=BG, background=CARD_ALT, foreground=TEXT, arrowcolor=TEXT)

    def _build_ui(self) -> None:
        header = tk.Frame(self, bg=BG, padx=22, pady=16)
        header.pack(fill="x")
        tk.Label(header, text="CADPO LAB", bg=BG, fg=CYAN, font=("Segoe UI", 9, "bold")).pack(anchor="w")
        title_row = tk.Frame(header, bg=BG)
        title_row.pack(fill="x")
        tk.Label(title_row, text="EDITOR DE SETUP", bg=BG, fg=TEXT, font=("Arial Black", 25)).pack(side="left")
        tk.Button(title_row, text="GUARDAR SETUP.INI", command=self.save, bg=CYAN, fg="#03110e", activebackground="#65ffe0", relief="flat", padx=22, pady=11, font=("Segoe UI", 10, "bold"), cursor="hand2").pack(side="right")
        tk.Label(header, text="Controlá todas las secciones, rangos, pasos y archivos de opciones sin alterar el formato que necesita Assetto Corsa.", bg=BG, fg=MUTED, font=("Segoe UI", 10)).pack(anchor="w", pady=(3, 10))
        folder_row = tk.Frame(header, bg=BG)
        folder_row.pack(fill="x")
        tk.Entry(folder_row, textvariable=self.folder_var, bg=CARD, fg=TEXT, insertbackground=TEXT, relief="flat", font=("Segoe UI", 10)).pack(side="left", fill="x", expand=True, ipady=9)
        tk.Button(folder_row, text="CARGAR CARPETA DATA", command=self.pick_folder, bg=CARD_ALT, fg=TEXT, activebackground=BORDER, relief="flat", padx=18, pady=9, font=("Segoe UI", 9, "bold"), cursor="hand2").pack(side="left", padx=(8, 0))
        tk.Button(folder_row, text="ABRIR CARPETA", command=self.open_folder, bg=CARD_ALT, fg=MUTED, activebackground=BORDER, relief="flat", padx=14, pady=9, font=("Segoe UI", 9, "bold"), cursor="hand2").pack(side="left", padx=(8, 0))

        body = tk.PanedWindow(self, orient="horizontal", bg=BG, sashwidth=6, sashrelief="flat")
        body.pack(fill="both", expand=True, padx=22, pady=(0, 12))
        left = tk.Frame(body, bg=CARD, highlightbackground=BORDER, highlightthickness=1, width=390)
        right = tk.Frame(body, bg=CARD, highlightbackground=BORDER, highlightthickness=1)
        body.add(left, minsize=310, width=390)
        body.add(right, minsize=650)

        filters = tk.Frame(left, bg=CARD, padx=12, pady=12)
        filters.pack(fill="x")
        tk.Label(filters, text="SECCIONES DEL SETUP", bg=CARD, fg=TEXT, font=("Segoe UI", 10, "bold")).pack(anchor="w")
        tk.Entry(filters, textvariable=self.search_var, bg=BG, fg=TEXT, insertbackground=TEXT, relief="flat", font=("Segoe UI", 9)).pack(fill="x", ipady=7, pady=(8, 6))
        self.tab_combo = ttk.Combobox(filters, textvariable=self.tab_var, values=("TODAS",), state="readonly")
        self.tab_combo.pack(fill="x")

        self.section_tree = ttk.Treeview(left, columns=("tab", "type"), show="tree headings", selectmode="browse")
        self.section_tree.heading("#0", text="SECCIÓN")
        self.section_tree.heading("tab", text="PESTAÑA")
        self.section_tree.heading("type", text="TIPO")
        self.section_tree.column("#0", width=160)
        self.section_tree.column("tab", width=90)
        self.section_tree.column("type", width=120)
        self.section_tree.pack(fill="both", expand=True)
        self.section_tree.bind("<<TreeviewSelect>>", self._section_selected)
        left_buttons = tk.Frame(left, bg=CARD, padx=10, pady=10)
        left_buttons.pack(fill="x")
        tk.Button(left_buttons, text="+ NUEVA SECCIÓN", command=self.add_section, bg=CYAN, fg="#03110e", relief="flat", padx=10, pady=8, font=("Segoe UI", 9, "bold"), cursor="hand2").pack(side="left", fill="x", expand=True)
        tk.Button(left_buttons, text="ELIMINAR", command=self.delete_section, bg=CARD_ALT, fg=RED, relief="flat", padx=10, pady=8, font=("Segoe UI", 9, "bold"), cursor="hand2").pack(side="left", padx=(7, 0))

        top = tk.Frame(right, bg=CARD_ALT, padx=16, pady=12)
        top.pack(fill="x")
        tk.Label(top, textvariable=self.section_title_var, bg=CARD_ALT, fg=TEXT, font=("Arial Black", 17)).pack(anchor="w")
        tk.Label(top, textvariable=self.section_type_var, bg=CARD_ALT, fg=CYAN, font=("Segoe UI", 9, "bold")).pack(anchor="w")

        canvas = tk.Canvas(right, bg=CARD, highlightthickness=0)
        scroll = ttk.Scrollbar(right, orient="vertical", command=canvas.yview)
        canvas.configure(yscrollcommand=scroll.set)
        scroll.pack(side="right", fill="y")
        canvas.pack(side="left", fill="both", expand=True)
        editor = tk.Frame(canvas, bg=CARD, padx=16, pady=14)
        window = canvas.create_window((0, 0), window=editor, anchor="nw")
        editor.bind("<Configure>", lambda _event: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.bind("<Configure>", lambda event: canvas.itemconfigure(window, width=event.width))
        canvas.bind_all("<MouseWheel>", lambda event: canvas.yview_scroll(int(-event.delta / 120), "units"))

        tk.Label(editor, text="PARÁMETROS PRINCIPALES", bg=CARD, fg=CYAN, font=("Segoe UI", 9, "bold")).pack(anchor="w")
        fields = tk.Frame(editor, bg=CARD)
        fields.pack(fill="x", pady=(8, 12))
        for column in range(4):
            fields.columnconfigure(column, weight=1)
        for index, (key, label) in enumerate(COMMON_FIELDS):
            cell = tk.Frame(fields, bg=CARD)
            cell.grid(row=index // 4, column=index % 4, sticky="ew", padx=(0, 8), pady=(0, 8))
            tk.Label(cell, text=f"{label} · {key}", bg=CARD, fg=MUTED, font=("Segoe UI", 8, "bold")).pack(anchor="w")
            entry = tk.Entry(cell, textvariable=self.field_vars[key], bg=BG, fg=TEXT, insertbackground=TEXT, relief="flat", font=("Segoe UI", 9))
            entry.pack(fill="x", ipady=7, pady=(3, 0))
            entry.bind("<FocusOut>", lambda _event: self.commit_fields())

        range_card = tk.Frame(editor, bg="#0c2521", highlightbackground="#167b69", highlightthickness=1, padx=12, pady=10)
        range_card.pack(fill="x", pady=(0, 12))
        tk.Label(range_card, text="VISTA DEL RANGO", bg="#0c2521", fg=CYAN, font=("Segoe UI", 8, "bold")).pack(anchor="w")
        tk.Label(range_card, textvariable=self.range_var, bg="#0c2521", fg=TEXT, font=("Segoe UI", 11, "bold")).pack(anchor="w", pady=(2, 0))

        keys_header = tk.Frame(editor, bg=CARD)
        keys_header.pack(fill="x")
        tk.Label(keys_header, text="TODAS LAS CLAVES DE LA SECCIÓN", bg=CARD, fg=CYAN, font=("Segoe UI", 9, "bold")).pack(side="left")
        tk.Label(keys_header, text="Incluye parámetros desconocidos o propios de cada mod", bg=CARD, fg=MUTED, font=("Segoe UI", 8)).pack(side="right")
        self.key_tree = ttk.Treeview(editor, columns=("value",), show="headings", height=10)
        self.key_tree.heading("value", text="CLAVE = VALOR")
        self.key_tree.column("value", width=760)
        self.key_tree.pack(fill="x", pady=(7, 8))
        self.key_tree.bind("<<TreeviewSelect>>", self._key_selected)
        key_editor = tk.Frame(editor, bg=CARD)
        key_editor.pack(fill="x")
        tk.Entry(key_editor, textvariable=self.key_var, bg=BG, fg=CYAN, insertbackground=TEXT, relief="flat", width=24, font=("Consolas", 10, "bold")).pack(side="left", ipady=8)
        tk.Entry(key_editor, textvariable=self.value_var, bg=BG, fg=TEXT, insertbackground=TEXT, relief="flat", font=("Consolas", 10)).pack(side="left", fill="x", expand=True, padx=(7, 7), ipady=8)
        tk.Button(key_editor, text="APLICAR CLAVE", command=self.apply_key, bg=CARD_ALT, fg=TEXT, relief="flat", padx=14, pady=8, font=("Segoe UI", 9, "bold"), cursor="hand2").pack(side="left")

        ref_card = tk.Frame(editor, bg=CARD_ALT, padx=12, pady=10)
        ref_card.pack(fill="x", pady=(14, 0))
        tk.Label(ref_card, text="ARCHIVOS RELACIONADOS", bg=CARD_ALT, fg=YELLOW, font=("Segoe UI", 8, "bold")).pack(anchor="w")
        tk.Label(ref_card, textvariable=self.reference_var, bg=CARD_ALT, fg=TEXT, justify="left", wraplength=850, font=("Segoe UI", 9)).pack(anchor="w", pady=(3, 0))

        status = tk.Label(self, textvariable=self.status_var, bg="#050608", fg=MUTED, anchor="w", padx=22, pady=8, font=("Segoe UI", 9))
        status.pack(fill="x", side="bottom")

    def pick_folder(self) -> None:
        initial = str(ASSETTO_CARS_PATH) if ASSETTO_CARS_PATH.is_dir() else str(Path.cwd())
        selected = filedialog.askdirectory(title="Elegí la carpeta data del mod", initialdir=initial)
        if selected:
            self.load_folder(selected)

    def load_folder(self, folder: str) -> None:
        try:
            self.document = SetupDocument.load(folder)
        except Exception as error:
            messagebox.showerror("No se pudo cargar", str(error), parent=self)
            return
        self.folder_var.set(str(self.document.path.parent))
        self.edits.clear()
        self.deleted.clear()
        self.added.clear()
        self.current_section = ""
        tabs = sorted({section.tab for section in self.document.sections})
        self.tab_combo.configure(values=("TODAS", *tabs))
        self.tab_var.set("TODAS")
        self._refresh_sections()
        self.status_var.set(f"{len(self.document.sections)} secciones detectadas en {self.document.path}")

    def _all_sections(self):
        if not self.document:
            return []
        sections = [section for section in self.document.sections if section.name not in self.deleted]
        for name, values in self.added:
            sections.append(type("AddedSection", (), {
                "name": name, "title": values.get("NAME", name), "tab": values.get("TAB", "GENERAL"),
                "kind": "Nueva sección", "values": values,
            })())
        return sections

    def _refresh_sections(self) -> None:
        if not hasattr(self, "section_tree"):
            return
        selected = self.current_section
        self.section_tree.delete(*self.section_tree.get_children())
        query = self.search_var.get().strip().lower()
        tab = self.tab_var.get()
        for section in self._all_sections():
            if query and query not in f"{section.name} {section.title} {section.tab}".lower():
                continue
            if tab != "TODAS" and section.tab != tab:
                continue
            self.section_tree.insert("", "end", iid=section.name, text=section.name, values=(section.tab, section.kind))
        if selected and self.section_tree.exists(selected):
            self.section_tree.selection_set(selected)

    def _section_values(self, name: str) -> dict[str, str]:
        if not self.document:
            return {}
        added = next((values for section_name, values in self.added if section_name == name), None)
        base = dict(added if added is not None else (self.document.section(name).values if self.document.section(name) else {}))
        base.update(self.edits.get(name, {}))
        return base

    def _section_selected(self, _event=None) -> None:
        selection = self.section_tree.selection()
        if not selection:
            return
        self.commit_fields()
        self.current_section = selection[0]
        values = self._section_values(self.current_section)
        section = next(item for item in self._all_sections() if item.name == self.current_section)
        self.section_title_var.set(f"[{self.current_section}]  {section.title}")
        self.section_type_var.set(section.kind.upper())
        for key, _label in COMMON_FIELDS:
            self.field_vars[key].set(values.get(key, ""))
        self._refresh_key_tree(values)
        self._refresh_analysis(values)

    def commit_fields(self) -> None:
        if not self.current_section:
            return
        changes = self.edits.setdefault(self.current_section, {})
        base = self._section_values(self.current_section)
        for key, _label in COMMON_FIELDS:
            value = self.field_vars[key].get().strip()
            if value or key in base:
                changes[key] = value
        merged = self._section_values(self.current_section)
        self._refresh_analysis(merged)
        self._refresh_key_tree(merged)

    def _refresh_key_tree(self, values: dict[str, str]) -> None:
        self.key_tree.delete(*self.key_tree.get_children())
        for key, value in values.items():
            self.key_tree.insert("", "end", iid=key, values=(f"{key}={value}",))

    def _refresh_analysis(self, values: dict[str, str]) -> None:
        warnings = validate_range(values)
        summary = range_summary(values)
        self.range_var.set(f"{summary}{'  ⚠  ' + ' '.join(warnings) if warnings else ''}")
        if not self.document:
            self.reference_var.set("Sin archivos")
            return
        refs = self.document.referenced_files(values)
        self.reference_var.set("\n".join(f"{'✓' if path.is_file() else '✕'}  {path.name}" for path in refs) if refs else "Esta sección no referencia archivos .lut, .rto o .ini.")

    def _key_selected(self, _event=None) -> None:
        selection = self.key_tree.selection()
        if not selection:
            return
        key = selection[0]
        self.key_var.set(key)
        self.value_var.set(self._section_values(self.current_section).get(key, ""))

    def apply_key(self) -> None:
        if not self.current_section:
            return
        key = self.key_var.get().strip().upper()
        if not key or "=" in key:
            messagebox.showwarning("Clave inválida", "Ingresá una clave sin el signo =.", parent=self)
            return
        self.edits.setdefault(self.current_section, {})[key] = self.value_var.get().strip()
        values = self._section_values(self.current_section)
        if key in self.field_vars:
            self.field_vars[key].set(values.get(key, ""))
        self._refresh_key_tree(values)
        self._refresh_analysis(values)
        self.status_var.set(f"{self.current_section}: {key} actualizado en memoria. Guardá setup.ini para aplicarlo.")

    def add_section(self) -> None:
        name = simpledialog.askstring("Nueva sección", "Nombre técnico de la sección (ejemplo: ARB_FRONT):", parent=self)
        if not name:
            return
        name = name.strip().upper().replace(" ", "_")
        if any(section.name.upper() == name for section in self._all_sections()):
            messagebox.showwarning("Sección existente", f"[{name}] ya existe.", parent=self)
            return
        visible = simpledialog.askstring("Nueva sección", "Nombre visible en el setup:", initialvalue=name.replace("_", " ").title(), parent=self) or ""
        tab = simpledialog.askstring("Nueva sección", "Pestaña (SUSPENSION, TYRES, GEARS, GENERIC…):", initialvalue="GENERIC", parent=self) or "GENERIC"
        values = {"NAME": visible, "TAB": tab.upper(), "MIN": "0", "MAX": "1", "STEP": "1", "POS_X": "0.5", "POS_Y": "0", "SHOW_CLICKS": "0"}
        self.added.append((name, values))
        self._refresh_sections()
        self.section_tree.selection_set(name)
        self.section_tree.see(name)
        self._section_selected()

    def delete_section(self) -> None:
        if not self.current_section:
            return
        if not messagebox.askyesno("Eliminar sección", f"¿Eliminar [{self.current_section}] de setup.ini al guardar?", icon="warning", parent=self):
            return
        added_index = next((index for index, item in enumerate(self.added) if item[0] == self.current_section), None)
        if added_index is not None:
            self.added.pop(added_index)
        else:
            self.deleted.add(self.current_section)
        self.edits.pop(self.current_section, None)
        self.current_section = ""
        self.section_title_var.set("SECCIÓN ELIMINADA")
        self._refresh_sections()

    def save(self) -> None:
        if not self.document:
            messagebox.showwarning("Sin archivo", "Primero cargá una carpeta data.", parent=self)
            return
        self.commit_fields()
        all_warnings = []
        for section in self._all_sections():
            warnings = validate_range(self._section_values(section.name))
            all_warnings.extend(f"[{section.name}] {warning}" for warning in warnings)
        if all_warnings and not messagebox.askyesno("Rangos para revisar", "\n".join(all_warnings[:12]) + "\n\n¿Guardar igualmente?", icon="warning", parent=self):
            return
        try:
            self.document.save(self.edits, self.deleted, self.added)
            path = self.document.path
            self.load_folder(str(path.parent))
            self.status_var.set(f"Guardado correctamente: {path}")
        except Exception as error:
            messagebox.showerror("No se pudo guardar", str(error), parent=self)

    def open_folder(self) -> None:
        path = Path(self.folder_var.get())
        if not path.is_dir():
            return
        if os.name == "nt":
            os.startfile(path)  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            subprocess.Popen(["open", str(path)])
        else:
            subprocess.Popen(["xdg-open", str(path)])


if __name__ == "__main__":
    SetupManagerApp().mainloop()
