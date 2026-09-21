ALTER TABLE inscripciones_config
  ADD COLUMN precio_pintura_oficial DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER precio_diseno,
  ADD COLUMN permite_pintura_oficial TINYINT(1) NOT NULL DEFAULT 0 AFTER permite_diseno_liga;

ALTER TABLE inscripciones_detalle
  MODIFY COLUMN modalidad_diseno ENUM('personalizado', 'personalizado_liga', 'pintura_oficial', 'extra') NOT NULL;
