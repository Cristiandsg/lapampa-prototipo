import axios from 'axios';

// Cliente HTTP único para toda la app.
// El tiempo de espera es largo porque el servidor gratuito de Render tarda
// hasta un minuto en despertar después de un rato sin uso.
const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || ''}/api`,
  timeout: 70000,
});

// La sesión (SesionContext) le dice al cliente qué token usar y qué hacer si vence.
let obtenerToken = () => null;
let alVencerSesion = () => {};

export function configurarSesion({ token, vencida }) {
  obtenerToken = token;
  alVencerSesion = vencida;
}

api.interceptors.request.use((config) => {
  const token = obtenerToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (respuesta) => respuesta,
  (error) => {
    // Un 401 en cualquier ruta que no sea el login significa que la sesión venció
    // o que la cuenta ya no está activa: se cierra la sesión y se vuelve al ingreso.
    const esLogin = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !esLogin) alVencerSesion(error.response.data?.error);
    return Promise.reject(error);
  },
);

// Mensaje para mostrarle a la persona, en español, sea cual sea el error.
export function mensajeDeError(error) {
  if (error.response?.data?.error) return error.response.data.error;
  if (error.code === 'ECONNABORTED') {
    return 'El servidor tardó demasiado en responder. Intenta de nuevo.';
  }
  return 'No hay conexión con el servidor. Revisa el internet e intenta de nuevo.';
}

export async function obtenerSalud() {
  const { data } = await api.get('/salud');
  return data;
}

// ---------- Sesión (HU01) ----------
export async function iniciarSesion(usuario, contrasena) {
  const { data } = await api.post('/auth/login', { usuario, contrasena });
  return data; // { token, usuario }
}

export async function quienSoy() {
  const { data } = await api.get('/auth/yo');
  return data.usuario;
}

// ---------- Usuarios (HU01, solo propietario) ----------
export async function listarUsuarios() {
  const { data } = await api.get('/usuarios');
  return data.usuarios;
}

export async function crearUsuario(datos) {
  const { data } = await api.post('/usuarios', datos);
  return data.usuario;
}

export async function actualizarUsuario(id, cambios) {
  const { data } = await api.put(`/usuarios/${id}`, cambios);
  return data.usuario;
}

// ---------- Carta (HU02) ----------
export async function listarCategorias() {
  const { data } = await api.get('/categorias');
  return data;
}

export async function crearCategoria(datos) {
  const { data } = await api.post('/categorias', datos);
  return data;
}

export async function actualizarCategoria(id, cambios) {
  const { data } = await api.patch(`/categorias/${id}`, cambios);
  return data;
}

export async function eliminarCategoria(id) {
  await api.delete(`/categorias/${id}`);
}

// filtros: { categoria_id, activos: true, disponibles: true }
export async function listarProductos(filtros = {}) {
  const { data } = await api.get('/productos', { params: filtros });
  return data;
}

export async function crearProducto(datos) {
  const { data } = await api.post('/productos', datos);
  return data;
}

export async function actualizarProducto(id, cambios) {
  const { data } = await api.patch(`/productos/${id}`, cambios);
  return data;
}

// ---------- Mesas (HU03) ----------
export async function listarMesas() {
  const { data } = await api.get('/mesas');
  return data;
}

export async function crearMesa(nombre) {
  const { data } = await api.post('/mesas', { nombre });
  return data;
}

export async function renombrarMesa(id, nombre) {
  const { data } = await api.patch(`/mesas/${id}`, { nombre });
  return data;
}

export async function eliminarMesa(id) {
  await api.delete(`/mesas/${id}`);
}

export async function quitarMesasLibres() {
  const { data } = await api.post('/mesas/quitar-libres');
  return data.cantidad;
}

export default api;
