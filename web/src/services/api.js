import axios from 'axios';

// Cliente HTTP único para toda la app. En Sprint 1 se le agrega el token JWT.
const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || ''}/api`,
  timeout: 10000,
});

export async function obtenerSalud() {
  const { data } = await api.get('/salud');
  return data;
}

export default api;
