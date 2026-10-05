from __future__ import annotations

import os
import subprocess
import sys
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

from core import GROUPS, apply_to_receptor, build_plan


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


class PhysicsTransferApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("CADPO • Transferencia de físicas Assetto Corsa")
        self.geometry("1280x820")
        self.minsize(980, 680)
        self.configure(bg=BG)
        self.after_idle(self._maximize_window)

        self.receptor_var = tk.StringVar()
        self.donor_var = tk.StringVar()
        self.status_var = tk.StringVar(value="Seleccioná las dos carpetas data para comenzar.")
        self.group_vars = {
            key: tk.BooleanVar(value=key in {"chasis", "motor", "transmision", "frenos", "aerodinamica", "neumaticos", "suspension", "setup", "electronica"})
            for key in GROUPS
        }
        self.plan = []
        self._configure_styles()
        self._build_ui()

    def _maximize_window(self) -> None:
        try:
            self.state("zoomed")
        except tk.TclError:
            self.attributes("-zoomed", True)

    @staticmethod
    def _assetto_initial_directory() -> str:
        return str(ASSETTO_CARS_PATH) if ASSETTO_CARS_PATH.is_dir() else str(Path.cwd())

    def _configure_styles(self) -> None:
        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure("Treeview", background=CARD, foreground=TEXT, fieldbackground=CARD, borderwidth=0, rowheight=28)
        style.configure("Treeview.Heading", background=CARD_ALT, foreground=CYAN, relief="flat", font=("Segoe UI", 9, "bold"))
        style.map("Treeview", background=[("selected", "#164e46")], foreground=[("selected", "white")])
        style.configure("Vertical.TScrollbar", background=CARD_ALT, troughcolor=BG, arrowcolor=TEXT)

    def _build_ui(self) -> None:
        header = tk.Frame(self, bg=BG, padx=24, pady=18)
        header.pack(fill="x")
        tk.Label(header, text="CADPO LAB", bg=BG, fg=CYAN, font=("Segoe UI", 9, "bold")).pack(anchor="w")
        tk.Label(header, text="TRANSFERENCIA DE FÍSICAS", bg=BG, fg=TEXT, font=("Arial Black", 25)).pack(anchor="w")
        tk.Label(
            header,
            text="Conservá la carrocería y geometría del mod receptor; trasladá solamente el comportamiento del mod donante.",
            bg=BG,
            fg=MUTED,
            font=("Segoe UI", 10),
        ).pack(anchor="w", pady=(4, 0))

        body = tk.Frame(self, bg=BG, padx=24, pady=0)
        body.pack(fill="both", expand=True)

        folders = tk.Frame(body, bg=BG)
        folders.pack(fill="x")
        folders.columnconfigure(0, weight=1)
        folders.columnconfigure(1, weight=1)
        self._folder_card(folders, 0, "1 • MOD RECEPTOR", "Conserva carrocería, ruedas y geometría", self.receptor_var, self._pick_receptor)
        self._folder_card(folders, 1, "2 • MOD DONANTE", "Aporta las físicas y el comportamiento", self.donor_var, self._pick_donor)

        groups_frame = tk.Frame(body, bg=CARD, highlightbackground=BORDER, highlightthickness=1, padx=14, pady=12)
        groups_frame.pack(fill="x", pady=12)
        top = tk.Frame(groups_frame, bg=CARD)
        top.pack(fill="x", pady=(0, 8))
        tk.Label(top, text="QUÉ SE VA A TRANSFERIR", bg=CARD, fg=TEXT, font=("Segoe UI", 10, "bold")).pack(side="left")
        tk.Button(top, text="ANALIZAR", command=self.analyze, bg=CYAN, fg="#03110e", activebackground="#65ffe0", relief="flat", padx=18, pady=6, font=("Segoe UI", 9, "bold"), cursor="hand2").pack(side="right")
        choices = tk.Frame(groups_frame, bg=CARD)
        choices.pack(fill="x")
        for index, (key, group) in enumerate(GROUPS.items()):
            check = tk.Checkbutton(
                choices,
                text=group["label"],
                variable=self.group_vars[key],
                command=self._selection_changed,
                bg=CARD,
                fg=TEXT,
                activebackground=CARD,
                activeforeground=CYAN,
                selectcolor=BG,
                font=("Segoe UI", 9),
            )
            check.grid(row=index // 3, column=index % 3, sticky="w", padx=(0, 28), pady=3)

        table_card = tk.Frame(body, bg=CARD, highlightbackground=BORDER, highlightthickness=1)
        table_card.pack(fill="both", expand=True)
        table_header = tk.Frame(table_card, bg=CARD_ALT, padx=12, pady=9)
        table_header.pack(fill="x")
        tk.Label(table_header, text="PLAN DE TRANSFERENCIA", bg=CARD_ALT, fg=TEXT, font=("Segoe UI", 10, "bold")).pack(side="left")
        tk.Label(table_header, text="Los archivos sensibles quedan protegidos", bg=CARD_ALT, fg=YELLOW, font=("Segoe UI", 9)).pack(side="right")

        columns = ("action", "file", "group", "reason")
        self.tree = ttk.Treeview(table_card, columns=columns, show="headings")
        self.tree.heading("action", text="ACCIÓN")
        self.tree.heading("file", text="ARCHIVO")
        self.tree.heading("group", text="GRUPO")
        self.tree.heading("reason", text="CRITERIO")
        self.tree.column("action", width=105, minwidth=90, stretch=False)
        self.tree.column("file", width=190, minwidth=130)
        self.tree.column("group", width=210, minwidth=150)
        self.tree.column("reason", width=620, minwidth=260)
        scroll = ttk.Scrollbar(table_card, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scroll.set)
        scroll.pack(side="right", fill="y")
        self.tree.pack(fill="both", expand=True)
        self.tree.tag_configure("replace", foreground=CYAN)
        self.tree.tag_configure("add", foreground="#86efac")
        self.tree.tag_configure("keep", foreground=YELLOW)

        footer = tk.Frame(body, bg=BG, pady=13)
        footer.pack(fill="x")
        tk.Label(footer, text="No se creará ningún respaldo. Los cambios se aplicarán directamente al mod receptor.", bg=BG, fg=RED, font=("Segoe UI", 9, "bold")).pack(side="left", anchor="center")
        tk.Button(footer, text="APLICAR AL RECEPTOR", command=self.apply_changes, bg=CYAN, fg="#03110e", activebackground="#65ffe0", relief="flat", padx=24, pady=13, font=("Segoe UI", 10, "bold"), cursor="hand2").pack(side="right", padx=(14, 0), anchor="s")

        status = tk.Label(self, textvariable=self.status_var, bg="#050608", fg=MUTED, anchor="w", padx=24, pady=8, font=("Segoe UI", 9))
        status.pack(fill="x", side="bottom")

    def _folder_card(self, parent, column, title, subtitle, variable, command) -> None:
        card = tk.Frame(parent, bg=CARD, highlightbackground=BORDER, highlightthickness=1, padx=14, pady=12)
        card.grid(row=0, column=column, sticky="nsew", padx=(0, 6) if column == 0 else (6, 0))
        tk.Label(card, text=title, bg=CARD, fg=CYAN, font=("Segoe UI", 10, "bold")).pack(anchor="w")
        tk.Label(card, text=subtitle, bg=CARD, fg=MUTED, font=("Segoe UI", 9)).pack(anchor="w", pady=(1, 8))
        row = tk.Frame(card, bg=CARD)
        row.pack(fill="x")
        tk.Entry(row, textvariable=variable, bg=BG, fg=TEXT, insertbackground=TEXT, relief="flat", font=("Segoe UI", 9)).pack(side="left", fill="x", expand=True, ipady=8)
        tk.Button(row, text="BUSCAR DATA", command=command, bg=CARD_ALT, fg=TEXT, activebackground=BORDER, relief="flat", padx=12, pady=8, cursor="hand2").pack(side="left", padx=(6, 0))

    def _pick_receptor(self) -> None:
        selected = filedialog.askdirectory(
            title="Elegí la carpeta data del mod receptor",
            initialdir=self._assetto_initial_directory(),
        )
        if selected:
            self.receptor_var.set(selected)
            self._selection_changed()

    def _pick_donor(self) -> None:
        selected = filedialog.askdirectory(
            title="Elegí la carpeta data del mod donante",
            initialdir=self._assetto_initial_directory(),
        )
        if selected:
            self.donor_var.set(selected)
            self._selection_changed()

    def _selected_groups(self) -> set[str]:
        return {key for key, value in self.group_vars.items() if value.get()}

    def _selection_changed(self) -> None:
        if self.receptor_var.get() and self.donor_var.get():
            self.status_var.set("La selección cambió. Presioná ANALIZAR para actualizar el plan.")

    def analyze(self) -> None:
        try:
            _, _, self.plan = build_plan(self.receptor_var.get(), self.donor_var.get(), self._selected_groups())
        except Exception as error:
            messagebox.showerror("No se pudo analizar", str(error), parent=self)
            return
        for item in self.tree.get_children():
            self.tree.delete(item)
        counters = {"REEMPLAZAR": 0, "AGREGAR": 0, "FUSIONAR": 0, "CONSERVAR": 0}
        for item in self.plan:
            counters[item.action] += 1
            if item.action == "REEMPLAZAR" and not item.different:
                action = "IGUAL"
                tag = "keep"
            else:
                action = item.action
                tag = {"REEMPLAZAR": "replace", "AGREGAR": "add", "FUSIONAR": "replace", "CONSERVAR": "keep"}[item.action]
            self.tree.insert("", "end", values=(action, item.file, item.group, item.reason), tags=(tag,))
        self.status_var.set(
            f"Análisis listo: {counters['REEMPLAZAR']} reemplazos, {counters['FUSIONAR']} fusiones, {counters['AGREGAR']} nuevos y {counters['CONSERVAR']} protegidos."
        )

    def apply_changes(self) -> None:
        try:
            _, _, plan = build_plan(self.receptor_var.get(), self.donor_var.get(), self._selected_groups())
        except Exception as error:
            messagebox.showerror("No se pudo analizar", str(error), parent=self)
            return
        affected = sum(item.action in {"REEMPLAZAR", "AGREGAR", "FUSIONAR"} for item in plan)
        if not affected:
            messagebox.showwarning("Sin cambios", "Seleccioná al menos un grupo de físicas disponible.", parent=self)
            return
        confirmed = messagebox.askyesno(
            "Aplicar directamente",
            f"Se modificarán {affected} archivos directamente en el mod receptor.\n\nLa aplicación no creará ningún respaldo. ¿Continuar?",
            icon="warning",
            parent=self,
        )
        if not confirmed:
            return
        try:
            receptor_data, plan = apply_to_receptor(
                self.receptor_var.get(),
                self.donor_var.get(),
                self._selected_groups(),
            )
        except Exception as error:
            messagebox.showerror("No se pudieron aplicar los cambios", str(error), parent=self)
            return
        transferred = sum(item.action in {"REEMPLAZAR", "AGREGAR", "FUSIONAR"} for item in plan)
        self.status_var.set(f"Cambios aplicados en {receptor_data}. Se procesaron {transferred} archivos.")
        messagebox.showinfo("Cambios aplicados", f"Se actualizaron {transferred} archivos del mod receptor sin generar respaldo.", parent=self)

    @staticmethod
    def _open_folder(path: Path) -> None:
        if sys.platform == "win32":
            os.startfile(path)  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            subprocess.Popen(["open", str(path)])
        else:
            subprocess.Popen(["xdg-open", str(path)])


if __name__ == "__main__":
    PhysicsTransferApp().mainloop()
