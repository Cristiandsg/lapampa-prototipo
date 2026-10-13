-- =====================================================================
-- Datos de prueba OPCIONALES para desarrollo y QA (no van al local).
-- Productos y precios inventados de ejemplo; se cargan después de seed.sql.
-- Uso: npm run db:prueba  (desde /api)
-- =====================================================================
USE lapampa;

INSERT INTO producto (categoria_id, nombre, descripcion, precio) VALUES
  ((SELECT id FROM categoria WHERE nombre = 'Entradas'),       'Empanadas x3',          'Empanadas de carne con ají',            9000),
  ((SELECT id FROM categoria WHERE nombre = 'Entradas'),       'Patacones con hogao',   NULL,                                    12000),
  ((SELECT id FROM categoria WHERE nombre = 'Platos fuertes'), 'Picada para dos',       'Chorizo, chicharrón, papa y arepa',     42000),
  ((SELECT id FROM categoria WHERE nombre = 'Platos fuertes'), 'Churrasco',             '350 g con papas y ensalada',            38000),
  ((SELECT id FROM categoria WHERE nombre = 'Hamburguesas'),   'Hamburguesa de la casa','Carne de res, queso y tocineta',        24000),
  ((SELECT id FROM categoria WHERE nombre = 'Bebidas'),        'Limonada de coco',      NULL,                                    9000),
  ((SELECT id FROM categoria WHERE nombre = 'Bebidas'),        'Gaseosa',               '400 ml',                                4500),
  ((SELECT id FROM categoria WHERE nombre = 'Cervezas'),       'Cerveza nacional',      'Botella 330 ml',                        6000),
  ((SELECT id FROM categoria WHERE nombre = 'Cócteles'),       'Mojito',                NULL,                                    18000),
  ((SELECT id FROM categoria WHERE nombre = 'Postres'),        'Brownie con helado',    NULL,                                    11000);

-- Mesas de ejemplo creadas por el mesero de prueba (nombres libres)
INSERT INTO mesa (nombre, creada_por) VALUES
  ('Terraza 1', (SELECT id FROM usuario WHERE usuario = 'mesero')),
  ('Terraza 2', (SELECT id FROM usuario WHERE usuario = 'mesero')),
  ('Barra',     (SELECT id FROM usuario WHERE usuario = 'mesero'));
