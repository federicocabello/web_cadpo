ALTER TABLE resultados
  ADD COLUMN desc_sancion_qualy_sprint VARCHAR(500) NOT NULL DEFAULT '',
  ADD COLUMN desc_sancion_qualy_final VARCHAR(500) NOT NULL DEFAULT '';
