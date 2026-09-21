CREATE TABLE IF NOT EXISTS inscripciones_autos_oficiales (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  idcampeonato SMALLINT NOT NULL,
  idauto SMALLINT NOT NULL,
  numero SMALLINT UNSIGNED NOT NULL,
  descripcion VARCHAR(500) NOT NULL,
  foto VARCHAR(500) NOT NULL,
  creado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_auto_oficial_numero (idcampeonato, numero),
  KEY idx_auto_oficial_campeonato_modelo (idcampeonato, idauto)
);

ALTER TABLE inscriptos
  ADD COLUMN idauto_oficial INT UNSIGNED NULL AFTER tipo_inscripcion;
