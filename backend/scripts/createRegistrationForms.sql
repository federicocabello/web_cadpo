CREATE TABLE IF NOT EXISTS inscripciones_config (
  idcampeonato SMALLINT NOT NULL PRIMARY KEY,
  fecha_apertura DATETIME NOT NULL,
  fecha_cierre DATETIME NOT NULL,
  precio DECIMAL(10,2) NOT NULL DEFAULT 0,
  precio_diseno DECIMAL(10,2) NOT NULL DEFAULT 0,
  precio_pintura_oficial DECIMAL(10,2) NOT NULL DEFAULT 0,
  setup_detalle TEXT NOT NULL,
  limite_inscriptos SMALLINT UNSIGNED NOT NULL,
  preinscriptos SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  autos_habilitados JSON NOT NULL,
  planes JSON NULL,
  permite_personalizado TINYINT(1) NOT NULL DEFAULT 1,
  permite_diseno_liga TINYINT(1) NOT NULL DEFAULT 1,
  permite_pintura_oficial TINYINT(1) NOT NULL DEFAULT 0,
  permite_extra TINYINT(1) NOT NULL DEFAULT 1,
  actualizado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inscripciones_detalle (
  idcampeonato SMALLINT NOT NULL,
  idpiloto SMALLINT NOT NULL,
  modalidad_diseno ENUM('personalizado', 'personalizado_liga', 'pintura_oficial', 'extra') NOT NULL,
  plan_id VARCHAR(64) NULL,
  plan_titulo VARCHAR(120) NULL,
  precio_total DECIMAL(10,2) NULL,
  creado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (idcampeonato, idpiloto)
);

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
