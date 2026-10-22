-- =====================================================================
-- Datos iniciales (datos maestros) — se cargan después de schema.sql
-- Carta real de La Pampa Gastro Bar ("Del Pacífico a tu paladar").
-- Las mesas NO se precargan: las crea el mesero en cada jornada (HU03).
-- Los precios se actualizan después desde el sistema (HU02).
-- =====================================================================
USE lapampa;

INSERT INTO rol (id, nombre) VALUES
  (1, 'propietario'),
  (2, 'cajero'),
  (3, 'mesero');

-- Usuarios de prueba, uno por rol. Contraseña de los tres: LaPampa2026*
-- (hash bcrypt, costo 10). CAMBIARLAS antes de usar el sistema en el local.
INSERT INTO usuario (nombre, usuario, contrasena_hash, rol_id) VALUES
  ('Propietario de prueba', 'propietario', '$2a$10$ecTW/F8nkil1cqCadVUH8u8s6P6E5X.5HvF59M1VM3SuUBFMqSVS.', 1),
  ('Cajero de prueba',      'cajero',      '$2a$10$Vc5YHbpaF1fbiyErCFo2xOs./ji8K11PIWeFEOxFA5LyaXD/RJ9Uy', 2),
  ('Mesero de prueba',      'mesero',      '$2a$10$JBeZx5QVxoorW8gkLrckpeLMVxqPv7LBr.OvVJj.RW1uejyFxMcia', 3);

-- ---------------------------------------------------------------------
-- Categorías, en el orden de la carta
-- ---------------------------------------------------------------------
INSERT INTO categoria (nombre, orden, activa) VALUES
  ('Pa'' aguaitar',              1, TRUE),
  ('Ceviche',                    2, TRUE),
  ('Saladito',                   3, TRUE),
  ('Sudaos',                     4, TRUE),
  ('Apanado',                    5, TRUE),
  ('La vieja confiable',         6, TRUE),
  ('Pa'' los requeñecudos/as',   7, TRUE),
  ('Porciones',                  8, TRUE),
  ('Metále dulcesito',           9, FALSE),   -- "Próximamente": postres aún sin productos
  ('Cócteles de La Pampa',      10, TRUE),
  ('Inspiraciones del litoral', 11, TRUE),
  ('Sodas pacíficas',           12, TRUE),
  ('Limonadas',                 13, TRUE),
  ('Jugos',                     14, TRUE),
  ('Gaseosas',                  15, TRUE),
  ('Cervezas',                  16, TRUE),
  ('Viche La Pampa',            17, TRUE);

-- ---------------------------------------------------------------------
-- Productos (precios en pesos colombianos)
-- ---------------------------------------------------------------------
-- Los productos se insertan en el mismo orden de la carta impresa (sin JOIN, para que
-- el motor no los reordene): así el id sigue ese orden y la carta digital los muestra igual.
INSERT INTO producto (categoria_id, nombre, descripcion, precio)
SELECT (SELECT c.id FROM categoria c WHERE c.nombre = p.cat), p.nombre, p.descripcion, p.precio
FROM (
  -- Pa' aguaitar
  SELECT 'Pa'' aguaitar' cat, 'Chumblún' nombre, 'Trozos de pescado al panko con salsas pamperas' descripcion, 23000 precio
  UNION ALL SELECT 'Pa'' aguaitar', 'Batea', 'Anillos de calamar al panko acompañados con salsas pamperas', 24000
  UNION ALL SELECT 'Pa'' aguaitar', 'Mira vé', 'Palitos de pollo al panko acompañados con salsas pamperas', 18000
  UNION ALL SELECT 'Pa'' aguaitar', 'Azotea', 'Patacones con ahogao de puras hierbas de azotea', 15000
  UNION ALL SELECT 'Pa'' aguaitar', 'Asunto allá', 'Maduro frito con queso costeño', 13000
  -- Ceviche
  UNION ALL SELECT 'Ceviche', 'Bambero', 'Ceviche de camarón tigre con patacones', 36000
  -- Saladito
  UNION ALL SELECT 'Saladito', 'Makerule', 'Queso costeño frito acompañado de banano frito', 25000
  -- Sudaos
  UNION ALL SELECT 'Sudaos', 'Oye vevé', 'Sudao de camarón aliñado con hierbas de azotea y coco, con papachina sancochada/frita o patacón', 40000
  UNION ALL SELECT 'Sudaos', 'Vientoymarea', 'Sudao de tollo aliñado con hierbas de azotea y coco, con chips de papachina sancochada/frita o patacón', 43000
  UNION ALL SELECT 'Sudaos', 'Fuliao', 'Sudao de piangua aliñado con hierbas de azotea y coco, con chips de papachina sancochada/frita o patacón', 45000
  -- Apanado
  UNION ALL SELECT 'Apanado', 'Barajo', 'Langostinos apanados en panko con papachina frita/sancochada o patacones y salsas pamperas', 39000
  -- La vieja confiable (la carta trae dos precios: $44.000 / $47.000; confirmar con el propietario cuál es cuál)
  UNION ALL SELECT 'La vieja confiable', 'Subienda de pelada', 'Pelada frita con papachina frita/sancochada o patacones', 44000
  UNION ALL SELECT 'La vieja confiable', 'Subienda de gualajo', 'Gualajo frito con papachina frita/sancochada o patacones', 47000
  -- Pa' los requeñecudos/as
  UNION ALL SELECT 'Pa'' los requeñecudos/as', 'Enchúspate', 'Chuleta de cerdo con papas a la francesa y ensalada aurora', 27000
  UNION ALL SELECT 'Pa'' los requeñecudos/as', 'La bugueña', 'Pechuga a la plancha con papa a la francesa y ensalada aurora', 25000
  -- Porciones
  UNION ALL SELECT 'Porciones', 'Papachina frita/sancochada', NULL, 8000
  UNION ALL SELECT 'Porciones', 'Patacones', NULL, 6000
  UNION ALL SELECT 'Porciones', 'Banano', NULL, 7000
  UNION ALL SELECT 'Porciones', 'Papas a la francesa', NULL, 6000
  UNION ALL SELECT 'Porciones', 'Porción de ahogao', NULL, 5000
  -- Cócteles de La Pampa
  UNION ALL SELECT 'Cócteles de La Pampa', 'Fogaje', '90 % viche puro, infusión de limón y pimienta. Escarchado meloso', 22000
  UNION ALL SELECT 'Cócteles de La Pampa', 'Marea', 'Infusión de limón con oreganón y viche puro', 20000
  UNION ALL SELECT 'Cócteles de La Pampa', 'Origins atrateño Kilele', 'Cóctel en lata: jugo de limón infusionado con hierbabuena y romero', 18000
  UNION ALL SELECT 'Cócteles de La Pampa', 'Origins atrateño Cambambero', 'Cóctel en lata: naranja, jengibre y canela', 18000
  -- Inspiraciones del litoral
  UNION ALL SELECT 'Inspiraciones del litoral', 'Abozao', 'Infusión de vino y tomaseca con notas cítricas', 23000
  UNION ALL SELECT 'Inspiraciones del litoral', 'Bambuco', 'Cremoso de coco con viche puro. Escarchado con coco', 25000
  UNION ALL SELECT 'Inspiraciones del litoral', 'Berejú', 'Agua de coco, sirope de limoncillo, coco y curao', 20000
  UNION ALL SELECT 'Inspiraciones del litoral', 'Currulao', 'Trozos de lulo con viche puro, con sirope de poleo y lulo', 23000
  -- Sodas pacíficas
  UNION ALL SELECT 'Sodas pacíficas', 'Soda de piña con sirope de limoncillo', NULL, 12000
  UNION ALL SELECT 'Sodas pacíficas', 'Soda de chontaduro con limón', NULL, 12000
  UNION ALL SELECT 'Sodas pacíficas', 'Soda de fresa con sirope de menta', NULL, 12000
  UNION ALL SELECT 'Sodas pacíficas', 'Soda de tamarindo', NULL, 12000
  -- Limonadas
  UNION ALL SELECT 'Limonadas', 'Limonada de coco', NULL, 13000
  UNION ALL SELECT 'Limonadas', 'Limonada natural', NULL, 8000
  UNION ALL SELECT 'Limonadas', 'Limonada panelada con hierbabuena', NULL, 9000
  UNION ALL SELECT 'Limonadas', 'Limonada enlulada', NULL, 11000
  -- Jugos
  UNION ALL SELECT 'Jugos', 'Jugo de lulo', NULL, 8000
  UNION ALL SELECT 'Jugos', 'Jugo de guayaba agria', NULL, 8000
  UNION ALL SELECT 'Jugos', 'Jugo de naidí en leche', NULL, 15000
  UNION ALL SELECT 'Jugos', 'Jugo de naidí en agua', NULL, 13000
  UNION ALL SELECT 'Jugos', 'Jugo de borojó en leche', NULL, 13000
  UNION ALL SELECT 'Jugos', 'Jugo de borojó en agua', NULL, 12000
  -- Gaseosas
  UNION ALL SELECT 'Gaseosas', 'Coca-Cola 400 ml', NULL, 5000
  UNION ALL SELECT 'Gaseosas', 'Quatro 400 ml', NULL, 5000
  UNION ALL SELECT 'Gaseosas', 'Soda 300 ml', NULL, 5000
  UNION ALL SELECT 'Gaseosas', 'Agua 600 ml', NULL, 4000
  UNION ALL SELECT 'Gaseosas', 'Electrolit 625 ml', NULL, 10000
  -- Cervezas
  UNION ALL SELECT 'Cervezas', 'Budweiser', NULL, 5000
  UNION ALL SELECT 'Cervezas', 'Póker', NULL, 5000
  UNION ALL SELECT 'Cervezas', 'Club Colombia', NULL, 7000
  UNION ALL SELECT 'Cervezas', 'Águila Light', NULL, 5000
  UNION ALL SELECT 'Cervezas', 'Michelada (adicional)', 'Se suma a la cerveza', 2000
  -- Viche La Pampa
  UNION ALL SELECT 'Viche La Pampa', 'Viche curao botella 750 ml', NULL, 50000
  UNION ALL SELECT 'Viche La Pampa', 'Viche curao caneca 375 ml', NULL, 30000
  UNION ALL SELECT 'Viche La Pampa', 'Viche curao shot en jícara', NULL, 3000
  UNION ALL SELECT 'Viche La Pampa', 'Viche puro botella 750 ml', NULL, 40000
  UNION ALL SELECT 'Viche La Pampa', 'Viche puro caneca 375 ml', NULL, 20000
  UNION ALL SELECT 'Viche La Pampa', 'Viche puro shot en jícara', NULL, 3000
) AS p;
