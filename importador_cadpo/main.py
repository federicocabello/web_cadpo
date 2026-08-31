import threading
import tkinter as tk
from tkinter import messagebox, ttk
import traceback
import unicodedata
from datetime import datetime
from pathlib import Path

from mysql.connector import Error
from tksheet import Sheet, num2alpha

from database import (
    DATABASE_CONFIG,
    create_connection,
    ensure_connection,
    fetch_all_championships,
    fetch_championships,
    fetch_driver_names,
    fetch_import_context,
    fetch_registration_context,
    save_import,
    save_new_drivers,
    save_registrations,
    verify_connection,
)


COLORS = {
    "background": "#090909",
    "panel": "#141414",
    "field": "#202020",
    "border": "#343434",
    "red": "#dc2626",
    "red_hover": "#ef4444",
    "green": "#22c55e",
    "text": "#f5f5f5",
    "muted": "#9ca3af",
}


class ImportadorCadpo(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Importador CADPO - v0.2")
        self.geometry("1280x760")
        self.minsize(960, 620)
        self.configure(bg=COLORS["background"])
        self.connection = None
        self.championships = []
        self.import_context = None
        self.import_rows = []
        self.sheet = None
        self.scoring_sheet = None
        self.driver_import_sheet = None
        self.registration_import_sheet = None
        self.registration_championship_value = tk.StringVar()
        self.registration_driver_count = tk.StringVar(value="30")
        self.loading_overlay = None
        self.driver_import_column_order = list(range(7))
        self.driver_import_visible_columns = list(range(7))
        self.columns_expanded = False
        self.columns_button = None
        self.compact_column_order = [0, 6, 8]
        self._pilot_validation_job = None
        self._scoring_row_job = None
        self.championship_value = tk.StringVar()
        self.driver_row_count = tk.StringVar(value="30")
        self.driver_row_count.trace_add("write", self._schedule_scoring_row_sync)

        self.status = tk.StringVar(value="Iniciando conexión con la base de datos...")

        self._configure_styles()
        self._show_connection_screen()
        self.after(150, self._start_connection_test)
        self.protocol("WM_DELETE_WINDOW", self._close_application)

    def report_callback_exception(self, exception_type, exception, traceback_object):
        error_detail = "".join(
            traceback.format_exception(exception_type, exception, traceback_object)
        )
        self._save_error_detail("Error inesperado", exception, error_detail)

    def _configure_styles(self):
        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure(
            "Cadpo.TEntry",
            fieldbackground=COLORS["field"],
            foreground=COLORS["text"],
            insertcolor=COLORS["text"],
            bordercolor=COLORS["border"],
            lightcolor=COLORS["border"],
            darkcolor=COLORS["border"],
            padding=10,
        )
        style.map(
            "Cadpo.TEntry",
            bordercolor=[("focus", COLORS["red"])],
            lightcolor=[("focus", COLORS["red"])],
            darkcolor=[("focus", COLORS["red"])],
        )

    def _clear_window(self):
        for widget in self.winfo_children():
            widget.destroy()

    def _show_loading(self, title, detail):
        self._hide_loading()
        overlay = tk.Toplevel(self)
        self.loading_overlay = overlay
        overlay.title(title)
        overlay.configure(bg=COLORS["panel"])
        overlay.resizable(False, False)
        overlay.transient(self)
        overlay.protocol("WM_DELETE_WINDOW", lambda: None)
        overlay.grab_set()

        panel = tk.Frame(overlay, bg=COLORS["panel"], padx=34, pady=28)
        panel.pack(fill="both", expand=True)
        tk.Label(
            panel, text=title.upper(), bg=COLORS["panel"], fg=COLORS["text"],
            font=("Arial", 14, "bold"),
        ).pack()
        tk.Label(
            panel, text=detail, bg=COLORS["panel"], fg=COLORS["muted"],
            font=("Arial", 10), wraplength=420, justify="center",
        ).pack(pady=(8, 18))
        progress = ttk.Progressbar(panel, mode="indeterminate", length=360)
        progress.pack(fill="x")
        progress.start(12)

        overlay.update_idletasks()
        width = overlay.winfo_reqwidth()
        height = overlay.winfo_reqheight()
        x = self.winfo_rootx() + max(0, (self.winfo_width() - width) // 2)
        y = self.winfo_rooty() + max(0, (self.winfo_height() - height) // 2)
        overlay.geometry(f"{width}x{height}+{x}+{y}")
        overlay.focus_force()
        overlay.update()

    def _hide_loading(self):
        if self.loading_overlay is None:
            return
        try:
            self.loading_overlay.grab_release()
            self.loading_overlay.destroy()
        except tk.TclError:
            pass
        self.loading_overlay = None

    def _show_connection_screen(self):
        self._clear_window()

        container = tk.Frame(self, bg=COLORS["background"])
        container.pack(fill="both", expand=True, padx=28, pady=24)

        tk.Label(
            container,
            text="IMPORTADOR CADPO",
            bg=COLORS["background"],
            fg=COLORS["text"],
            font=("Arial", 24, "bold"),
        ).pack(anchor="w")
        tk.Label(
            container,
            text="Conexión a la base de datos",
            bg=COLORS["background"],
            fg=COLORS["muted"],
            font=("Arial", 11),
        ).pack(anchor="w", pady=(3, 20))

        panel = tk.Frame(
            container,
            bg=COLORS["panel"],
            highlightbackground=COLORS["border"],
            highlightthickness=1,
            padx=24,
            pady=22,
        )
        panel.pack(fill="both", expand=True)
        panel.columnconfigure(0, weight=1)

        tk.Label(
            panel,
            text=DATABASE_CONFIG["database"].upper(),
            bg=COLORS["panel"],
            fg=COLORS["text"],
            font=("Arial", 20, "bold"),
        ).grid(row=0, column=0, sticky="ew", pady=(45, 8))
        tk.Label(
            panel,
            text=f'{DATABASE_CONFIG["host"]}:{DATABASE_CONFIG["port"]}',
            bg=COLORS["panel"],
            fg=COLORS["muted"],
            font=("Arial", 10),
        ).grid(row=1, column=0, sticky="ew")

        self.status_label = tk.Label(
            panel,
            textvariable=self.status,
            bg=COLORS["panel"],
            fg=COLORS["muted"],
            anchor="w",
            font=("Arial", 10),
        )
        self.status_label.grid(row=2, column=0, sticky="ew", pady=(24, 12))

        self.connect_button = tk.Button(
            panel,
            text="CONECTANDO...",
            command=self._start_connection_test,
            bg=COLORS["red"],
            activebackground=COLORS["red_hover"],
            fg="white",
            activeforeground="white",
            relief="flat",
            cursor="hand2",
            font=("Arial", 11, "bold"),
            padx=20,
            pady=12,
        )
        self.connect_button.grid(row=3, column=0, sticky="ew", pady=(25, 0))
        self.connect_button.configure(state="disabled")

    def _start_connection_test(self):
        self.connect_button.configure(state="disabled", text="CONECTANDO...")
        self.status.set("Comprobando acceso a MySQL...")
        self.status_label.configure(fg=COLORS["muted"])

        threading.Thread(target=self._test_connection, daemon=True).start()

    def _test_connection(self):
        connection = None
        try:
            connection = create_connection()
            database_name, mysql_version = verify_connection(connection)

            self.after(0, self._connection_success, connection, database_name, mysql_version)
        except Error as error:
            if connection and connection.is_connected():
                connection.close()
            self.after(0, self._connection_error, str(error))
        except Exception as error:
            if connection and connection.is_connected():
                connection.close()
            self.after(0, self._connection_error, str(error))

    def _connection_success(self, connection, database_name, mysql_version):
        self.connection = connection
        self.status.set(f"Conectado a {database_name} · MySQL {mysql_version}")
        self.status_label.configure(fg=COLORS["green"])
        self.after(450, self._show_workspace)

    def _connection_error(self, detail):
        self.status.set("No se pudo establecer la conexión.")
        self.status_label.configure(fg=COLORS["red_hover"])
        self.connect_button.configure(state="normal", text="REINTENTAR CONEXIÓN")
        messagebox.showerror(
            "Error de conexión",
            f"No se pudo conectar con la base de datos.\n\n{detail}",
        )

    def _show_workspace(self):
        self._clear_window()
        try:
            self.state("zoomed")
        except tk.TclError:
            pass

        self.import_content = tk.Frame(self, bg=COLORS["background"])
        self.import_content.pack(fill="both", expand=True)
        self._show_championship_selector()

    @staticmethod
    def _normalize(value):
        normalized = unicodedata.normalize("NFD", str(value or "").strip())
        return " ".join(
            "".join(character for character in normalized if unicodedata.category(character) != "Mn")
            .casefold()
            .split()
        )

    def _show_championship_selector(self):
        self._dispose_sheet()
        for widget in self.import_content.winfo_children():
            widget.destroy()

        title_row = tk.Frame(self.import_content, bg=COLORS["background"])
        title_row.pack(fill="x")
        tk.Label(
            title_row,
            text="SELECCIONAR CAMPEONATO",
            bg=COLORS["background"],
            fg=COLORS["text"],
            font=("Arial", 20, "bold"),
            anchor="w",
        ).pack(side="left", fill="x", expand=True)
        tk.Button(
            title_row,
            text="+ PILOTOS",
            command=self._show_driver_import,
            bg=COLORS["panel"],
            activebackground=COLORS["field"],
            fg=COLORS["text"],
            activeforeground=COLORS["text"],
            relief="flat",
            cursor="hand2",
            font=("Arial", 9, "bold"),
            padx=14,
            pady=8,
        ).pack(side="right", padx=(8, 0))
        tk.Button(
            title_row,
            text="+ INSCRIPTOS",
            command=self._show_registration_import,
            bg=COLORS["panel"],
            activebackground=COLORS["field"],
            fg=COLORS["text"],
            activeforeground=COLORS["text"],
            relief="flat",
            cursor="hand2",
            font=("Arial", 9, "bold"),
            padx=14,
            pady=8,
        ).pack(side="right")
        tk.Button(
            title_row,
            text="SALIR",
            command=self._close_application,
            bg=COLORS["red"],
            activebackground=COLORS["red_hover"],
            fg=COLORS["text"],
            activeforeground=COLORS["text"],
            relief="flat",
            cursor="hand2",
            font=("Arial", 9, "bold"),
            padx=14,
            pady=8,
        ).pack(side="right")
        tk.Label(
            self.import_content,
            text="La planilla se generará usando las fechas cargadas en calendario.",
            bg=COLORS["background"],
            fg=COLORS["muted"],
            font=("Arial", 10),
            anchor="w",
        ).pack(fill="x", pady=(5, 18))

        try:
            self.connection = ensure_connection(self.connection)
            self.championships = fetch_championships(self.connection)
        except Exception as error:
            messagebox.showerror("Error", f"No se pudieron cargar los campeonatos.\n\n{error}")
            return

        labels = [
            f'{row["id"]} · {row["categoria"]} · T{row["temporada"]} · {row["anio"]}'
            for row in self.championships
        ]
        championship_select = ttk.Combobox(
            self.import_content,
            textvariable=self.championship_value,
            values=labels,
            state="readonly",
            font=("Arial", 11),
        )
        championship_select.pack(fill="x", ipady=7)

        row_count_frame = tk.Frame(self.import_content, bg=COLORS["background"])
        row_count_frame.pack(fill="x", pady=(16, 0))
        tk.Label(
            row_count_frame,
            text="CANTIDAD DE PILOTOS",
            bg=COLORS["background"],
            fg=COLORS["muted"],
            font=("Arial", 9, "bold"),
        ).pack(side="left")
        ttk.Spinbox(
            row_count_frame,
            from_=1,
            to=500,
            textvariable=self.driver_row_count,
            width=8,
            font=("Arial", 11),
        ).pack(side="left", padx=(12, 0), ipady=5)

        scoring_area = tk.Frame(self.import_content, bg=COLORS["background"])
        scoring_area.pack(fill="both", expand=True, pady=(16, 0))

        scoring_table_frame = tk.Frame(scoring_area, bg=COLORS["background"])
        scoring_table_frame.pack(side="left", fill="both", expand=True)
        tk.Label(
            scoring_table_frame,
            text="PUNTAJES POR POSICIÓN",
            bg=COLORS["background"],
            fg=COLORS["text"],
            font=("Arial", 10, "bold"),
            anchor="w",
        ).pack(fill="x", pady=(0, 7))
        initial_scoring_rows = int(self.driver_row_count.get())
        scoring_data = [
            [f"P{position}", "", "", "", ""]
            for position in range(1, initial_scoring_rows + 1)
        ]
        self.scoring_sheet = Sheet(
            scoring_table_frame,
            data=scoring_data,
            headers=["POSICIÓN", "SPRINT", "FINAL", "QUALY FINAL", "QUALY SPRINT"],
            theme="dark",
            show_row_index=False,
            default_row_height=30,
            default_header_height=34,
            paste_can_expand_y=False,
            paste_can_expand_x=False,
            height=300,
        )
        self.scoring_sheet.pack(fill="both", expand=True)
        self.scoring_sheet.enable_bindings(
            "single_select",
            "drag_select",
            "arrowkeys",
            "edit_cell",
            "copy",
            "cut",
            "paste",
            "delete",
            "undo",
            "ctrl_select",
        )
        self.scoring_sheet.column_width(0, 90)
        self.scoring_sheet.column_width(1, 110)
        self.scoring_sheet.column_width(2, 110)
        self.scoring_sheet.column_width(3, 110)
        self.scoring_sheet.column_width(4, 110)
        self.scoring_sheet["A"].readonly()

        tk.Button(
            self.import_content,
            text="CREAR PLANILLA",
            command=self._load_championship_sheet,
            bg=COLORS["red"],
            activebackground=COLORS["red_hover"],
            fg=COLORS["text"],
            activeforeground=COLORS["text"],
            relief="flat",
            cursor="hand2",
            font=("Arial", 10, "bold"),
            padx=20,
            pady=12,
        ).pack(anchor="w", pady=18)

    def _show_driver_import(self):
        self._dispose_sheet()
        for widget in self.import_content.winfo_children():
            widget.destroy()

        try:
            self.connection = ensure_connection(self.connection)
            drivers = fetch_driver_names(self.connection)
        except Exception as error:
            messagebox.showerror("Error", f"No se pudieron cargar los pilotos.\n\n{error}")
            self._show_championship_selector()
            return

        self.driver_import_existing = {
            self._normalize(driver["nombre"]): driver["nombre"] for driver in drivers
        }
        header = tk.Frame(self.import_content, bg=COLORS["background"])
        header.pack(fill="x", padx=18, pady=(16, 10))
        tk.Button(
            header,
            text="VOLVER",
            command=self._show_championship_selector,
            bg=COLORS["panel"],
            activebackground=COLORS["field"],
            fg=COLORS["text"],
            activeforeground=COLORS["text"],
            relief="flat",
            cursor="hand2",
            padx=14,
            pady=8,
        ).pack(side="left")
        tk.Label(
            header,
            text="AGREGAR PILOTOS",
            bg=COLORS["background"],
            fg=COLORS["text"],
            font=("Arial", 18, "bold"),
        ).pack(side="left", padx=18)
        tk.Button(
            header,
            text="COLUMNAS",
            command=self._edit_driver_import_columns,
            bg=COLORS["panel"],
            activebackground=COLORS["field"],
            fg=COLORS["text"],
            activeforeground=COLORS["text"],
            relief="flat",
            cursor="hand2",
            padx=14,
            pady=8,
        ).pack(side="right")

        tk.Label(
            self.import_content,
            text="Pegá filas o columnas desde Excel. Las celdas sin completar se guardan vacías.",
            bg=COLORS["background"],
            fg=COLORS["muted"],
            font=("Arial", 10),
            anchor="w",
        ).pack(fill="x", padx=18, pady=(0, 10))

        self.driver_import_sheet = Sheet(
            self.import_content,
            data=[["", "", "", "", "ar", "", ""] for _ in range(50)],
            headers=["NOMBRE", "LOCALIDAD", "PROVINCIA", "TELÉFONO", "NACIONALIDAD", "STEAM", "ESTADO"],
            theme="dark",
            show_row_index=True,
            default_row_height=32,
            default_header_height=36,
            paste_can_expand_y=True,
            paste_can_expand_x=False,
        )
        self.driver_import_sheet.pack(fill="both", expand=True, padx=18)
        self.driver_import_sheet.enable_bindings(
            "single_select", "drag_select", "arrowkeys", "edit_cell", "copy",
            "cut", "paste", "delete", "undo", "ctrl_select",
        )
        for column, width in enumerate((280, 180, 180, 150, 130, 190, 240)):
            self.driver_import_sheet.column_width(column, width)
        self.driver_import_sheet["G"].readonly()
        self.driver_import_sheet.bind("<<SheetModified>>", self._refresh_driver_import_states)
        self._apply_driver_import_columns(redraw=False)

        footer = tk.Frame(self.import_content, bg=COLORS["background"])
        footer.pack(fill="x", padx=18, pady=14)
        self.driver_import_status = tk.Label(
            footer,
            text="Ingresá o pegá los nombres para comprobarlos.",
            bg=COLORS["background"],
            fg=COLORS["muted"],
            font=("Arial", 10),
        )
        self.driver_import_status.pack(side="left")
        tk.Button(
            footer,
            text="GUARDAR PILOTOS",
            command=self._save_driver_import,
            bg=COLORS["red"],
            activebackground=COLORS["red_hover"],
            fg=COLORS["text"],
            activeforeground=COLORS["text"],
            relief="flat",
            cursor="hand2",
            font=("Arial", 10, "bold"),
            padx=20,
            pady=10,
        ).pack(side="right")

    def _read_driver_import_rows(self):
        drivers = []
        seen = set()
        for row in self.driver_import_sheet.data:
            raw_name = str(row[0] if row else "").strip()
            if not raw_name:
                continue
            name = " ".join(part.capitalize() for part in raw_name.split())
            key = self._normalize(name)
            if key not in seen:
                values = list(row) + [""] * (7 - len(row))
                drivers.append({
                    "nombre": name,
                    "localidad": " ".join(part.capitalize() for part in str(values[1]).strip().split()),
                    "provincia": " ".join(part.capitalize() for part in str(values[2]).strip().split()),
                    "telefono": "".join(character for character in str(values[3]) if character.isdigit()),
                    "nacionalidad": str(values[4]).strip().lower(),
                    "steam": str(values[5]).strip(),
                })
                seen.add(key)
        return drivers

    def _apply_driver_import_columns(self, redraw=True):
        if not self.driver_import_sheet:
            return
        ordered_columns = [
            column for column in self.driver_import_column_order
            if column in self.driver_import_visible_columns
        ]
        self.driver_import_sheet.display_columns(
            columns=ordered_columns,
            all_columns_displayed=False,
            redraw=False,
        )
        self.driver_import_sheet.MT.displayed_columns = ordered_columns
        self.driver_import_sheet.MT.reset_col_positions()
        if redraw:
            self.driver_import_sheet.redraw()

    def _edit_driver_import_columns(self):
        labels = {
            0: "NOMBRE",
            1: "LOCALIDAD",
            2: "PROVINCIA",
            3: "TELÉFONO",
            4: "NACIONALIDAD",
            5: "STEAM",
            6: "ESTADO",
        }
        order = list(self.driver_import_column_order)
        visible = {
            column: tk.BooleanVar(value=column in self.driver_import_visible_columns)
            for column in labels
        }

        dialog = tk.Toplevel(self)
        dialog.title("Columnas de pilotos")
        dialog.configure(bg=COLORS["panel"])
        dialog.resizable(False, False)
        dialog.transient(self)
        dialog.grab_set()

        tk.Label(
            dialog,
            text="COLUMNAS VISIBLES Y ORDEN",
            bg=COLORS["panel"],
            fg=COLORS["text"],
            font=("Arial", 11, "bold"),
        ).pack(anchor="w", padx=18, pady=(18, 10))

        content = tk.Frame(dialog, bg=COLORS["panel"])
        content.pack(fill="both", expand=True, padx=18)

        def move(column, direction):
            current_index = order.index(column)
            new_index = current_index + direction
            if not 0 <= new_index < len(order):
                return
            order[current_index], order[new_index] = order[new_index], order[current_index]
            refresh_rows()

        def refresh_rows():
            for widget in content.winfo_children():
                widget.destroy()
            for index, column in enumerate(order):
                row = tk.Frame(content, bg=COLORS["field"], padx=8, pady=5)
                row.pack(fill="x", pady=2)
                tk.Checkbutton(
                    row,
                    text=labels[column],
                    variable=visible[column],
                    bg=COLORS["field"],
                    activebackground=COLORS["field"],
                    fg=COLORS["text"],
                    activeforeground=COLORS["text"],
                    selectcolor=COLORS["panel"],
                    font=("Arial", 9, "bold"),
                    anchor="w",
                ).pack(side="left", fill="x", expand=True)
                tk.Button(
                    row,
                    text="▼",
                    command=lambda value=column: move(value, 1),
                    state="normal" if index < len(order) - 1 else "disabled",
                    bg=COLORS["panel"],
                    activebackground=COLORS["border"],
                    fg=COLORS["text"],
                    relief="flat",
                    width=3,
                ).pack(side="right", padx=(4, 0))
                tk.Button(
                    row,
                    text="▲",
                    command=lambda value=column: move(value, -1),
                    state="normal" if index > 0 else "disabled",
                    bg=COLORS["panel"],
                    activebackground=COLORS["border"],
                    fg=COLORS["text"],
                    relief="flat",
                    width=3,
                ).pack(side="right")

        def apply_columns():
            selected = [column for column in order if visible[column].get()]
            if not selected:
                messagebox.showwarning("Sin columnas", "Seleccioná al menos una columna.", parent=dialog)
                return
            self.driver_import_column_order = order
            self.driver_import_visible_columns = selected
            self._apply_driver_import_columns()
            dialog.destroy()

        refresh_rows()
        tk.Button(
            dialog,
            text="APLICAR",
            command=apply_columns,
            bg=COLORS["red"],
            activebackground=COLORS["red_hover"],
            fg=COLORS["text"],
            relief="flat",
            padx=18,
            pady=9,
        ).pack(anchor="e", padx=18, pady=18)

    def _refresh_driver_import_states(self, _event=None):
        if not self.driver_import_sheet or not self.driver_import_sheet.winfo_exists():
            return
        seen = set()
        new_count = 0
        skipped_count = 0
        for row_index, row in enumerate(self.driver_import_sheet.data):
            raw_name = str(row[0] if row else "").strip()
            while len(row) < 7:
                row.append("")
            for column in range(7):
                self.driver_import_sheet.dehighlight_cells(row=row_index, column=column, redraw=False)
            nationality = str(row[4]).strip().lower() or "ar"
            self.driver_import_sheet.set_cell_data(row_index, 4, nationality, redraw=False)
            if not raw_name:
                self.driver_import_sheet.set_cell_data(row_index, 6, "", redraw=False)
                continue
            name = " ".join(part.capitalize() for part in raw_name.split())
            key = self._normalize(name)
            self.driver_import_sheet.set_cell_data(row_index, 0, name, redraw=False)
            self.driver_import_sheet.set_cell_data(
                row_index, 1,
                " ".join(part.capitalize() for part in str(row[1]).strip().split()),
                redraw=False,
            )
            self.driver_import_sheet.set_cell_data(
                row_index, 2,
                " ".join(part.capitalize() for part in str(row[2]).strip().split()),
                redraw=False,
            )
            self.driver_import_sheet.set_cell_data(
                row_index, 3,
                "".join(character for character in str(row[3]) if character.isdigit()),
                redraw=False,
            )
            if key in self.driver_import_existing:
                self.driver_import_sheet.set_cell_data(row_index, 6, f"YA EXISTE: {self.driver_import_existing[key]}", redraw=False)
                for column in range(7):
                    self.driver_import_sheet.highlight_cells(row=row_index, column=column, bg="#3b1515", fg="#fecaca", redraw=False)
                skipped_count += 1
            elif key in seen:
                self.driver_import_sheet.set_cell_data(row_index, 6, "REPETIDO EN ESTA LISTA", redraw=False)
                for column in range(7):
                    self.driver_import_sheet.highlight_cells(row=row_index, column=column, bg="#3b1515", fg="#fecaca", redraw=False)
                skipped_count += 1
            else:
                self.driver_import_sheet.set_cell_data(row_index, 6, "LISTO PARA AGREGAR", redraw=False)
                for column in range(7):
                    self.driver_import_sheet.highlight_cells(row=row_index, column=column, bg="#123524", fg="#bbf7d0", redraw=False)
                seen.add(key)
                new_count += 1
        self.driver_import_sheet.redraw()
        self.driver_import_status.configure(
            text=f"{new_count} nuevos · {skipped_count} omitidos",
            fg=COLORS["green"] if new_count else COLORS["muted"],
        )

    def _save_driver_import(self):
        self._refresh_driver_import_states()
        drivers = [
            driver for driver in self._read_driver_import_rows()
            if self._normalize(driver["nombre"]) not in self.driver_import_existing
        ]
        if not drivers:
            messagebox.showinfo("Sin pilotos nuevos", "Todos los nombres ya están registrados o la lista está vacía.")
            return
        if not messagebox.askyesno("Confirmar pilotos", f"Se agregarán {len(drivers)} pilotos.\n\n¿Continuar?"):
            return
        self._show_loading("Guardando pilotos", f"Comprobando e insertando {len(drivers)} pilotos en la base de datos...")
        try:
            self.connection = ensure_connection(self.connection)
            inserted, skipped = save_new_drivers(self.connection, drivers)
        except Exception as error:
            self._hide_loading()
            messagebox.showerror("No se guardaron los pilotos", str(error))
            return
        finally:
            self._hide_loading()
        messagebox.showinfo(
            "Pilotos procesados",
            f"Agregados: {len(inserted)}\nOmitidos por repetición: {len(skipped)}",
        )
        self._show_driver_import()

    def _show_registration_import(self):
        self._dispose_sheet()
        for widget in self.import_content.winfo_children():
            widget.destroy()
        self._show_loading("Cargando campeonatos", "Buscando campeonatos disponibles para inscripciones...")
        try:
            self.connection = ensure_connection(self.connection)
            self.registration_championships = fetch_all_championships(self.connection)
        except Exception as error:
            self._hide_loading()
            messagebox.showerror("Error", f"No se pudieron cargar los campeonatos.\n\n{error}")
            self._show_championship_selector()
            return
        finally:
            self._hide_loading()

        header = tk.Frame(self.import_content, bg=COLORS["background"])
        header.pack(fill="x", padx=18, pady=(16, 12))
        tk.Button(
            header, text="VOLVER", command=self._show_championship_selector,
            bg=COLORS["panel"], activebackground=COLORS["field"], fg=COLORS["text"],
            activeforeground=COLORS["text"], relief="flat", cursor="hand2", padx=14, pady=8,
        ).pack(side="left")
        tk.Label(
            header, text="AGREGAR INSCRIPTOS", bg=COLORS["background"],
            fg=COLORS["text"], font=("Arial", 18, "bold"),
        ).pack(side="left", padx=18)

        selector = tk.Frame(self.import_content, bg=COLORS["background"])
        selector.pack(fill="x", padx=18, pady=(0, 12))
        labels = [
            f'{row["id"]} · {row["categoria"]} · T{row["temporada"]} · {row["anio"]}'
            for row in self.registration_championships
        ]
        ttk.Combobox(
            selector, textvariable=self.registration_championship_value,
            values=labels, state="readonly", font=("Arial", 11),
        ).pack(side="left", fill="x", expand=True, ipady=6)
        tk.Label(
            selector, text="CANTIDAD DE PILOTOS", bg=COLORS["background"],
            fg=COLORS["muted"], font=("Arial", 8, "bold"),
        ).pack(side="left", padx=(14, 7))
        ttk.Spinbox(
            selector, from_=1, to=500, textvariable=self.registration_driver_count,
            width=7, font=("Arial", 11),
        ).pack(side="left", ipady=5)
        tk.Button(
            selector, text="CARGAR", command=self._load_registration_sheet,
            bg=COLORS["red"], activebackground=COLORS["red_hover"], fg=COLORS["text"],
            relief="flat", cursor="hand2", font=("Arial", 9, "bold"), padx=18, pady=10,
        ).pack(side="left", padx=(10, 0))

        self.registration_sheet_container = tk.Frame(self.import_content, bg=COLORS["background"])
        self.registration_sheet_container.pack(fill="both", expand=True, padx=18)

    def _load_registration_sheet(self):
        championship = next(
            (
                row for row in self.registration_championships
                if self.registration_championship_value.get().startswith(f'{row["id"]} ·')
            ),
            None,
        )
        if not championship:
            messagebox.showwarning("Campeonato", "Seleccioná un campeonato.")
            return
        try:
            row_count = int(self.registration_driver_count.get())
            if not 1 <= row_count <= 500:
                raise ValueError
        except ValueError:
            messagebox.showwarning("Cantidad inválida", "Ingresá entre 1 y 500 pilotos.")
            return
        self._show_loading("Preparando inscriptos", "Consultando pilotos, autos y categoría del campeonato...")
        try:
            self.connection = ensure_connection(self.connection)
            self.registration_context = fetch_registration_context(self.connection, championship["id"])
        except Exception as error:
            self._hide_loading()
            messagebox.showerror("Error", f"No se pudieron preparar los inscriptos.\n\n{error}")
            return
        finally:
            self._hide_loading()
        self.registration_championship_id = championship["id"]
        for widget in self.registration_sheet_container.winfo_children():
            widget.destroy()

        self.registration_import_sheet = Sheet(
            self.registration_sheet_container,
            data=[["", "", "", True, ""] for _ in range(row_count)],
            headers=["PILOTO", "AUTO", "NÚMERO", "PAGO", "ESTADO"],
            theme="dark", show_row_index=True, default_row_height=32,
            default_header_height=38, paste_can_expand_y=True, paste_can_expand_x=False,
        )
        self.registration_import_sheet.pack(fill="both", expand=True)
        self.registration_import_sheet.enable_bindings(
            "single_select", "drag_select", "arrowkeys", "edit_cell", "copy",
            "cut", "paste", "delete", "undo", "ctrl_select",
        )
        for column, width in enumerate((300, 300, 100, 80, 250)):
            self.registration_import_sheet.column_width(column, width)
        self.registration_import_sheet.dropdown(
            "A", values=[item["nombre"] for item in self.registration_context["drivers"]],
            state="normal", validate_input=False,
        )
        self.registration_import_sheet.dropdown(
            "B", values=[f'{item["marca"]} {item["modelo"]}' for item in self.registration_context["cars"]],
            state="normal", validate_input=False,
        )
        self.registration_import_sheet.checkbox("D", checked=True)
        self.registration_import_sheet["E"].readonly()
        self.registration_import_sheet.bind("<<SheetModified>>", self._refresh_registration_states)

        footer = tk.Frame(self.registration_sheet_container, bg=COLORS["background"])
        footer.pack(fill="x", pady=12)
        self.registration_import_status = tk.Label(
            footer, text="Pegá los pilotos y seleccioná sus autos.",
            bg=COLORS["background"], fg=COLORS["muted"], font=("Arial", 10),
        )
        self.registration_import_status.pack(side="left")
        tk.Button(
            footer, text="GUARDAR INSCRIPTOS", command=self._save_registration_import,
            bg=COLORS["red"], activebackground=COLORS["red_hover"], fg=COLORS["text"],
            relief="flat", cursor="hand2", font=("Arial", 10, "bold"), padx=20, pady=10,
        ).pack(side="right")

    def _build_registration_import(self):
        driver_map = {self._normalize(item["nombre"]): item for item in self.registration_context["drivers"]}
        car_map = {
            self._normalize(f'{item["marca"]} {item["modelo"]}'): item
            for item in self.registration_context["cars"]
        }
        existing = self.registration_context["registered_driver_ids"]
        seen = set()
        registrations = []
        invalid = 0
        for row_index, row in enumerate(self.registration_import_sheet.data):
            values = list(row) + [""] * (5 - len(row))
            driver_text = str(values[0]).strip()
            car_text = str(values[1]).strip()
            for column in range(5):
                self.registration_import_sheet.dehighlight_cells(row=row_index, column=column, redraw=False)
            if not driver_text and not car_text:
                self.registration_import_sheet.set_cell_data(row_index, 4, "", redraw=False)
                continue
            driver = driver_map.get(self._normalize(driver_text))
            car = car_map.get(self._normalize(car_text))
            if not driver:
                status = "PILOTO NO REGISTRADO"
            elif driver["id"] in existing:
                status = "YA ESTÁ INSCRIPTO"
            elif driver["id"] in seen:
                status = "REPETIDO EN ESTA LISTA"
            elif not car:
                status = "AUTO NO VÁLIDO PARA LA CATEGORÍA"
            else:
                status = "LISTO PARA AGREGAR"
                number_text = "".join(character for character in str(values[2]) if character.isdigit())
                self.registration_import_sheet.set_cell_data(row_index, 0, driver["nombre"], redraw=False)
                self.registration_import_sheet.set_cell_data(row_index, 1, f'{car["marca"]} {car["modelo"]}', redraw=False)
                self.registration_import_sheet.set_cell_data(row_index, 2, number_text, redraw=False)
                registrations.append({
                    "idpiloto": driver["id"], "idauto": car["id"],
                    "numero": int(number_text) if number_text else 0,
                    "pago": 0 if values[3] is False else 1,
                })
                seen.add(driver["id"])
            self.registration_import_sheet.set_cell_data(row_index, 4, status, redraw=False)
            ready = status == "LISTO PARA AGREGAR"
            for column in range(5):
                self.registration_import_sheet.highlight_cells(
                    row=row_index, column=column,
                    bg="#123524" if ready else "#3b1515",
                    fg="#bbf7d0" if ready else "#fecaca", redraw=False,
                )
            if not ready:
                invalid += 1
        self.registration_import_sheet.redraw()
        self.registration_import_status.configure(
            text=f"{len(registrations)} listos · {invalid} omitidos",
            fg=COLORS["green"] if registrations else COLORS["muted"],
        )
        return registrations

    def _refresh_registration_states(self, _event=None):
        if self.registration_import_sheet and self.registration_import_sheet.winfo_exists():
            self._build_registration_import()

    def _save_registration_import(self):
        registrations = self._build_registration_import()
        if not registrations:
            messagebox.showinfo("Sin inscriptos", "No hay filas válidas para guardar.")
            return
        if not messagebox.askyesno("Confirmar inscriptos", f"Se agregarán {len(registrations)} inscriptos.\n\n¿Continuar?"):
            return
        self._show_loading("Guardando inscriptos", f"Validando e insertando {len(registrations)} inscriptos...")
        try:
            self.connection = ensure_connection(self.connection)
            inserted, skipped = save_registrations(
                self.connection, self.registration_championship_id, registrations,
            )
        except Exception as error:
            self._hide_loading()
            messagebox.showerror("No se guardaron los inscriptos", str(error))
            return
        finally:
            self._hide_loading()
        messagebox.showinfo("Inscriptos procesados", f"Agregados: {inserted}\nOmitidos: {skipped}")
        self._load_registration_sheet()

    def _load_championship_sheet(self):
        selected_index = next(
            (
                index
                for index, row in enumerate(self.championships)
                if self.championship_value.get().startswith(f'{row["id"]} ·')
            ),
            None,
        )
        if selected_index is None:
            messagebox.showwarning("Campeonato", "Seleccioná un campeonato.")
            return
        try:
            initial_row_count = int(self.driver_row_count.get())
            if not 1 <= initial_row_count <= 500:
                raise ValueError
        except ValueError:
            messagebox.showwarning("Cantidad inválida", "Ingresá entre 1 y 500 pilotos.")
            return
        try:
            scoring = self._read_scoring_configuration()
        except ValueError as error:
            self._report_error("Puntajes inválidos", error)
            return

        self._show_loading("Creando planilla", "Consultando inscriptos, fechas y configuración del campeonato...")
        try:
            self.connection = ensure_connection(self.connection)
            championship_id = self.championships[selected_index]["id"]
            self.import_context = fetch_import_context(self.connection, championship_id)
            self.import_context["initial_row_count"] = initial_row_count
            self.import_context["scoring"] = scoring
            self.import_context["event_multipliers"] = [
                {"sprint": 1.0, "final": 1.0}
                for _event in self.import_context["events"]
            ]
        except Exception as error:
            self._hide_loading()
            self._report_error("No se pudo preparar la planilla", error)
            return

        if not self.import_context["events"]:
            self._hide_loading()
            messagebox.showwarning("Sin fechas", "El campeonato no tiene fechas cargadas en calendario.")
            return

        try:
            self._render_sheet()
        except Exception as error:
            self._hide_loading()
            self._report_error("Error al crear la planilla", error)
            self._show_championship_selector()
        finally:
            self._hide_loading()

    def _report_error(self, title, error):
        error_detail = traceback.format_exc()
        self._save_error_detail(title, error, error_detail)

    def _schedule_scoring_row_sync(self, *_args):
        if self._scoring_row_job is not None:
            self.after_cancel(self._scoring_row_job)
        self._scoring_row_job = self.after(250, self._sync_scoring_row_count)

    def _sync_scoring_row_count(self):
        self._scoring_row_job = None
        if self.scoring_sheet is None or not self.scoring_sheet.winfo_exists():
            return
        try:
            desired_rows = int(self.driver_row_count.get())
        except ValueError:
            return
        if not 1 <= desired_rows <= 500:
            return

        current_rows = len(self.scoring_sheet.data)
        if desired_rows > current_rows:
            new_rows = [
                [f"P{position}", "", "", "", ""]
                for position in range(current_rows + 1, desired_rows + 1)
            ]
            self.scoring_sheet.insert_rows(
                new_rows,
                idx=current_rows,
                undo=False,
                emit_event=False,
                redraw=True,
            )
        elif desired_rows < current_rows:
            self.scoring_sheet.delete_rows(
                range(desired_rows, current_rows),
                data_indexes=True,
                undo=False,
                emit_event=False,
                redraw=True,
            )

    def _save_error_detail(self, title, error, error_detail):
        error_log = Path(__file__).with_name("importador_error.log")
        timestamp = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
        try:
            with error_log.open("a", encoding="utf-8") as log:
                log.write(f"\n{'=' * 72}\n{timestamp} · {title}\n{error_detail}\n")
        except OSError:
            pass

        try:
            self.clipboard_clear()
            self.clipboard_append(error_detail)
            self.update_idletasks()
        except tk.TclError:
            pass

        messagebox.showerror(
            title,
            "No se pudo construir la planilla.\n\n"
            f"Tipo: {type(error).__name__}\n"
            f"Detalle: {error or '(sin mensaje)'}\n\n"
            "El error completo fue copiado al portapapeles y guardado en:\n"
            f"{error_log}",
        )

    def _read_scoring_configuration(self):
        qualy_sprint_by_points = {}
        qualy_final_by_points = {}
        sprint_by_points = {}
        final_by_points = {}

        def parse_score(value, label):
            if value is None or value is False:
                return None
            text = str(value).strip()
            if text.casefold() in {"", "0", "0.0", "-", "none", "null"}:
                return None
            try:
                numeric_value = float(text.replace(",", "."))
            except ValueError as error:
                raise ValueError(f"{label}: '{text}' no es un puntaje válido.") from error
            if numeric_value < 0:
                raise ValueError(f"{label}: el puntaje no puede ser negativo.")
            return numeric_value

        for position, row in enumerate(self.scoring_sheet.data, start=1):
            for column, target, label in (
                (1, sprint_by_points, "Sprint"),
                (2, final_by_points, "Final"),
                (3, qualy_final_by_points, "Qualy Final"),
                (4, qualy_sprint_by_points, "Qualy Sprint"),
            ):
                points = parse_score(
                    row[column] if len(row) > column else None,
                    f"{label} P{position}",
                )
                if points is None:
                    continue
                target.setdefault(points, []).append(position)

        return {
            "qualy_sprint_by_points": qualy_sprint_by_points,
            "qualy_final_by_points": qualy_final_by_points,
            "sprint_by_points": sprint_by_points,
            "final_by_points": final_by_points,
        }

    def _render_sheet(self):
        for widget in self.import_content.winfo_children():
            widget.destroy()

        championship = self.import_context["championship"]
        toolbar = tk.Frame(self.import_content, bg=COLORS["background"])
        toolbar.pack(fill="x", pady=(0, 14))
        tk.Label(
            toolbar,
            text=f'{championship["categoria"]} · T{championship["temporada"]} · {championship["anio"]}',
            bg=COLORS["background"],
            fg=COLORS["text"],
            font=("Arial", 17, "bold"),
        ).pack(side="left")

        tk.Button(
            toolbar,
            text="SALIR",
            command=self._close_application,
            bg=COLORS["red"],
            activebackground=COLORS["red_hover"],
            fg=COLORS["text"],
            activeforeground=COLORS["text"],
            relief="flat",
            cursor="hand2",
            padx=14,
            pady=8,
        ).pack(side="right", padx=(8, 0))
        self.columns_button = tk.Button(
            toolbar,
            text="COLUMNAS",
            command=self._edit_compact_column_order,
            bg=COLORS["field"],
            activebackground=COLORS["border"],
            fg=COLORS["text"],
            relief="flat",
            cursor="hand2",
            padx=14,
            pady=8,
        )
        self.columns_button.pack(side="right", padx=(8, 0))
        tk.Button(
            toolbar,
            text="MULTIPLICADORES",
            command=self._edit_event_multipliers,
            bg=COLORS["field"],
            activebackground=COLORS["border"],
            fg=COLORS["text"],
            relief="flat",
            cursor="hand2",
            padx=14,
            pady=8,
        ).pack(side="right", padx=(8, 0))
        tk.Button(
            toolbar,
            text="AGREGAR FILA",
            command=self._add_sheet_row,
            bg=COLORS["field"],
            activebackground=COLORS["border"],
            fg=COLORS["text"],
            relief="flat",
            cursor="hand2",
            padx=14,
            pady=8,
        ).pack(side="right")
        tk.Button(
            toolbar,
            text="ELIMINAR FILAS",
            command=self._delete_selected_rows,
            bg=COLORS["field"],
            activebackground=COLORS["border"],
            fg=COLORS["text"],
            relief="flat",
            cursor="hand2",
            padx=14,
            pady=8,
        ).pack(side="right", padx=(0, 8))

        headers = ["ESTADO", "PILOTO", "AUTO", "NÚMERO", "PAGO"]
        for event in self.import_context["events"]:
            date_text = event["fecha"].strftime("%d/%m/%Y") if hasattr(event["fecha"], "strftime") else str(event["fecha"])[:10]
            circuit = event["circuito"]
            if event.get("variante"):
                circuit = f'{circuit} {event["variante"]}'
            headers.extend(
                [
                    f"PRESENTISMO\nF{event['ronda']} · {date_text}",
                    f"POS. QUALY SPRINT\nF{event['ronda']} · {date_text}",
                    f"PUNTOS QUALY SPRINT\nF{event['ronda']} · {date_text}",
                    f'POS. SPRINT\nF{event["ronda"]} · {date_text}\n{circuit}',
                    f"PUNTOS SPRINT\nF{event['ronda']} · {date_text}",
                    f"POS. QUALY FINAL\nF{event['ronda']} · {date_text}",
                    f"PUNTOS QUALY FINAL\nF{event['ronda']} · {date_text}",
                    f"POS. FINAL\nF{event['ronda']} · {date_text}",
                    f"PUNTOS FINAL\nF{event['ronda']} · {date_text}",
                ]
            )
        self.total_points_column = len(headers)
        self.victories_column = len(headers) + 1
        headers.extend(["TOTAL\nPUNTOS", "VICTORIAS"])

        blank_row = ["", "", "", "", True]
        for _event in self.import_context["events"]:
            blank_row.extend(["", "", "", "", "", "", "", "", ""])
        blank_row.extend(["", ""])
        data = [
            list(blank_row)
            for _ in range(self.import_context["initial_row_count"])
        ]

        self.sheet = Sheet(
            self.import_content,
            data=data,
            headers=headers,
            theme="dark",
            show_row_index=True,
            default_row_height=34,
            default_header_height=74,
            default_column_width=105,
            paste_can_expand_y=False,
            paste_can_expand_x=False,
            startup_select=(0, 1, "cells"),
        )
        self.sheet.pack(fill="both", expand=True)
        self.sheet.enable_bindings(
            "single_select",
            "drag_select",
            "select_all",
            "column_select",
            "row_select",
            "column_width_resize",
            "row_height_resize",
            "double_click_column_resize",
            "arrowkeys",
            "up",
            "down",
            "left",
            "right",
            "edit_cell",
            "copy",
            "cut",
            "paste",
            "delete",
            "undo",
            "find",
            "ctrl_select",
            "right_click_popup_menu",
            "delete_rows",
        )
        self.sheet.column_width(0, 75)
        self.sheet.column_width(1, 230)
        self.sheet.column_width(2, 220)
        self.sheet.column_width(3, 80)
        self.sheet.column_width(4, 70)
        self.sheet["A"].readonly()
        self.sheet.dropdown(
            "B",
            values=[item["nombre"] for item in self.import_context["drivers"]],
            state="normal",
            validate_input=False,
        )
        self.sheet.dropdown(
            "C",
            values=[f'{item["marca"]} {item["modelo"]}' for item in self.import_context["cars"]],
            state="normal",
            validate_input=False,
        )
        self.sheet.checkbox("E", checked=True)
        for event_index, _event in enumerate(self.import_context["events"]):
            start_column = 5 + (event_index * 9)
            for offset in (1, 5):
                self.sheet.dropdown(
                    num2alpha(start_column + offset),
                    values=["", "S/TIEMPO", "CUMPLIÓ"],
                    state="normal",
                    validate_input=False,
                )
            for offset in (3, 7):
                self.sheet.dropdown(
                    num2alpha(start_column + offset),
                    values=["", "EXCLUIDO", "ABANDONO", "NO LARGÓ"],
                    state="normal",
                    validate_input=False,
                )
        event_columns_end = 5 + (len(self.import_context["events"]) * 9)
        for column in range(5, event_columns_end):
            self.sheet.column_width(column, 112)
            event_group = (column - 5) // 9
            background = "#181818" if event_group % 2 == 0 else "#242424"
            self.sheet.highlight_cells(column=column, bg=background, fg="#f5f5f5", redraw=False)
            self.sheet.highlight_cells(
                column=column,
                canvas="header",
                bg="#7f1d1d" if event_group % 2 == 0 else "#991b1b",
                fg="#ffffff",
                redraw=False,
            )
        self.sheet.column_width(self.total_points_column, 105)
        self.sheet.column_width(self.victories_column, 95)
        self.sheet[num2alpha(self.total_points_column)].readonly()
        self.sheet[num2alpha(self.victories_column)].readonly()
        self.sheet.highlight_cells(
            column=self.total_points_column,
            bg="#713f12",
            fg="#fde047",
            redraw=False,
        )
        self.sheet.highlight_cells(
            column=self.total_points_column,
            canvas="header",
            bg="#a16207",
            fg="#ffffff",
            redraw=False,
        )
        self.sheet.highlight_cells(
            column=self.victories_column,
            bg="#14532d",
            fg="#4ade80",
            redraw=False,
        )
        self.sheet.highlight_cells(
            column=self.victories_column,
            canvas="header",
            bg="#166534",
            fg="#ffffff",
            redraw=False,
        )
        self.columns_expanded = False
        self._apply_compact_columns(redraw=False)
        self.sheet.bind("<<SheetModified>>", self._on_sheet_modified)
        self.sheet.redraw()
        self.sheet.MT.focus_set()

        actions = tk.Frame(self.import_content, bg=COLORS["background"])
        actions.pack(fill="x", pady=(14, 0))
        self.sheet_status = tk.Label(
            actions,
            text="Completá la planilla y validá los datos antes de guardar.",
            bg=COLORS["background"],
            fg=COLORS["muted"],
            font=("Arial", 10),
            anchor="w",
        )
        self.sheet_status.pack(side="left", fill="x", expand=True)
        tk.Button(
            actions,
            text="VALIDAR",
            command=self._validate_sheet,
            bg=COLORS["field"],
            activebackground=COLORS["border"],
            fg=COLORS["text"],
            relief="flat",
            cursor="hand2",
            font=("Arial", 10, "bold"),
            padx=18,
            pady=10,
        ).pack(side="right", padx=(8, 0))
        self.save_button = tk.Button(
            actions,
            text="GUARDAR TODO",
            command=self._save_sheet,
            state="disabled",
            bg=COLORS["red"],
            activebackground=COLORS["red_hover"],
            disabledforeground=COLORS["muted"],
            fg=COLORS["text"],
            relief="flat",
            cursor="hand2",
            font=("Arial", 10, "bold"),
            padx=18,
            pady=10,
        )
        self.save_button.pack(side="right")

    def _add_sheet_row(self):
        row = ["", "", "", "", True]
        for _event in self.import_context["events"]:
            row.extend(["", "", "", "", "", "", "", "", ""])
        row.extend(["", ""])
        self.sheet.insert_rows([row], undo=True, emit_event=True)

    def _compact_column_indexes(self):
        columns = [0, 1]
        for event_index, _event in enumerate(self.import_context["events"]):
            start_column = 5 + (event_index * 9)
            columns.extend(start_column + offset for offset in self.compact_column_order)
        return columns

    def _edit_compact_column_order(self):
        labels = {
            0: "PRESENTISMO",
            1: "POSICIÓN QUALY SPRINT",
            2: "PUNTOS QUALY SPRINT",
            3: "POSICIÓN SPRINT",
            4: "PUNTOS SPRINT",
            5: "POSICIÓN QUALY FINAL",
            6: "PUNTOS QUALY FINAL",
            7: "POSICIÓN FINAL",
            8: "PUNTOS FINAL",
        }
        order = list(self.compact_column_order) + [
            offset for offset in labels if offset not in self.compact_column_order
        ]
        visible = {
            offset: tk.BooleanVar(value=offset in self.compact_column_order)
            for offset in labels
        }

        dialog = tk.Toplevel(self)
        dialog.title("Orden de columnas")
        dialog.configure(bg=COLORS["panel"])
        dialog.resizable(False, False)
        dialog.transient(self)
        dialog.grab_set()

        tk.Label(
            dialog,
            text="COLUMNAS VISIBLES Y ORDEN",
            bg=COLORS["panel"],
            fg=COLORS["text"],
            font=("Arial", 11, "bold"),
        ).pack(anchor="w", padx=18, pady=(18, 10))

        content = tk.Frame(dialog, bg=COLORS["panel"])
        content.pack(fill="both", expand=True, padx=18)

        def move(offset, direction):
            current_index = order.index(offset)
            new_index = current_index + direction
            if not 0 <= new_index < len(order):
                return
            order[current_index], order[new_index] = order[new_index], order[current_index]
            refresh_rows()

        def refresh_rows():
            for widget in content.winfo_children():
                widget.destroy()
            for index, offset in enumerate(order):
                row = tk.Frame(content, bg=COLORS["field"], padx=8, pady=5)
                row.pack(fill="x", pady=2)
                tk.Checkbutton(
                    row,
                    text=labels[offset],
                    variable=visible[offset],
                    bg=COLORS["field"],
                    activebackground=COLORS["field"],
                    fg=COLORS["text"],
                    activeforeground=COLORS["text"],
                    selectcolor=COLORS["panel"],
                    font=("Arial", 9, "bold"),
                    anchor="w",
                ).pack(side="left", fill="x", expand=True)
                tk.Button(
                    row,
                    text="▼",
                    command=lambda value=offset: move(value, 1),
                    state="normal" if index < len(order) - 1 else "disabled",
                    bg=COLORS["panel"],
                    activebackground=COLORS["border"],
                    fg=COLORS["text"],
                    relief="flat",
                    width=3,
                ).pack(side="right", padx=(4, 0))
                tk.Button(
                    row,
                    text="▲",
                    command=lambda value=offset: move(value, -1),
                    state="normal" if index > 0 else "disabled",
                    bg=COLORS["panel"],
                    activebackground=COLORS["border"],
                    fg=COLORS["text"],
                    relief="flat",
                    width=3,
                ).pack(side="right")

        def select_all(value):
            for variable in visible.values():
                variable.set(value)

        selection_actions = tk.Frame(dialog, bg=COLORS["panel"])
        selection_actions.pack(fill="x", padx=18, pady=(10, 0))
        for text, value in (("MARCAR TODAS", True), ("OCULTAR TODAS", False)):
            tk.Button(
                selection_actions,
                text=text,
                command=lambda checked=value: select_all(checked),
                bg=COLORS["field"],
                activebackground=COLORS["border"],
                fg=COLORS["text"],
                relief="flat",
                padx=10,
                pady=7,
            ).pack(side="left", padx=(0, 7))

        def apply_order():
            selected_order = [offset for offset in order if visible[offset].get()]
            if not selected_order:
                messagebox.showwarning(
                    "Sin columnas",
                    "Seleccioná al menos una columna para mostrar.",
                    parent=dialog,
                )
                return
            self.compact_column_order = selected_order
            self.columns_expanded = False
            self._apply_compact_columns(redraw=True)
            if self.columns_button:
                self.columns_button.configure(text="COLUMNAS")
            dialog.destroy()

        refresh_rows()
        tk.Button(
            dialog,
            text="APLICAR",
            command=apply_order,
            bg=COLORS["red"],
            activebackground=COLORS["red_hover"],
            fg=COLORS["text"],
            relief="flat",
            padx=18,
            pady=9,
        ).pack(anchor="e", padx=18, pady=18)

    def _edit_event_multipliers(self):
        if not self.import_context:
            return

        dialog = tk.Toplevel(self)
        dialog.title("Multiplicadores por fecha")
        dialog.configure(bg=COLORS["panel"])
        dialog.resizable(False, True)
        dialog.transient(self)
        dialog.grab_set()

        tk.Label(
            dialog,
            text="MULTIPLICADORES DE SPRINT Y FINAL POR FECHA",
            bg=COLORS["panel"],
            fg=COLORS["text"],
            font=("Arial", 11, "bold"),
        ).pack(anchor="w", padx=18, pady=(18, 12))

        entries = []
        multipliers = self.import_context["event_multipliers"]
        for index, event in enumerate(self.import_context["events"]):
            row = tk.Frame(dialog, bg=COLORS["panel"])
            row.pack(fill="x", padx=18, pady=4)
            date_text = event["fecha"].strftime("%d/%m/%Y") if hasattr(event["fecha"], "strftime") else str(event["fecha"])[:10]
            tk.Label(
                row,
                text=f'F{event["ronda"]} · {date_text} · {event["circuito"]}',
                width=40,
                anchor="w",
                bg=COLORS["panel"],
                fg=COLORS["text"],
            ).pack(side="left")
            final_variable = tk.StringVar(value=str(multipliers[index]["final"]).replace(".", ","))
            sprint_variable = tk.StringVar(value=str(multipliers[index]["sprint"]).replace(".", ","))
            ttk.Entry(row, textvariable=final_variable, width=8).pack(side="right", ipady=4)
            tk.Label(row, text="FINAL", bg=COLORS["panel"], fg=COLORS["muted"]).pack(side="right", padx=(10, 5))
            ttk.Entry(row, textvariable=sprint_variable, width=8).pack(side="right", ipady=4)
            tk.Label(row, text="SPRINT", bg=COLORS["panel"], fg=COLORS["muted"]).pack(side="right", padx=(10, 5))
            entries.append((sprint_variable, final_variable))

        def save_multipliers():
            try:
                values = [
                    {
                        "sprint": float(sprint.get().strip().replace(",", ".")),
                        "final": float(final.get().strip().replace(",", ".")),
                    }
                    for sprint, final in entries
                ]
                if any(item["sprint"] <= 0 or item["final"] <= 0 for item in values):
                    raise ValueError
            except ValueError:
                messagebox.showwarning("Multiplicador inválido", "Usá valores mayores a cero, por ejemplo 1, 1,5 o 2.", parent=dialog)
                return
            self.import_context["event_multipliers"] = values
            dialog.destroy()
            self._refresh_driver_states()

        tk.Button(
            dialog,
            text="APLICAR",
            command=save_multipliers,
            bg=COLORS["red"],
            activebackground=COLORS["red_hover"],
            fg=COLORS["text"],
            relief="flat",
            padx=18,
            pady=9,
        ).pack(anchor="e", padx=18, pady=18)

    @staticmethod
    def _position_for_points(points_map, points, multiplier):
        if not points or multiplier <= 0:
            return ""
        base_points = round(points / multiplier, 6)
        for configured_points, positions in points_map.items():
            if abs(float(configured_points) - base_points) < 0.000001:
                return positions[0]
        return ""

    def _apply_compact_columns(self, redraw=True):
        if not self.sheet:
            return
        ordered_columns = self._compact_column_indexes()
        self.sheet.display_columns(
            columns=ordered_columns,
            all_columns_displayed=False,
            redraw=False,
        )
        # tksheet ordena los índices internamente; reemplazamos solo su mapa
        # visual para respetar la disposición elegida sin mover los datos.
        self.sheet.MT.displayed_columns = ordered_columns
        self.sheet.MT.reset_col_positions()
        if redraw:
            self.sheet.redraw()

    def _toggle_sheet_columns(self):
        if not self.sheet:
            return
        self.columns_expanded = not self.columns_expanded
        if self.columns_expanded:
            self.sheet.display_columns("all", redraw=True)
            self.columns_button.configure(text="OCULTAR COLUMNAS")
        else:
            self._apply_compact_columns(redraw=True)
            self.columns_button.configure(text="COLUMNAS")

    def _restart_application(self):
        if not messagebox.askyesno(
            "Reiniciar importador",
            "Se descartarán todos los datos cargados en la planilla.\n\n¿Continuar?",
        ):
            return

        self._dispose_sheet()
        if self.connection and self.connection.is_connected():
            self.connection.close()
        self.connection = None
        self.championships = []
        self.import_context = None
        self.import_rows = []
        self.columns_expanded = False
        self.championship_value.set("")
        self.driver_row_count.set("30")
        self.status.set("Iniciando conexión con la base de datos...")
        self._show_connection_screen()
        self.after(150, self._start_connection_test)

    def _delete_selected_rows(self):
        rows = sorted(self.sheet.get_selected_rows(get_cells_as_rows=True))
        if not rows:
            messagebox.showwarning("Eliminar filas", "Seleccioná una o más filas.")
            return
        self.sheet.delete_rows(rows, undo=True, emit_event=True)

    def _on_sheet_modified(self, _event=None):
        if hasattr(self, "save_button"):
            self.save_button.configure(state="disabled")
        if hasattr(self, "sheet_status"):
            self.sheet_status.configure(
                text="Hay cambios sin validar.",
                fg=COLORS["muted"],
            )
        if self._pilot_validation_job is not None:
            self.after_cancel(self._pilot_validation_job)
        self._pilot_validation_job = self.after_idle(self._refresh_driver_states)

    def _refresh_driver_states(self):
        self._pilot_validation_job = None
        if self.sheet is None or not self.sheet.winfo_exists() or not self.import_context:
            return

        driver_map = {
            self._normalize(item["nombre"]): item
            for item in self.import_context["drivers"]
        }
        matches = 0
        missing = 0
        scoring = self.import_context["scoring"]
        for row_index, row in enumerate(self.sheet.data):
            for column in range(5, self.total_points_column):
                if str(row[column]).strip() == "-":
                    self.sheet.set_cell_data(row_index, column, "", redraw=False)
            numeric_columns = [3, *range(5, self.total_points_column)]
            for column in numeric_columns:
                if str(row[column]).strip() == "0":
                    self.sheet.set_cell_data(row_index, column, "", redraw=False)

            for event_index, _event in enumerate(self.import_context["events"]):
                start_column = 5 + (event_index * 9)
                multipliers = self.import_context["event_multipliers"][event_index]
                try:
                    qualy_sprint_points = self._number(row[start_column + 2], "puntos Qualy Sprint", 0)
                except ValueError:
                    qualy_sprint_points = 0
                try:
                    sprint_points = self._number(row[start_column + 4], "puntos Sprint", 0)
                except ValueError:
                    sprint_points = 0
                try:
                    qualy_final_points = self._number(row[start_column + 6], "puntos Qualy Final", 0)
                except ValueError:
                    qualy_final_points = 0
                try:
                    final_points = self._number(row[start_column + 8], "puntos Final", 0)
                except ValueError:
                    final_points = 0

                if qualy_sprint_points:
                    self.sheet.set_cell_data(
                        row_index,
                        start_column + 1,
                        self._position_for_points(
                            scoring["qualy_sprint_by_points"],
                            qualy_sprint_points,
                            1,
                        ),
                        redraw=False,
                    )
                if sprint_points:
                    self.sheet.set_cell_data(
                        row_index,
                        start_column + 3,
                        self._position_for_points(
                            scoring["sprint_by_points"],
                            sprint_points,
                            multipliers["sprint"],
                        ),
                        redraw=False,
                    )
                if qualy_final_points:
                    self.sheet.set_cell_data(
                        row_index,
                        start_column + 5,
                        self._position_for_points(
                            scoring["qualy_final_by_points"],
                            qualy_final_points,
                            1,
                        ),
                        redraw=False,
                    )
                if final_points:
                    self.sheet.set_cell_data(
                        row_index,
                        start_column + 7,
                        self._position_for_points(
                            scoring["final_by_points"],
                            final_points,
                            multipliers["final"],
                        ),
                        redraw=False,
                    )

            total_points = 0
            victories = 0
            for event_index, _event in enumerate(self.import_context["events"]):
                start_column = 5 + (event_index * 9)
                for points_offset in (0, 2, 4, 6, 8):
                    try:
                        value = row[start_column + points_offset]
                        if points_offset in (4, 8):
                            total_points += self._number(value or "0", "puntos", 0)
                        else:
                            total_points += self._integer(str(value).strip() or "0", "puntos", 0)
                    except ValueError:
                        pass
                try:
                    if int(str(row[start_column + 7]).strip() or "0") == 1:
                        victories += 1
                except ValueError:
                    pass
            self.sheet.set_cell_data(
                row_index,
                self.total_points_column,
                total_points if total_points else "",
                redraw=False,
            )
            self.sheet.set_cell_data(
                row_index,
                self.victories_column,
                victories if victories else "",
                redraw=False,
            )

            driver_text = str(row[1] if len(row) > 1 else "").strip()
            self.sheet.dehighlight_cells(row=row_index, column=0, redraw=False)
            if not driver_text:
                self.sheet.set_cell_data(row_index, 0, "", redraw=False)
                continue

            driver = driver_map.get(self._normalize(driver_text))
            if driver:
                canonical_name = driver["nombre"]
                if driver_text != canonical_name:
                    self.sheet.set_cell_data(row_index, 1, canonical_name, redraw=False)
                self.sheet.set_cell_data(row_index, 0, "✓", redraw=False)
                self.sheet.highlight_cells(
                    row=row_index,
                    column=0,
                    bg="#14532d",
                    fg="#ffffff",
                    redraw=False,
                )
                matches += 1
            else:
                capitalized_name = " ".join(part.capitalize() for part in driver_text.split())
                if driver_text != capitalized_name:
                    self.sheet.set_cell_data(row_index, 1, capitalized_name, redraw=False)
                self.sheet.set_cell_data(row_index, 0, "✕", redraw=False)
                self.sheet.highlight_cells(
                    row=row_index,
                    column=0,
                    bg="#7f1d1d",
                    fg="#ffffff",
                    redraw=False,
                )
                missing += 1

        self.sheet.redraw()
        if matches or missing:
            self.sheet_status.configure(
                text=f"{matches} pilotos encontrados · {missing} sin coincidencia.",
                fg=COLORS["green"] if not missing else COLORS["red_hover"],
            )

    def _dispose_sheet(self):
        if self._pilot_validation_job is not None:
            self.after_cancel(self._pilot_validation_job)
            self._pilot_validation_job = None
        if self.sheet is not None:
            try:
                self.sheet.unbind("<<SheetModified>>")
                self.sheet.destroy()
            except tk.TclError:
                pass
            self.sheet = None
        if self.driver_import_sheet is not None:
            try:
                self.driver_import_sheet.unbind("<<SheetModified>>")
                self.driver_import_sheet.destroy()
            except tk.TclError:
                pass
            self.driver_import_sheet = None
        if self.registration_import_sheet is not None:
            try:
                self.registration_import_sheet.unbind("<<SheetModified>>")
                self.registration_import_sheet.destroy()
            except tk.TclError:
                pass
            self.registration_import_sheet = None

    def _header_cell(self, text, column, width=14, row=0, columnspan=1, rowspan=1):
        tk.Label(
            self.sheet_frame,
            text=text,
            bg=COLORS["field"],
            fg=COLORS["text"],
            font=("Arial", 9, "bold"),
            width=width,
            padx=7,
            pady=9,
            highlightbackground=COLORS["border"],
            highlightthickness=1,
        ).grid(
            row=row,
            column=column,
            columnspan=columnspan,
            rowspan=rowspan,
            sticky="nsew",
        )

    def _render_headers(self):
        self._header_cell("ESTADO", 0, 8, rowspan=2)
        self._header_cell("PILOTO", 1, 25, rowspan=2)
        self._header_cell("AUTO", 2, 24, rowspan=2)
        self._header_cell("NÚMERO", 3, 8, rowspan=2)
        self._header_cell("PAGO", 4, 7, rowspan=2)

        column = 5
        for event in self.import_context["events"]:
            date_text = event["fecha"].strftime("%d/%m/%Y") if hasattr(event["fecha"], "strftime") else str(event["fecha"])[:10]
            circuit = event["circuito"]
            if event.get("variante"):
                circuit = f'{circuit} {event["variante"]}'
            self._header_cell(
                f'FECHA {event["ronda"]} · {date_text} · {circuit}',
                column,
                14,
                row=0,
                columnspan=4,
            )
            self._header_cell("POSICIÓN", column, 10, row=1)
            self._header_cell("PRESENT.", column + 1, 10, row=1)
            self._header_cell("SPRINT", column + 2, 9, row=1)
            self._header_cell("FINAL", column + 3, 9, row=1)
            column += 4

    def _add_import_row(self):
        row_index = len(self.import_rows)
        grid_row = row_index + 2
        driver = tk.StringVar()
        car = tk.StringVar()
        number = tk.StringVar(value="0")
        paid = tk.BooleanVar(value=True)
        event_values = []

        status_label = tk.Label(
            self.sheet_frame,
            text="—",
            bg=COLORS["panel"],
            fg=COLORS["muted"],
            font=("Arial", 14, "bold"),
            width=8,
        )
        status_label.grid(row=grid_row, column=0, sticky="nsew", padx=1, pady=1)

        driver_entry = ttk.Combobox(
            self.sheet_frame,
            textvariable=driver,
            values=[item["nombre"] for item in self.import_context["drivers"]],
            width=28,
        )
        driver_entry.grid(row=grid_row, column=1, sticky="nsew", padx=1, pady=1, ipady=5)

        car_entry = ttk.Combobox(
            self.sheet_frame,
            textvariable=car,
            values=[f'{item["marca"]} {item["modelo"]}' for item in self.import_context["cars"]],
            width=27,
        )
        car_entry.grid(row=grid_row, column=2, sticky="nsew", padx=1, pady=1, ipady=5)
        number_entry = ttk.Entry(self.sheet_frame, textvariable=number, width=8)
        number_entry.grid(row=grid_row, column=3, sticky="nsew", padx=1, pady=1, ipady=5)
        tk.Checkbutton(
            self.sheet_frame,
            variable=paid,
            bg=COLORS["panel"],
            activebackground=COLORS["panel"],
            selectcolor=COLORS["field"],
            fg=COLORS["text"],
        ).grid(row=grid_row, column=4, sticky="nsew", padx=1, pady=1)

        column = 5
        paste_variables = [driver, car, number]
        paste_widgets = [driver_entry, car_entry, number_entry]
        for _event in self.import_context["events"]:
            values = {
                "posicion": tk.StringVar(),
                "presentismo": tk.StringVar(value="0"),
                "sprint": tk.StringVar(value="0"),
                "final": tk.StringVar(value="0"),
            }
            event_values.append(values)
            for key, width in (("posicion", 9), ("presentismo", 8), ("sprint", 8), ("final", 8)):
                entry = ttk.Entry(self.sheet_frame, textvariable=values[key], width=width)
                entry.grid(row=grid_row, column=column, sticky="nsew", padx=1, pady=1, ipady=5)
                paste_variables.append(values[key])
                paste_widgets.append(entry)
                column += 1

        row = {
            "status": status_label,
            "driver": driver,
            "car": car,
            "number": number,
            "paid": paid,
            "events": event_values,
            "paste_variables": paste_variables,
        }
        self.import_rows.append(row)
        for paste_column, widget in enumerate(paste_widgets):
            widget.bind(
                "<Control-v>",
                lambda event, current_row=row_index, current_column=paste_column:
                    self._paste_grid_from_clipboard(event, current_row, current_column),
            )
            widget.bind(
                "<Control-V>",
                lambda event, current_row=row_index, current_column=paste_column:
                    self._paste_grid_from_clipboard(event, current_row, current_column),
            )
        for variable in (driver, car, number, paid):
            variable.trace_add("write", lambda *_args, current_row=row: self._invalidate_row(current_row))
        for event_values_row in event_values:
            for variable in event_values_row.values():
                variable.trace_add("write", lambda *_args, current_row=row: self._invalidate_row(current_row))

    def _invalidate_sheet(self):
        if hasattr(self, "save_button"):
            self.save_button.configure(state="disabled")

    def _invalidate_row(self, row):
        row["status"].configure(text="—", fg=COLORS["muted"])
        self._invalidate_sheet()

    def _paste_drivers_from_clipboard(self):
        try:
            clipboard_text = self.clipboard_get()
        except tk.TclError:
            messagebox.showwarning(
                "Portapapeles vacío",
                "Copiá primero la columna de pilotos desde Excel.",
            )
            return

        names = []
        for line in clipboard_text.splitlines():
            cells = [cell.strip() for cell in line.split("\t")]
            name = next((cell for cell in cells if cell), "")
            if not name:
                continue
            if self._normalize(name) in {"piloto", "pilotos", "nombre", "nombres"}:
                continue
            names.append(name)

        if not names:
            messagebox.showwarning(
                "Sin pilotos",
                "No se encontraron nombres en los datos copiados desde Excel.",
            )
            return

        while len(self.import_rows) < len(names):
            self._add_import_row()

        driver_map = {
            self._normalize(item["nombre"]): item
            for item in self.import_context["drivers"]
        }
        matches = 0
        for index, row in enumerate(self.import_rows):
            if index >= len(names):
                row["driver"].set("")
                row["status"].configure(text="—", fg=COLORS["muted"])
                continue

            name = names[index]
            row["driver"].set(name)
            if self._normalize(name) in driver_map:
                row["status"].configure(text="✓", fg=COLORS["green"])
                matches += 1
            else:
                row["status"].configure(text="✕", fg=COLORS["red_hover"])

        missing = len(names) - matches
        self.save_button.configure(state="disabled")
        if missing:
            self.sheet_status.configure(
                text=f"{matches} pilotos encontrados · {missing} sin coincidencia.",
                fg=COLORS["red_hover"],
            )
            messagebox.showwarning(
                "Pilotos pegados",
                f"Se pegaron {len(names)} pilotos.\n\n"
                f"Coincidencias: {matches}\n"
                f"Sin coincidencia: {missing}\n\n"
                "Corregí los nombres marcados con X roja.",
            )
        else:
            self.sheet_status.configure(
                text=f"{matches} pilotos pegados y encontrados correctamente.",
                fg=COLORS["green"],
            )

    def _paste_grid_from_clipboard(self, _event, start_row, start_column):
        try:
            clipboard_text = self.clipboard_get()
        except tk.TclError:
            return "break"

        clipboard_rows = [
            line.rstrip("\r").split("\t")
            for line in clipboard_text.splitlines()
        ]
        if not clipboard_rows:
            return "break"

        required_rows = start_row + len(clipboard_rows)
        while len(self.import_rows) < required_rows:
            self._add_import_row()

        changed_driver_rows = set()
        for row_offset, clipboard_row in enumerate(clipboard_rows):
            target_row_index = start_row + row_offset
            variables = self.import_rows[target_row_index]["paste_variables"]
            for column_offset, value in enumerate(clipboard_row):
                target_column = start_column + column_offset
                if target_column >= len(variables):
                    continue
                variables[target_column].set(value.strip())
                if target_column == 0:
                    changed_driver_rows.add(target_row_index)

        if changed_driver_rows:
            driver_map = {
                self._normalize(item["nombre"]): item
                for item in self.import_context["drivers"]
            }
            matches = 0
            for row_index in changed_driver_rows:
                row = self.import_rows[row_index]
                if self._normalize(row["driver"].get()) in driver_map:
                    row["status"].configure(text="✓", fg=COLORS["green"])
                    matches += 1
                else:
                    row["status"].configure(text="✕", fg=COLORS["red_hover"])
            missing = len(changed_driver_rows) - matches
            self.sheet_status.configure(
                text=f"{matches} pilotos encontrados · {missing} sin coincidencia.",
                fg=COLORS["green"] if not missing else COLORS["red_hover"],
            )
        else:
            self.sheet_status.configure(
                text=f"Se pegaron {len(clipboard_rows)} fila(s). Presioná VALIDAR para comprobar los datos.",
                fg=COLORS["muted"],
            )

        self._invalidate_sheet()
        return "break"

    @staticmethod
    def _integer(value, field, minimum=0):
        text = str(value).strip()
        if text == "":
            raise ValueError(f"{field}: el valor está vacío.")
        number = int(text)
        if number < minimum:
            raise ValueError(f"{field}: el valor no puede ser menor que {minimum}.")
        return number

    @staticmethod
    def _number(value, field, minimum=0):
        text = str(value).strip().replace(",", ".")
        if text == "":
            raise ValueError(f"{field}: el valor está vacío.")
        number = float(text)
        if number < minimum:
            raise ValueError(f"{field}: el valor no puede ser menor que {minimum}.")
        return number

    @classmethod
    def _optional_integer(cls, value, field, minimum=0):
        if str(value).strip() == "":
            return 0
        return cls._integer(value, field, minimum)

    @staticmethod
    def _boolean_value(value):
        if isinstance(value, bool):
            return 1 if value else 0
        return 1 if str(value).strip().casefold() in {"1", "true", "si", "sí", "x"} else 0

    @staticmethod
    def _has_value(value):
        if isinstance(value, bool):
            return value
        return str(value).strip().casefold() not in {"", "0", "false"}

    def _build_import_payload(self):
        driver_map = {
            self._normalize(item["nombre"]): item
            for item in self.import_context["drivers"]
        }
        results = []
        errors = []
        used_drivers = set()
        self.sheet.dehighlight_cells(row="all", column=0, redraw=False)

        for row_index, row in enumerate(self.sheet.data, start=1):
            driver_text = str(row[1] if len(row) > 1 else "").strip()
            has_event_data = any(
                self._has_value(value)
                for value in row[5:self.total_points_column]
            )
            if not driver_text and not has_event_data:
                self.sheet.set_cell_data(row_index - 1, 0, "", redraw=False)
                continue

            row_errors = []
            driver = driver_map.get(self._normalize(driver_text))
            if not driver:
                row_errors.append("piloto no encontrado entre los inscriptos del campeonato")
            if driver and driver["id"] in used_drivers:
                row_errors.append("piloto repetido")

            row_results = []
            if driver:
                for event_index, event in enumerate(self.import_context["events"]):
                    start_column = 5 + (event_index * 9)
                    values = list(row[start_column:start_column + 9])
                    while len(values) < 9:
                        values.append("")
                    values = ["" if str(value).strip() == "-" else value for value in values]
                    has_result = any(self._has_value(value) for value in values)
                    if not has_result:
                        continue
                    try:
                        presentismo = self._integer(str(values[0]).strip() or "0", "presentismo", 0)
                        pos_qualy_sprint = str(values[1]).strip().upper()
                        qualy_sprint = self._integer(str(values[2]).strip() or "0", "qualy sprint", 0)
                        pos_sprint = str(values[3]).strip().upper()
                        sprint = self._number(str(values[4]).strip() or "0", "sprint", 0)
                        pos_qualy_final = str(values[5]).strip().upper()
                        qualy_final = self._integer(str(values[6]).strip() or "0", "qualy final", 0)
                        pos_final = str(values[7]).strip().upper()
                        final = self._number(str(values[8]).strip() or "0", "final", 0)
                        if qualy_sprint > 0 and not pos_qualy_sprint:
                            row_errors.append(
                                f'R{event["ronda"]}: {qualy_sprint} puntos Qualy Sprint no están en la escala'
                            )
                        if sprint > 0 and not pos_sprint:
                            row_errors.append(
                                f'R{event["ronda"]}: {sprint} puntos Sprint no están en la escala'
                            )
                        if qualy_final > 0 and not pos_qualy_final:
                            row_errors.append(
                                f'R{event["ronda"]}: {qualy_final} puntos Qualy Final no están en la escala'
                            )
                        if final > 0 and not pos_final:
                            row_errors.append(
                                f'R{event["ronda"]}: {final} puntos Final no están en la escala'
                            )
                        row_results.append(
                            {
                                "fecha": event["fecha"],
                                "ronda": event["ronda"],
                                "idcircuito": event["idcircuito"],
                                "idpiloto": driver["id"],
                                "presentismo": presentismo,
                                "pos_qualy_sprint": pos_qualy_sprint,
                                "pts_qualy_sprint": qualy_sprint,
                                "pos_sprint": pos_sprint,
                                "pts_sprint": sprint,
                                "rec_tiempo_sprint": 0,
                                "rec_pos_sprint": 0,
                                "aps_sprint": 0,
                                "kg_sprint": 0,
                                "kg_sancion_sprint": 0,
                                "desc_sancion_sprint": "",
                                "pos_qualy_final": pos_qualy_final,
                                "pts_qualy_final": qualy_final,
                                "pos_final": pos_final,
                                "pts_final": final,
                                "rec_tiempo_final": 0,
                                "rec_pos_final": 0,
                                "aps_final": 0,
                                "kg_final": 0,
                                "kg_sancion_final": 0,
                                "desc_sancion_final": "",
                            }
                        )
                    except (ValueError, TypeError) as error:
                        row_errors.append(str(error))

            if row_errors:
                self.sheet.set_cell_data(row_index - 1, 0, "✕", redraw=False)
                self.sheet.highlight_cells(
                    row=row_index - 1,
                    column=0,
                    bg="#7f1d1d",
                    fg="#ffffff",
                    redraw=False,
                )
                errors.append(f'Fila {row_index}: {", ".join(row_errors)}')
                continue

            self.sheet.set_cell_data(row_index - 1, 0, "✓", redraw=False)
            self.sheet.highlight_cells(
                row=row_index - 1,
                column=0,
                bg="#14532d",
                fg="#ffffff",
                redraw=False,
            )
            used_drivers.add(driver["id"])
            results.extend(row_results)

        if not results:
            errors.append("No hay resultados válidos para guardar.")
        self.sheet.redraw()
        return results, errors

    def _validate_sheet(self):
        results, errors = self._build_import_payload()
        if errors:
            self.save_button.configure(state="disabled")
            self.sheet_status.configure(
                text=f'{len(errors)} error(es). Corregí las filas marcadas con X.',
                fg=COLORS["red_hover"],
            )
            messagebox.showerror("Validación", "\n".join(errors[:15]))
            return False

        self.sheet_status.configure(
            text=f'{len(results)} resultados listos para guardar.',
            fg=COLORS["green"],
        )
        self.save_button.configure(state="normal")
        return True

    def _save_sheet(self):
        results, errors = self._build_import_payload()
        if errors:
            self._validate_sheet()
            return
        if not messagebox.askyesno(
            "Confirmar importación",
            f"Se guardarán {len(results)} resultados.\n\n¿Continuar?",
        ):
            return

        self._show_loading("Guardando resultados", f"Insertando {len(results)} resultados. No cierres la aplicación...")
        try:
            self.connection = ensure_connection(self.connection)
            save_import(
                self.connection,
                self.import_context["championship"]["id"],
                results,
            )
        except Exception as error:
            self.save_button.configure(state="disabled")
            self._hide_loading()
            messagebox.showerror(
                "Importación cancelada",
                f"No se guardó ningún dato.\n\n{error}",
            )
            return
        finally:
            self._hide_loading()

        self.sheet_status.configure(text="Importación completada correctamente.", fg=COLORS["green"])
        self.save_button.configure(state="disabled")
        messagebox.showinfo(
            "Importación completa",
            f"Se guardaron {len(results)} resultados.",
        )

    def _disconnect(self):
        self._dispose_sheet()
        if self.connection and self.connection.is_connected():
            self.connection.close()
        self.connection = None
        self.status.set("Iniciando conexión con la base de datos...")
        self._show_connection_screen()
        self.after(150, self._start_connection_test)

    def _close_application(self):
        try:
            self._hide_loading()
            self._dispose_sheet()
            if self.connection:
                self.connection.close()
        except Exception:
            pass
        finally:
            self.connection = None
            self.quit()
            self.destroy()


if __name__ == "__main__":
    app = ImportadorCadpo()
    app.mainloop()
