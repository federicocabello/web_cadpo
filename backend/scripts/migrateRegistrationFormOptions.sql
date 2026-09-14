ALTER TABLE inscripciones_config
  ADD COLUMN precio_diseno DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER precio,
  ADD COLUMN setup_detalle TEXT NOT NULL AFTER precio_diseno,
  ADD COLUMN limite_inscriptos SMALLINT UNSIGNED NOT NULL DEFAULT 100 AFTER setup_detalle,
  DROP COLUMN habilitada,
  DROP COLUMN moneda,
  DROP COLUMN setup_fijo;
