import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { configurarSesion, iniciarSesion as pedirIngreso, quienSoy } from '../services/api';
import { borrarSesion, guardarSesion, leerSesion, tiempoRestante } from './almacen';

const SesionContext = createContext(null);

function sesionInicial() {
  const guardada = leerSesion();
  if (!guardada) return { sesion: null, aviso: null };
  if (tiempoRestante(guardada.token) === 0) {
    borrarSesion();
    return { sesion: null, aviso: 'Tu sesión venció. Vuelve a iniciar sesión.' };
  }
  return { sesion: guardada, aviso: null };
}

export function SesionProvider({ children }) {
  const navigate = useNavigate();
  const [inicial] = useState(sesionInicial);
  const [sesion, setSesion] = useState(inicial.sesion);
  // Mensaje que se muestra en la pantalla de ingreso (sesión vencida, cuenta desactivada…)
  const [aviso, setAviso] = useState(inicial.aviso);

  const cerrarSesion = useCallback(
    (mensaje = null) => {
      borrarSesion();
      setSesion(null);
      setAviso(mensaje);
      navigate('/ingresar', { replace: true });
    },
    [navigate],
  );

  const ingresar = useCallback(async (usuario, contrasena) => {
    const nueva = await pedirIngreso(usuario, contrasena);
    guardarSesion(nueva);
    setAviso(null);
    setSesion(nueva);
    return nueva.usuario;
  }, []);

  // El cliente HTTP usa el token actual y avisa cuando la API responde 401.
  // Se configura durante el primer render (no en un efecto) porque las pantallas
  // hijas piden datos en sus propios efectos, que corren antes que los del proveedor.
  const sesionRef = useRef(sesion);
  sesionRef.current = sesion;
  const cerrarRef = useRef(cerrarSesion);
  cerrarRef.current = cerrarSesion;
  useState(() =>
    configurarSesion({
      token: () => sesionRef.current?.token ?? null,
      vencida: (mensaje) =>
        cerrarRef.current(mensaje || 'Tu sesión venció. Vuelve a iniciar sesión.'),
    }),
  );

  // Cierra la sesión sola cuando el token vence, aunque la app siga abierta.
  useEffect(() => {
    if (!sesion) return undefined;
    const espera = tiempoRestante(sesion.token);
    const temporizador = setTimeout(
      () => cerrarSesion('Tu sesión venció. Vuelve a iniciar sesión.'),
      Math.min(espera, 2 ** 31 - 1),
    );
    return () => clearTimeout(temporizador);
  }, [sesion, cerrarSesion]);

  // Al abrir la app con una sesión guardada, se confirma con la API que la cuenta
  // sigue activa y se toma el rol actualizado (el propietario pudo cambiarlo).
  const token = sesion?.token;
  useEffect(() => {
    if (!token) return;
    let vigente = true;
    quienSoy()
      .then((usuario) => {
        if (!vigente) return;
        setSesion((actual) => {
          if (!actual || actual.token !== token) return actual;
          const nueva = { ...actual, usuario };
          guardarSesion(nueva);
          return nueva;
        });
      })
      .catch(() => {}); // un 401 ya lo maneja el cliente HTTP; sin internet se sigue con lo guardado
    return () => {
      vigente = false;
    };
  }, [token]);

  const valor = useMemo(
    () => ({ usuario: sesion?.usuario ?? null, aviso, ingresar, cerrarSesion }),
    [sesion, aviso, ingresar, cerrarSesion],
  );

  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>;
}

export function useSesion() {
  const contexto = useContext(SesionContext);
  if (!contexto) throw new Error('useSesion debe usarse dentro de <SesionProvider>');
  return contexto;
}
