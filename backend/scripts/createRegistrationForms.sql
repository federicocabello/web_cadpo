CREATE TABLE IF NOT EXISTS inscripciones_config (
  idcampeonato SMALLINT NOT NULL PRIMARY KEY,
  fecha_apertura DATETIME NOT NULL,
  fecha_cierre DATETIME NOT NULL,
  precio DECIMAL(10,2) NOT NULL DEFAULT 0,
  precio_diseno DECIMAL(10,2) NOT NULL DEFAULT 0,
  setup_detalle TEXT NOT NULL,
  limite_inscriptos SMALLINT UNSIGNED NOT NULL,
  preinscriptos SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  autos_habilitados JSON NOT NULL,
  permite_personalizado TINYINT(1) NOT NULL DEFAULT 1,
  permite_diseno_liga TINYINT(1) NOT NULL DEFAULT 1,
  permite_extra TINYINT(1) NOT NULL DEFAULT 1,
  actualizado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inscripciones_detalle (
  idcampeonato SMALLINT NOT NULL,
  idpiloto SMALLINT NOT NULL,
  modalidad_diseno ENUM('personalizado', 'personalizado_liga', 'extra') NOT NULL,
  creado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (idcampeonato, idpiloto)
);
