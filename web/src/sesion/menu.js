// Opciones del menú y quién las ve (HU01: cada rol ve solo lo suyo).
// "sprint" indica cuándo se construye la pantalla; mientras tanto se muestra como próxima.
export const OPCIONES = [
  {
    ruta: '/mesas',
    titulo: 'Mesas y pedidos',
    descripcion: 'Crear las mesas de la jornada y tomar pedidos',
    roles: ['mesero', 'propietario'],
    sprint: 1,
    disponible: true,
  },
  {
    ruta: '/carta',
    titulo: 'Carta',
    descripcion: 'Productos, precios y agotados del día',
    roles: ['propietario'],
    sprint: 1,
    disponible: true,
  },
  {
    ruta: '/caja',
    titulo: 'Caja',
    descripcion: 'Cuentas por cobrar, pagos y propinas',
    roles: ['cajero', 'propietario'],
    sprint: 2,
    disponible: true,
  },
  {
    ruta: '/domicilios',
    titulo: 'Domicilios',
    descripcion: 'Pedidos a domicilio y su estado',
    roles: ['cajero', 'propietario'],
    sprint: 3,
  },
  {
    ruta: '/reportes',
    titulo: 'Reportes',
    descripcion: 'Ventas, propinas y más vendidos',
    roles: ['propietario'],
    sprint: 4,
  },
  {
    ruta: '/usuarios',
    titulo: 'Usuarios',
    descripcion: 'Cuentas del personal y sus roles',
    roles: ['propietario'],
    disponible: true,
  },
];

export const NOMBRE_ROL = { propietario: 'Propietario', cajero: 'Cajero', mesero: 'Mesero' };

export function opcionesDe(rol) {
  return OPCIONES.filter((o) => o.roles.includes(rol));
}
