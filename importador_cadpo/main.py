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
    fetch_championships,
    fetch_import_context,
    save_import,
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
        self.columns_expanded = False
        self.columns_button = None
        self.compact_column_order = [6, 4, 8]
        self._pilot_validation_job = None
        self._scoring_row_job = None
        self.championship_value = tk.StringVar()
        self.driver_row_count = tk.StringVar(value="30")
        self.driver_row_count.trace_add("write", self._schedule_scoring_row_sync)
        self.attendance_points = tk.StringVar()

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

        tk.Label(
            self.import_content,
            text="SELECCIONAR CAMPEONATO",
            bg=COLORS["background"],
            fg=COLORS["text"],
            font=("Arial", 20, "bold"),
            anchor="w",
        ).pack(fill="x")
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

        extras = tk.Frame(scoring_area, bg=COLORS["panel"], padx=18, pady=14)
        extras.pack(side="right", fill="y", padx=(16, 0))
        tk.Label(
            extras,
            text="PUNTOS AUTOMÁTICOS",
            bg=COLORS["panel"],
            fg=COLORS["text"],
            font=("Arial", 10, "bold"),
        ).pack(anchor="w", pady=(0, 12))
        for label, variable in (
            ("Presentismo", self.attendance_points),
        ):
            tk.Label(
                extras,
                text=label.upper(),
                bg=COLORS["panel"],
                fg=COLORS["muted"],
                font=("Arial", 8, "bold"),
            ).pack(anchor="w", pady=(7, 4))
            ttk.Entry(extras, textvariable=variable, width=24).pack(fill="x", ipady=5)

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

        try:
            self.connection = ensure_connection(self.connection)
            championship_id = self.championships[selected_index]["id"]
            self.import_context = fetch_import_context(self.connection, championship_id)
            self.import_context["initial_row_count"] = initial_row_count
            self.import_context["scoring"] = scoring
            self.import_context["event_multipliers"] = [1.0] * len(self.import_context["events"])
        except Exception as error:
            self._report_error("No se pudo preparar la planilla", error)
            return

        if not self.import_context["events"]:
            messagebox.showwarning("Sin fechas", "El campeonato no tiene fechas cargadas en calendario.")
            return

        try:
            self._render_sheet()
        except Exception as error:
            self._report_error("Error al crear la planilla", error)
            self._show_championship_selector()

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

        def automatic_points(variable, label):
            value = variable.get().strip()
            return self._integer(value or "0", label, 0)

        return {
            "qualy_sprint_by_points": qualy_sprint_by_points,
            "qualy_final_by_points": qualy_final_by_points,
            "sprint_by_points": sprint_by_points,
            "final_by_points": final_by_points,
            "presentismo": automatic_points(self.attendance_points, "Presentismo"),
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
            text="VOLVER",
            command=self._show_championship_selector,
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
            text="REINICIAR",
            command=self._restart_application,
            bg=COLORS["red"],
            activebackground=COLORS["red_hover"],
            fg=COLORS["text"],
            relief="flat",
            cursor="hand2",
            padx=14,
            pady=8,
        ).pack(side="right", padx=(8, 0))
        self.columns_button = tk.Button(
            toolbar,
            text="MOSTRAR COLUMNAS",
            command=self._toggle_sheet_columns,
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
            text="ORDEN COLUMNAS",
            command=self._edit_compact_column_order,
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
            for derived_offset in (0,):
                self.sheet[num2alpha(start_column + derived_offset)].readonly()
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
        columns = [0, 1, 2, 3, 4]
        for event_index, _event in enumerate(self.import_context["events"]):
            start_column = 5 + (event_index * 9)
            columns.extend(start_column + offset for offset in self.compact_column_order)
        return columns

    def _edit_compact_column_order(self):
        labels = {
            6: "PUNTOS QUALY FINAL",
            4: "PUNTOS SPRINT",
            8: "PUNTOS FINAL",
        }
        order = list(self.compact_column_order)

        dialog = tk.Toplevel(self)
        dialog.title("Orden de columnas")
        dialog.configure(bg=COLORS["panel"])
        dialog.resizable(False, False)
        dialog.transient(self)
        dialog.grab_set()

        tk.Label(
            dialog,
            text="ORDEN DE LAS COLUMNAS VISIBLES",
            bg=COLORS["panel"],
            fg=COLORS["text"],
            font=("Arial", 11, "bold"),
        ).pack(anchor="w", padx=18, pady=(18, 10))

        content = tk.Frame(dialog, bg=COLORS["panel"])
        content.pack(fill="both", expand=True, padx=18)
        column_list = tk.Listbox(
            content,
            height=3,
            width=30,
            bg=COLORS["field"],
            fg=COLORS["text"],
            selectbackground=COLORS["red"],
            selectforeground=COLORS["text"],
            borderwidth=0,
            highlightthickness=1,
            highlightbackground=COLORS["border"],
            font=("Arial", 10, "bold"),
        )
        column_list.pack(side="left", fill="both", expand=True)

        def refresh_list(selected_index=0):
            column_list.delete(0, "end")
            for offset in order:
                column_list.insert("end", labels[offset])
            column_list.selection_set(selected_index)
            column_list.activate(selected_index)

        def move(direction):
            selection = column_list.curselection()
            if not selection:
                return
            current_index = selection[0]
            new_index = current_index + direction
            if not 0 <= new_index < len(order):
                return
            order[current_index], order[new_index] = order[new_index], order[current_index]
            refresh_list(new_index)

        controls = tk.Frame(content, bg=COLORS["panel"])
        controls.pack(side="left", padx=(10, 0))
        for text, direction in (("SUBIR", -1), ("BAJAR", 1)):
            tk.Button(
                controls,
                text=text,
                command=lambda value=direction: move(value),
                bg=COLORS["field"],
                activebackground=COLORS["border"],
                fg=COLORS["text"],
                relief="flat",
                width=9,
                pady=7,
            ).pack(pady=(0, 7))

        def apply_order():
            self.compact_column_order = order
            self.columns_expanded = False
            self._apply_compact_columns(redraw=True)
            if self.columns_button:
                self.columns_button.configure(text="MOSTRAR COLUMNAS")
            dialog.destroy()

        refresh_list()
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
            text="MULTIPLICADOR DE PUNTOS FINAL POR FECHA",
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
            variable = tk.StringVar(value=str(multipliers[index]).replace(".", ","))
            ttk.Entry(row, textvariable=variable, width=8).pack(side="right", ipady=4)
            entries.append(variable)

        def save_multipliers():
            try:
                values = [float(variable.get().strip().replace(",", ".")) for variable in entries]
                if any(value <= 0 for value in values):
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
            self.columns_button.configure(text="MOSTRAR COLUMNAS")

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
        self.attendance_points.set("")
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
            numeric_columns = [3, *range(5, self.total_points_column)]
            for column in numeric_columns:
                if str(row[column]).strip() == "0":
                    self.sheet.set_cell_data(row_index, column, "", redraw=False)

            for event_index, _event in enumerate(self.import_context["events"]):
                start_column = 5 + (event_index * 9)
                multiplier = self.import_context["event_multipliers"][event_index]
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

                self.sheet.set_cell_data(
                    row_index,
                    start_column,
                    scoring["presentismo"] if any((qualy_sprint_points, sprint_points, qualy_final_points, final_points)) else "",
                    redraw=False,
                )
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
                            1,
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
                            multiplier,
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
        car_map = {
            self._normalize(f'{item["marca"]} {item["modelo"]}'): item
            for item in self.import_context["cars"]
        }
        registrations = []
        results = []
        errors = []
        used_drivers = set()
        self.sheet.dehighlight_cells(row="all", column=0, redraw=False)

        for row_index, row in enumerate(self.sheet.data, start=1):
            driver_text = str(row[1] if len(row) > 1 else "").strip()
            car_text = str(row[2] if len(row) > 2 else "").strip()
            has_event_data = any(
                self._has_value(value)
                for value in row[5:self.total_points_column]
            )
            if not driver_text and not car_text and not has_event_data:
                self.sheet.set_cell_data(row_index - 1, 0, "", redraw=False)
                continue

            row_errors = []
            driver = driver_map.get(self._normalize(driver_text))
            car = car_map.get(self._normalize(car_text))
            if not driver:
                row_errors.append("piloto no encontrado")
            if not car:
                row_errors.append("auto no encontrado en la categoría")
            if driver and driver["id"] in used_drivers:
                row_errors.append("piloto repetido")

            try:
                number_text = row[3] if len(row) > 3 else ""
                number = self._integer(number_text or "0", "número", 0)
            except (ValueError, TypeError):
                number = None
                row_errors.append("número inválido")

            row_results = []
            if driver:
                for event_index, event in enumerate(self.import_context["events"]):
                    start_column = 5 + (event_index * 9)
                    values = list(row[start_column:start_column + 9])
                    while len(values) < 9:
                        values.append("")
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
            registrations.append(
                {
                    "idpiloto": driver["id"],
                    "idauto": car["id"],
                    "numero": number,
                    "pago": 1 if bool(row[4]) else 0,
                }
            )
            results.extend(row_results)

        if not registrations:
            errors.append("No hay filas válidas para guardar.")
        self.sheet.redraw()
        return registrations, results, errors

    def _validate_sheet(self):
        registrations, results, errors = self._build_import_payload()
        if errors:
            self.save_button.configure(state="disabled")
            self.sheet_status.configure(
                text=f'{len(errors)} error(es). Corregí las filas marcadas con X.',
                fg=COLORS["red_hover"],
            )
            messagebox.showerror("Validación", "\n".join(errors[:15]))
            return False

        self.sheet_status.configure(
            text=f'{len(registrations)} pilotos y {len(results)} resultados listos para guardar.',
            fg=COLORS["green"],
        )
        self.save_button.configure(state="normal")
        return True

    def _save_sheet(self):
        registrations, results, errors = self._build_import_payload()
        if errors:
            self._validate_sheet()
            return
        if not messagebox.askyesno(
            "Confirmar importación",
            f"Se guardarán {len(registrations)} inscriptos y {len(results)} resultados.\n\n¿Continuar?",
        ):
            return

        try:
            self.connection = ensure_connection(self.connection)
            save_import(
                self.connection,
                self.import_context["championship"]["id"],
                registrations,
                results,
            )
        except Exception as error:
            self.save_button.configure(state="disabled")
            messagebox.showerror(
                "Importación cancelada",
                f"No se guardó ningún dato.\n\n{error}",
            )
            return

        self.sheet_status.configure(text="Importación completada correctamente.", fg=COLORS["green"])
        self.save_button.configure(state="disabled")
        messagebox.showinfo(
            "Importación completa",
            f"Se guardaron {len(registrations)} inscriptos y {len(results)} resultados.",
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
        self._dispose_sheet()
        if self.connection and self.connection.is_connected():
            self.connection.close()
        self.destroy()


if __name__ == "__main__":
    app = ImportadorCadpo()
    app.mainloop()
