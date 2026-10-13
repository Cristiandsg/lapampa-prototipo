-- =====================================================================
-- La Pampa Gastrobar — Primer prototipo de sistema de información web
-- Script de creación de la base de datos (MySQL 8)
-- HT-02 Arquitectura y modelo de datos — Sprint 0
-- =====================================================================
-- Ejecutar sobre una base vacía:   npm run db:init   (desde /api)
-- o manualmente:                   mysql -u root -p < db/schema.sql
-- =====================================================================

DROP DATABASE IF EXISTS lapampa;
CREATE DATABASE lapampa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lapampa;

-- ---------------------------------------------------------------------
-- 1. Acceso: roles y usuarios (HU01)
-- ---------------------------------------------------------------------
CREATE TABLE rol (
  id          TINYINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  nombre      VARCHAR(20) NOT NULL UNIQUE          -- propietario | cajero | mesero
) ENGINE=InnoDB;

CREATE TABLE usuario (
  id                 INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  nombre             VARCHAR(80)  NOT NULL,
  usuario            VARCHAR(40)  NOT NULL UNIQUE,
  contrasena_hash    CHAR(60)     NOT NULL,          -- hash bcrypt, nunca texto plano (RNF-01)
  rol_id             TINYINT UNSIGNED NOT NULL,
  activo             BOOLEAN      NOT NULL DEFAULT TRUE,
  intentos_fallidos  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  bloqueado_hasta    DATETIME     NULL,              -- 5 intentos fallidos = 10 min de bloqueo
  creado_en          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_usuario_rol FOREIGN KEY (rol_id) REFERENCES rol(id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2. Carta digital (HU02)
-- ---------------------------------------------------------------------
CREATE TABLE categoria (
  id      SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  nombre  VARCHAR(50) NOT NULL UNIQUE,
  orden   SMALLINT UNSIGNED NOT NULL DEFAULT 0,      -- orden en que se muestra en la carta
  activa  BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB;

CREATE TABLE producto (
  id              INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  categoria_id    SMALLINT UNSIGNED NOT NULL,
  nombre          VARCHAR(80)  NOT NULL,
  descripcion     VARCHAR(255) NULL,
  precio          DECIMAL(10,2) NOT NULL,
  activo          BOOLEAN NOT NULL DEFAULT TRUE,      -- los productos no se borran: se desactivan
  agotado_hoy     BOOLEAN NOT NULL DEFAULT FALSE,     -- se oculta sin desactivarlo
  creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_producto_categoria FOREIGN KEY (categoria_id) REFERENCES categoria(id),
  CONSTRAINT uq_producto_nombre UNIQUE (nombre),
  CONSTRAINT ck_producto_precio CHECK (precio > 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. Mesas con nombre libre (HU03)
--    No hay mesas precargadas: el mesero las crea en cada jornada.
--    El nombre es único solo entre las mesas activas (columna generada).
-- ---------------------------------------------------------------------
CREATE TABLE mesa (
  id             INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  nombre         VARCHAR(40) NOT NULL,
  estado         ENUM('libre','ocupada','por_cobrar') NOT NULL DEFAULT 'libre',
  activa         BOOLEAN NOT NULL DEFAULT TRUE,       -- "eliminar" = desactivar, para no perder el historial
  creada_por     INT UNSIGNED NOT NULL,
  creada_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  nombre_activo  VARCHAR(40) AS (IF(activa, nombre, NULL)) STORED,
  CONSTRAINT fk_mesa_usuario FOREIGN KEY (creada_por) REFERENCES usuario(id),
  CONSTRAINT uq_mesa_nombre_activo UNIQUE (nombre_activo),
  CONSTRAINT ck_mesa_nombre CHECK (CHAR_LENGTH(TRIM(nombre)) > 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. Pedidos (HU04 a HU06) — un pedido es de mesa o de domicilio
-- ---------------------------------------------------------------------
CREATE TABLE pedido (
  id              INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,   -- número consecutivo del pedido
  canal           ENUM('mesa','domicilio') NOT NULL,
  mesa_id         INT UNSIGNED NULL,
  mesero_id       INT UNSIGNED NULL,                         -- quién tomó el pedido en mesa
  estado          ENUM('abierto','por_cobrar','pagado','cancelado') NOT NULL DEFAULT 'abierto',
  subtotal        DECIMAL(12,2) NOT NULL DEFAULT 0,
  observaciones   VARCHAR(255) NULL,
  creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cerrado_en      DATETIME NULL,
  pagado_en       DATETIME NULL,
  CONSTRAINT fk_pedido_mesa    FOREIGN KEY (mesa_id)   REFERENCES mesa(id),
  CONSTRAINT fk_pedido_mesero  FOREIGN KEY (mesero_id) REFERENCES usuario(id),
  CONSTRAINT ck_pedido_canal CHECK (
    (canal = 'mesa' AND mesa_id IS NOT NULL) OR (canal = 'domicilio' AND mesa_id IS NULL)
  ),
  CONSTRAINT ck_pedido_subtotal CHECK (subtotal >= 0),
  INDEX ix_pedido_estado_fecha (estado, creado_en)
) ENGINE=InnoDB;

CREATE TABLE detalle_pedido (
  id               INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  pedido_id        INT UNSIGNED NOT NULL,
  producto_id      INT UNSIGNED NOT NULL,
  cantidad         SMALLINT UNSIGNED NOT NULL,
  precio_unitario  DECIMAL(10,2) NOT NULL,        -- precio del momento: un cambio de carta no altera pedidos viejos
  nota             VARCHAR(120) NULL,             -- "término medio", "sin cebolla"
  CONSTRAINT fk_detalle_pedido   FOREIGN KEY (pedido_id)   REFERENCES pedido(id) ON DELETE CASCADE,
  CONSTRAINT fk_detalle_producto FOREIGN KEY (producto_id) REFERENCES producto(id),
  CONSTRAINT ck_detalle_cantidad CHECK (cantidad > 0),
  CONSTRAINT ck_detalle_precio   CHECK (precio_unitario > 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5. Caja: pagos y propinas (HU07, HU08)
-- ---------------------------------------------------------------------
CREATE TABLE pago (
  id          INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  pedido_id   INT UNSIGNED NOT NULL,                  -- un pedido admite varios pagos (pago mixto)
  medio       ENUM('efectivo','tarjeta','transferencia') NOT NULL,
  valor       DECIMAL(12,2) NOT NULL,
  referencia  VARCHAR(60) NULL,                       -- n.° de comprobante de transferencia, si aplica
  cajero_id   INT UNSIGNED NOT NULL,
  creado_en   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pago_pedido FOREIGN KEY (pedido_id) REFERENCES pedido(id),
  CONSTRAINT fk_pago_cajero FOREIGN KEY (cajero_id) REFERENCES usuario(id),
  CONSTRAINT ck_pago_valor CHECK (valor > 0),
  INDEX ix_pago_fecha (creado_en)
) ENGINE=InnoDB;

CREATE TABLE propina (
  id              INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  pedido_id       INT UNSIGNED NOT NULL UNIQUE,
  valor_sugerido  DECIMAL(12,2) NOT NULL,             -- 10 % del subtotal (Ley 1935 de 2018)
  valor           DECIMAL(12,2) NOT NULL DEFAULT 0,   -- lo que el cliente decidió dar
  respuesta       ENUM('aceptada','modificada','rechazada') NOT NULL,
  mesero_id       INT UNSIGNED NULL,                  -- a quién se le liquida
  cajero_id       INT UNSIGNED NOT NULL,              -- quién confirmó la respuesta del cliente
  creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_propina_pedido FOREIGN KEY (pedido_id) REFERENCES pedido(id),
  CONSTRAINT fk_propina_mesero FOREIGN KEY (mesero_id) REFERENCES usuario(id),
  CONSTRAINT fk_propina_cajero FOREIGN KEY (cajero_id) REFERENCES usuario(id),
  CONSTRAINT ck_propina_valores CHECK (valor >= 0 AND valor_sugerido >= 0),
  CONSTRAINT ck_propina_rechazada CHECK (respuesta <> 'rechazada' OR valor = 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 6. Domicilios (HU09 a HU11)
--    Ingresan por el formulario web (cliente) o por el cajero (llamada/WhatsApp).
--    Pago contra entrega o por transferencia anticipada.
-- ---------------------------------------------------------------------
CREATE TABLE cliente (
  id                  INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  nombre              VARCHAR(80)  NOT NULL,
  telefono            VARCHAR(20)  NOT NULL UNIQUE,   -- se busca por teléfono para no volver a pedir los datos
  direccion           VARCHAR(150) NOT NULL,
  barrio              VARCHAR(60)  NULL,
  referencia          VARCHAR(150) NULL,              -- "casa esquinera, portón negro"
  autoriza_datos      BOOLEAN      NOT NULL,          -- Ley 1581 de 2012: sin autorización no se guarda
  autorizacion_fecha  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  autorizacion_medio  ENUM('formulario_web','telefono_whatsapp') NOT NULL,
  creado_en           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT ck_cliente_autoriza CHECK (autoriza_datos = TRUE)
) ENGINE=InnoDB;

CREATE TABLE domicilio (
  id                    INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  pedido_id             INT UNSIGNED NOT NULL UNIQUE,
  cliente_id            INT UNSIGNED NOT NULL,
  canal                 ENUM('web','telefono_whatsapp') NOT NULL,
  metodo_pago           ENUM('contra_entrega','transferencia') NOT NULL,
  estado                ENUM('pendiente_pago','recibido','en_preparacion','en_camino','entregado','cancelado') NOT NULL,
  direccion_entrega     VARCHAR(150) NOT NULL,         -- copia de la dirección usada en este pedido
  valor_envio           DECIMAL(10,2) NOT NULL DEFAULT 0,
  registrado_por        INT UNSIGNED NULL,             -- cajero (NULL si lo hizo el cliente en la web)
  pago_confirmado_por   INT UNSIGNED NULL,             -- cajero que verificó la transferencia
  pago_confirmado_en    DATETIME NULL,
  motivo_cancelacion    VARCHAR(150) NULL,
  creado_en             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_domicilio_pedido     FOREIGN KEY (pedido_id)           REFERENCES pedido(id),
  CONSTRAINT fk_domicilio_cliente    FOREIGN KEY (cliente_id)          REFERENCES cliente(id),
  CONSTRAINT fk_domicilio_registra   FOREIGN KEY (registrado_por)      REFERENCES usuario(id),
  CONSTRAINT fk_domicilio_confirma   FOREIGN KEY (pago_confirmado_por) REFERENCES usuario(id),
  -- 'pendiente de pago' solo existe para transferencias
  CONSTRAINT ck_domicilio_pendiente CHECK (estado <> 'pendiente_pago' OR metodo_pago = 'transferencia'),
  -- una transferencia no avanza a preparación sin pago confirmado
  CONSTRAINT ck_domicilio_transferencia CHECK (
    metodo_pago <> 'transferencia'
    OR estado IN ('pendiente_pago','cancelado')
    OR pago_confirmado_en IS NOT NULL
  ),
  CONSTRAINT ck_domicilio_cancelado CHECK (estado <> 'cancelado' OR motivo_cancelacion IS NOT NULL),
  CONSTRAINT ck_domicilio_envio CHECK (valor_envio >= 0),
  INDEX ix_domicilio_estado (estado)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 7. Trazabilidad (RNF-06): quién cambió qué y cuándo
--    Pedidos (HU05), mesas (HU03) y estados de domicilio (HU11).
-- ---------------------------------------------------------------------
CREATE TABLE historial_cambio (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  entidad         ENUM('pedido','mesa','domicilio','producto') NOT NULL,
  entidad_id      INT UNSIGNED NOT NULL,
  accion          VARCHAR(40)  NOT NULL,     -- 'agregar_item', 'quitar_item', 'cambiar_estado', 'confirmar_pago'...
  valor_anterior  VARCHAR(255) NULL,
  valor_nuevo     VARCHAR(255) NULL,
  motivo          VARCHAR(150) NULL,         -- obligatorio al quitar un producto ya enviado a cocina
  usuario_id      INT UNSIGNED NULL,         -- NULL = acción del cliente desde el formulario web
  creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_historial_usuario FOREIGN KEY (usuario_id) REFERENCES usuario(id),
  INDEX ix_historial_entidad (entidad, entidad_id)
) ENGINE=InnoDB;
