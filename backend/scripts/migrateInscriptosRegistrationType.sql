ALTER TABLE inscriptos
  ADD COLUMN tipo_inscripcion ENUM('extra', 'personalizado', 'diseno_liga', 'diseno_oficial') NULL AFTER numero,
  ADD COLUMN precio_inscripcion DECIMAL(10,2) NULL AFTER tipo_inscripcion;
