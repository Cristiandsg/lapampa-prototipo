# Modelo Entidad-Relación — La Pampa Gastrobar

GitHub dibuja este diagrama automáticamente al abrir el archivo. Para exportarlo como imagen (para el documento de grado), pega el bloque en https://mermaid.live y descarga PNG o SVG.

```mermaid
erDiagram
    ROL ||--o{ USUARIO : "tiene"
    USUARIO ||--o{ MESA : "crea"
    USUARIO ||--o{ PEDIDO : "toma (mesero)"
    USUARIO ||--o{ PAGO : "registra (cajero)"
    USUARIO ||--o{ PROPINA : "confirma / recibe"
    USUARIO ||--o{ DOMICILIO : "registra / confirma pago"
    USUARIO ||--o{ HISTORIAL_CAMBIO : "realiza"
    CATEGORIA ||--o{ PRODUCTO : "agrupa"
    MESA ||--o{ PEDIDO : "recibe"
    PEDIDO ||--|{ DETALLE_PEDIDO : "contiene"
    PRODUCTO ||--o{ DETALLE_PEDIDO : "aparece en"
    PEDIDO ||--o{ PAGO : "se paga con"
    PEDIDO ||--o| PROPINA : "genera"
    PEDIDO ||--o| DOMICILIO : "se entrega como"
    CLIENTE ||--o{ DOMICILIO : "solicita"

    ROL {
        tinyint id PK
        varchar nombre UK "propietario | cajero | mesero"
    }
    USUARIO {
        int id PK
        varchar nombre
        varchar usuario UK
        char contrasena_hash "bcrypt"
        tinyint rol_id FK
        boolean activo
        tinyint intentos_fallidos
        datetime bloqueado_hasta
    }
    CATEGORIA {
        smallint id PK
        varchar nombre UK
        smallint orden
        boolean activa
    }
    PRODUCTO {
        int id PK
        smallint categoria_id FK
        varchar nombre UK
        decimal precio "mayor que 0"
        boolean activo
        boolean agotado_hoy
    }
    MESA {
        int id PK
        varchar nombre "libre, único entre activas"
        enum estado "libre | ocupada | por_cobrar"
        boolean activa
        int creada_por FK
    }
    PEDIDO {
        int id PK "consecutivo"
        enum canal "mesa | domicilio"
        int mesa_id FK "solo canal mesa"
        int mesero_id FK
        enum estado "abierto | por_cobrar | pagado | cancelado"
        decimal subtotal
        datetime creado_en
    }
    DETALLE_PEDIDO {
        int id PK
        int pedido_id FK
        int producto_id FK
        smallint cantidad
        decimal precio_unitario "precio del momento"
        varchar nota
    }
    PAGO {
        int id PK
        int pedido_id FK
        enum medio "efectivo | tarjeta | transferencia"
        decimal valor
        int cajero_id FK
    }
    PROPINA {
        int id PK
        int pedido_id FK,UK
        decimal valor_sugerido "10 %"
        decimal valor
        enum respuesta "aceptada | modificada | rechazada"
        int mesero_id FK
        int cajero_id FK
    }
    CLIENTE {
        int id PK
        varchar nombre
        varchar telefono UK
        varchar direccion
        boolean autoriza_datos "Ley 1581"
        enum autorizacion_medio
    }
    DOMICILIO {
        int id PK
        int pedido_id FK,UK
        int cliente_id FK
        enum canal "web | telefono_whatsapp"
        enum metodo_pago "contra_entrega | transferencia"
        enum estado "pendiente_pago ... entregado | cancelado"
        decimal valor_envio
        int registrado_por FK
        int pago_confirmado_por FK
        datetime pago_confirmado_en
    }
    HISTORIAL_CAMBIO {
        bigint id PK
        enum entidad "pedido | mesa | domicilio | producto"
        int entidad_id
        varchar accion
        varchar motivo
        int usuario_id FK
        datetime creado_en
    }
```
