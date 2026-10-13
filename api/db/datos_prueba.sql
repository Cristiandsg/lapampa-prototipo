-- =====================================================================
-- Datos de prueba OPCIONALES para desarrollo y QA (no van al local).
-- La carta real ya viene en seed.sql; aquí solo se agregan mesas de ejemplo.
-- Uso: npm run db:prueba  (desde /api)
-- =====================================================================
USE lapampa;

-- Mesas de ejemplo creadas por el mesero de prueba (nombres libres)
INSERT INTO mesa (nombre, creada_por) VALUES
  ('Terraza 1', (SELECT id FROM usuario WHERE usuario = 'mesero')),
  ('Terraza 2', (SELECT id FROM usuario WHERE usuario = 'mesero')),
  ('Barra',     (SELECT id FROM usuario WHERE usuario = 'mesero'));
