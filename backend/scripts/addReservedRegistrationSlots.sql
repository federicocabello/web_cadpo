ALTER TABLE inscripciones_config
  ADD COLUMN cupos_reservados SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER limite_inscriptos;
