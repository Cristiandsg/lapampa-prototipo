-- =====================================================================
-- Datos iniciales (datos maestros) — se cargan después de schema.sql
-- Las mesas NO se precargan: las crea el mesero en cada jornada (HU03).
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

-- Categorías de la carta. AJUSTAR a la carta real de La Pampa.
INSERT INTO categoria (nombre, orden) VALUES
  ('Entradas',        1),
  ('Platos fuertes',  2),
  ('Hamburguesas',    3),
  ('Bebidas',         4),
  ('Cervezas',        5),
  ('Cócteles',        6),
  ('Postres',         7);
