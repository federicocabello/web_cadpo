ALTER TABLE inscripciones_config
  ADD COLUMN planes JSON NULL AFTER autos_habilitados;

ALTER TABLE inscripciones_detalle
  ADD COLUMN plan_id VARCHAR(64) NULL AFTER modalidad_diseno,
  ADD COLUMN plan_titulo VARCHAR(120) NULL AFTER plan_id,
  ADD COLUMN precio_total DECIMAL(10,2) NULL AFTER plan_titulo;
