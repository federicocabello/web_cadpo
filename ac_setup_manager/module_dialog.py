from __future__ import annotations

import os
import re
import tkinter as tk
from pathlib import Path
from tkinter import messagebox, ttk

from modules import (
    VehicleModule,
    module_parameter_files,
    parameters_for_file,
    scan_vehicle_modules,
    set_module_enabled,
    update_ini_value,
)


BG = "#090b0f"
CARD = "#11151b"
CARD_ALT = "#171c24"
BORDER = "#2b3340"
TEXT = "#f4f7fb"
MUTED = "#8993a3"
CYAN = "#00ffcd"
YELLOW = "#facc15"
RED = "#fb7185"
GREEN = "#4ade80"


class ModuleManagerDialog(tk.Toplevel):
    def __init__(self, parent: tk.Misc, data_folder: Path) -> None:
        super().__init__(parent)
        self.data_folder = data_folder
        self.modules: list[VehicleModule] = []
        self.current_module: VehicleModule | None = None
        self.current_files: dict[str, Path] = {}
        self.current_sections: dict[str, dict[str, str]] = {}
        self.title("CADPO LAB • Módulos y efectos del vehículo")
        self.geometry("1320x820")
        self.minsize(1050, 680)
        self.configure(bg=BG)
        self.transient(parent)

        self.title_var = tk.StringVar(value="SELECCIONÁ UN MÓDULO")
        self.category_var = tk.StringVar()
        self.description_var = tk.StringVar(value="Revisá qué sistemas tiene el mod y administrá sus parámetros.")
        self.detail_var = tk.StringVar()
        self.status_var = tk.StringVar(value=str(data_folder))
        self.file_var = tk.StringVar()
        self.section_var = tk.StringVar()
        self.key_var = tk.StringVar()
        self.value_var = tk.StringVar()

        self._build_ui()
        self._refresh_modules()
        self.after_idle(self._maximize)

    def _maximize(self) -> None:
        try:
            self.state("zoomed")
        except tk.TclError:
            pass

    def _build_ui(self) -> None:
        header = tk.Frame(self, bg=BG, padx=20, pady=14)
        header.pack(fill="x")
        tk.Label(header, text="MÓDULOS Y EFECTOS", bg=BG, fg=TEXT, font=("Arial Black", 22)).pack(anchor="w")
        tk.Label(header, text="Turbo, ayudas electrónicas, DRS, ERS/KERS, mapas de motor y sistemas personalizados CSP.", bg=BG, fg=MUTED, font=("Segoe UI", 10)).pack(anchor="w", pady=(2, 0))

        body = tk.PanedWindow(self, orient="horizontal", bg=BG, sashwidth=6, sashrelief="flat")
        body.pack(fill="both", expand=True, padx=20, pady=(0, 12))
        left = tk.Frame(body, bg=CARD, highlightbackground=BORDER, highlightthickness=1)
        right = tk.Frame(body, bg=CARD, highlightbackground=BORDER, highlightthickness=1)
        body.add(left, minsize=360, width=440)
        body.add(right, minsize=620)

        tk.Label(left, text="SISTEMAS DETECTADOS", bg=CARD, fg=CYAN, anchor="w", padx=12, pady=11, font=("Segoe UI", 9, "bold")).pack(fill="x")
        self.module_tree = ttk.Treeview(left, columns=("category", "status"), show="tree headings", selectmode="browse")
        self.module_tree.heading("#0", text="MÓDULO")
        self.module_tree.heading("category", text="GRUPO")
        self.module_tree.heading("status", text="ESTADO")
        self.module_tree.column("#0", width=190)
        self.module_tree.column("category", width=110)
        self.module_tree.column("status", width=100, anchor="center")
        self.module_tree.pack(fill="both", expand=True)
        self.module_tree.bind("<<TreeviewSelect>>", self._module_selected)
        self.module_tree.tag_configure("enabled", foreground=GREEN)
        self.module_tree.tag_configure("disabled", foreground=RED)
        self.module_tree.tag_configure("missing", foreground=MUTED)
        self.module_tree.tag_configure("custom", foreground=YELLOW)

        top = tk.Frame(right, bg=CARD_ALT, padx=15, pady=12)
        top.pack(fill="x")
        top_line = tk.Frame(top, bg=CARD_ALT)
        top_line.pack(fill="x")
        title_block = tk.Frame(top_line, bg=CARD_ALT)
        title_block.pack(side="left", fill="x", expand=True)
        tk.Label(title_block, textvariable=self.category_var, bg=CARD_ALT, fg=CYAN, font=("Segoe UI", 8, "bold")).pack(anchor="w")
        tk.Label(title_block, textvariable=self.title_var, bg=CARD_ALT, fg=TEXT, font=("Arial Black", 16)).pack(anchor="w")
        self.toggle_button = tk.Button(top_line, text="", command=self.toggle_module, state="disabled", relief="flat", padx=18, pady=9, font=("Segoe UI", 9, "bold"), cursor="hand2")
        self.toggle_button.pack(side="right")
        tk.Label(top, textvariable=self.description_var, bg=CARD_ALT, fg=MUTED, justify="left", anchor="w", wraplength=760, font=("Segoe UI", 9)).pack(fill="x", pady=(6, 2))
        tk.Label(top, textvariable=self.detail_var, bg=CARD_ALT, fg=YELLOW, justify="left", anchor="w", font=("Consolas", 9)).pack(fill="x")

        controls = tk.Frame(right, bg=CARD, padx=14, pady=12)
        controls.pack(fill="x")
        controls.columnconfigure(0, weight=1)
        controls.columnconfigure(1, weight=1)
        file_box = tk.Frame(controls, bg=CARD)
        file_box.grid(row=0, column=0, sticky="ew", padx=(0, 7))
        tk.Label(file_box, text="ARCHIVO", bg=CARD, fg=MUTED, font=("Segoe UI", 8, "bold")).pack(anchor="w")
        self.file_combo = ttk.Combobox(file_box, textvariable=self.file_var, values=(), state="readonly")
        self.file_combo.pack(fill="x", pady=(4, 0))
        self.file_combo.bind("<<ComboboxSelected>>", lambda _event: self._file_selected())
        section_box = tk.Frame(controls, bg=CARD)
        section_box.grid(row=0, column=1, sticky="ew", padx=(7, 0))
        tk.Label(section_box, text="SECCIÓN", bg=CARD, fg=MUTED, font=("Segoe UI", 8, "bold")).pack(anchor="w")
        self.section_combo = ttk.Combobox(section_box, textvariable=self.section_var, values=(), state="readonly")
        self.section_combo.pack(fill="x", pady=(4, 0))
        self.section_combo.bind("<<ComboboxSelected>>", lambda _event: self._section_selected())

        self.parameter_tree = ttk.Treeview(right, columns=("key", "value"), show="headings", selectmode="browse")
        self.parameter_tree.heading("key", text="PARÁMETRO")
        self.parameter_tree.heading("value", text="VALOR")
        self.parameter_tree.column("key", width=260)
        self.parameter_tree.column("value", width=520)
        self.parameter_tree.pack(fill="both", expand=True, padx=14)
        self.parameter_tree.bind("<<TreeviewSelect>>", self._parameter_selected)

        editor = tk.Frame(right, bg=CARD, padx=14, pady=12)
        editor.pack(fill="x")
        tk.Entry(editor, textvariable=self.key_var, state="readonly", readonlybackground=BG, fg=CYAN, relief="flat", width=28, font=("Consolas", 10, "bold")).pack(side="left", ipady=8)
        tk.Entry(editor, textvariable=self.value_var, bg=BG, fg=TEXT, insertbackground=TEXT, relief="flat", font=("Consolas", 10)).pack(side="left", fill="x", expand=True, padx=7, ipady=8)
        tk.Button(editor, text="APLICAR VALOR", command=self.apply_parameter, bg=CYAN, fg="#03110e", relief="flat", padx=16, pady=8, font=("Segoe UI", 9, "bold"), cursor="hand2").pack(side="left")
        tk.Button(editor, text="ABRIR ARCHIVO", command=self.open_current_file, bg=CARD_ALT, fg=TEXT, relief="flat", padx=14, pady=8, font=("Segoe UI", 9, "bold"), cursor="hand2").pack(side="left", padx=(7, 0))

        tk.Label(self, textvariable=self.status_var, bg="#050608", fg=MUTED, anchor="w", padx=20, pady=8, font=("Segoe UI", 9)).pack(fill="x", side="bottom")

    def _refresh_modules(self, select_id: str = "") -> None:
        self.modules = scan_vehicle_modules(self.data_folder)
        self.module_tree.delete(*self.module_tree.get_children())
        for module in self.modules:
            if not module.detected:
                status, tag = "NO DETECTADO", "missing"
            elif module.custom:
                status, tag = "PERSONALIZADO", "custom"
            elif module.enabled:
                status, tag = "ACTIVO", "enabled"
            else:
                status, tag = "DESACTIVADO", "disabled"
            self.module_tree.insert("", "end", iid=module.definition.id, text=module.definition.title, values=(module.definition.category, status), tags=(tag,))
        target = select_id if select_id and self.module_tree.exists(select_id) else (self.module_tree.get_children()[0] if self.module_tree.get_children() else "")
        if target:
            self.module_tree.selection_set(target)
            self.module_tree.see(target)
            self._module_selected()

    def _module_selected(self, _event=None) -> None:
        selection = self.module_tree.selection()
        if not selection:
            return
        self.current_module = next((item for item in self.modules if item.definition.id == selection[0]), None)
        if not self.current_module:
            return
        module = self.current_module
        self.title_var.set(module.definition.title.upper())
        self.category_var.set(module.definition.category)
        self.description_var.set(module.definition.description)
        self.detail_var.set(module.detail)
        if not module.detected or module.custom:
            self.toggle_button.configure(state="disabled", text="NO DISPONIBLE", bg=CARD_ALT, fg=MUTED)
        elif module.enabled:
            self.toggle_button.configure(state="normal", text="DESHABILITAR", bg=RED, fg="#210509")
        else:
            self.toggle_button.configure(state="normal", text="HABILITAR", bg=GREEN, fg="#03110e")
        files = module_parameter_files(self.data_folder, module)
        self.current_files = {path.name: path for path in files}
        names = tuple(self.current_files)
        self.file_combo.configure(values=names)
        self.file_var.set(names[0] if names else "")
        self._file_selected()

    def _file_selected(self) -> None:
        path = self.current_files.get(self.file_var.get())
        self.current_sections = parameters_for_file(path) if path else {}
        if path and self.current_module and self.current_module.definition.mode == "sections" and path.name == self.current_module.definition.filename:
            patterns = self.current_module.definition.section_patterns
            self.current_sections = {
                name: values for name, values in self.current_sections.items()
                if any(re.fullmatch(pattern, name, flags=re.IGNORECASE) for pattern in patterns)
            }
        section_names = tuple(self.current_sections)
        self.section_combo.configure(values=section_names)
        self.section_var.set(section_names[0] if section_names else "")
        self._section_selected()
        if path and not section_names:
            self.status_var.set(f"{path.name}: archivo personalizado o módulo desactivado. Podés abrirlo para inspeccionarlo.")

    def _section_selected(self) -> None:
        self.parameter_tree.delete(*self.parameter_tree.get_children())
        values = self.current_sections.get(self.section_var.get(), {})
        for key, value in values.items():
            self.parameter_tree.insert("", "end", iid=key, values=(key, value))
        self.key_var.set("")
        self.value_var.set("")

    def _parameter_selected(self, _event=None) -> None:
        selection = self.parameter_tree.selection()
        if not selection:
            return
        key = selection[0]
        self.key_var.set(key)
        self.value_var.set(self.current_sections.get(self.section_var.get(), {}).get(key, ""))

    def apply_parameter(self) -> None:
        path = self.current_files.get(self.file_var.get())
        section = self.section_var.get()
        key = self.key_var.get()
        if not path or not section or not key:
            messagebox.showwarning("Sin parámetro", "Seleccioná un parámetro para modificar.", parent=self)
            return
        try:
            update_ini_value(path, section, key, self.value_var.get().strip())
            self.status_var.set(f"Guardado: {path.name} · [{section}] {key}={self.value_var.get().strip()}")
            self._file_selected()
            if self.parameter_tree.exists(key):
                self.parameter_tree.selection_set(key)
        except Exception as error:
            messagebox.showerror("No se pudo modificar", str(error), parent=self)

    def toggle_module(self) -> None:
        if not self.current_module:
            return
        target = not self.current_module.enabled
        action = "habilitar" if target else "deshabilitar"
        if not messagebox.askyesno(
            f"{action.title()} módulo",
            f"¿Querés {action} {self.current_module.definition.title}?\n\nLos valores se conservarán para poder revertir la operación.",
            icon="warning" if not target else "question",
            parent=self,
        ):
            return
        module_id = self.current_module.definition.id
        try:
            set_module_enabled(self.data_folder, self.current_module, target)
            self.status_var.set(f"{self.current_module.definition.title}: {'habilitado' if target else 'deshabilitado'} correctamente.")
            self._refresh_modules(module_id)
        except Exception as error:
            messagebox.showerror("No se pudo cambiar el módulo", str(error), parent=self)

    def open_current_file(self) -> None:
        path = self.current_files.get(self.file_var.get())
        if path and path.is_file():
            os.startfile(path)  # type: ignore[attr-defined]
