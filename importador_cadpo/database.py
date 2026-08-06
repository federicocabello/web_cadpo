import os

import mysql.connector


DATABASE_CONFIG = {
    "host": os.getenv("CADPO_DB_HOST", "92.113.22.16"),
    "port": int(os.getenv("CADPO_DB_PORT", "3306")),
    "user": os.getenv("CADPO_DB_USER", "u434277660_root_cadpo"),
    "password": os.getenv("CADPO_DB_PASSWORD", "Losredondos#123"),
    "database": os.getenv("CADPO_DB_NAME", "u434277660_web_cadpo"),
}


def create_connection():
    return mysql.connector.connect(
        **DATABASE_CONFIG,
        connection_timeout=8,
        autocommit=False,
    )


def ensure_connection(connection=None):
    try:
        if connection is not None and connection.is_connected():
            connection.ping(reconnect=True, attempts=3, delay=1)
            return connection
    except mysql.connector.Error:
        pass

    try:
        if connection is not None:
            connection.close()
    except mysql.connector.Error:
        pass

    return create_connection()


def verify_connection(connection):
    cursor = connection.cursor()
    try:
        cursor.execute("SELECT DATABASE(), VERSION()")
        return cursor.fetchone()
    finally:
        cursor.close()


def fetch_championships(connection):
    cursor = connection.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT c.id, c.temporada, c.anio, c.idcategoria, cat.categoria
            FROM campeonatos c
            JOIN categorias cat ON cat.id = c.idcategoria
            WHERE NOT EXISTS (
                SELECT 1
                FROM resultados r
                WHERE r.idcampeonato = c.id
            )
            ORDER BY c.anio ASC, c.temporada ASC
            """
        )
        return cursor.fetchall()
    finally:
        cursor.close()


def fetch_import_context(connection, championship_id):
    cursor = connection.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT c.id, c.idcategoria, c.temporada, c.anio, cat.categoria
            FROM campeonatos c
            JOIN categorias cat ON cat.id = c.idcategoria
            WHERE c.id = %s
            """,
            (championship_id,),
        )
        championship = cursor.fetchone()
        if not championship:
            raise ValueError("El campeonato seleccionado no existe.")

        cursor.execute(
            """
            SELECT cal.fecha, cal.ronda, cal.idcircuito,
                   ci.nombre AS circuito, ci.variante
            FROM calendario cal
            JOIN circuitos ci ON ci.id = cal.idcircuito
            WHERE cal.idcampeonato = %s
            ORDER BY cal.ronda ASC
            """,
            (championship_id,),
        )
        events = cursor.fetchall()

        cursor.execute("SELECT id, nombre FROM pilotos ORDER BY nombre ASC")
        drivers = cursor.fetchall()

        cursor.execute(
            """
            SELECT a.id, a.modelo, am.marca
            FROM autos a
            JOIN autos_marcas am ON am.id = a.marca
            WHERE a.idcategoria = %s
            ORDER BY am.marca ASC, a.modelo ASC
            """,
            (championship["idcategoria"],),
        )
        cars = cursor.fetchall()

        return {
            "championship": championship,
            "events": events,
            "drivers": drivers,
            "cars": cars,
        }
    finally:
        cursor.close()


def save_import(connection, championship_id, registrations, results):
    cursor = connection.cursor()
    try:
        if connection.in_transaction:
            connection.rollback()
        connection.start_transaction()

        cursor.executemany(
            """
            INSERT INTO inscriptos
                (idcampeonato, idpiloto, idauto, numero, pago)
            VALUES (%s, %s, %s, %s, %s)
            """,
            [
                (
                    championship_id,
                    row["idpiloto"],
                    row["idauto"],
                    row["numero"],
                    row["pago"],
                )
                for row in registrations
            ],
        )

        if results:
            cursor.executemany(
                """
                INSERT INTO resultados
                    (idcampeonato, fecha, ronda, idcircuito, idpiloto,
                     presentismo,
                     pos_qualy_sprint, pts_qualy_sprint,
                     pos_sprint, pts_sprint,
                     rec_tiempo_sprint, rec_pos_sprint, aps_sprint,
                     kg_sprint, kg_sancion_sprint, desc_sancion_sprint,
                     pos_qualy_final, pts_qualy_final,
                     pos_final, pts_final,
                     rec_tiempo_final, rec_pos_final, aps_final,
                     kg_final, kg_sancion_final, desc_sancion_final)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s)
                """,
                [
                    (
                        championship_id,
                        row["fecha"],
                        row["ronda"],
                        row["idcircuito"],
                        row["idpiloto"],
                        row["presentismo"],
                        row["pos_qualy_sprint"],
                        row["pts_qualy_sprint"],
                        row["pos_sprint"],
                        row["pts_sprint"],
                        row["rec_tiempo_sprint"],
                        row["rec_pos_sprint"],
                        row["aps_sprint"],
                        row["kg_sprint"],
                        row["kg_sancion_sprint"],
                        row["desc_sancion_sprint"],
                        row["pos_qualy_final"],
                        row["pts_qualy_final"],
                        row["pos_final"],
                        row["pts_final"],
                        row["rec_tiempo_final"],
                        row["rec_pos_final"],
                        row["aps_final"],
                        row["kg_final"],
                        row["kg_sancion_final"],
                        row["desc_sancion_final"],
                    )
                    for row in results
                ],
            )

        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()
