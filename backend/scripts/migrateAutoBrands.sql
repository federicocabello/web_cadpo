-- Ejecutar una sola vez sobre web_cadpo antes de desplegar esta version.
START TRANSACTION;

CREATE TABLE autos_marcas (
  id INT NOT NULL AUTO_INCREMENT,
  marca VARCHAR(100) NOT NULL,
  logo VARCHAR(255) NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  UNIQUE KEY uq_autos_marcas_marca (marca)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO autos_marcas (marca, logo)
SELECT TRIM(marca), COALESCE(MAX(NULLIF(logo, '')), '')
FROM autos
WHERE marca IS NOT NULL AND TRIM(marca) <> ''
GROUP BY TRIM(marca);

ALTER TABLE autos ADD COLUMN idmarca INT NULL AFTER idcategoria;

UPDATE autos a
JOIN autos_marcas am ON LOWER(TRIM(am.marca)) = LOWER(TRIM(a.marca))
SET a.idmarca = am.id;

ALTER TABLE autos
  DROP COLUMN logo,
  DROP COLUMN marca,
  CHANGE COLUMN idmarca marca INT NOT NULL,
  ADD KEY idx_autos_marca (marca),
  ADD CONSTRAINT fk_autos_marca
    FOREIGN KEY (marca) REFERENCES autos_marcas (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;

COMMIT;
