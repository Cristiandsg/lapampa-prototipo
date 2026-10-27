// Guarda la sesión en el navegador del celular para no pedir la contraseña
// cada vez que se recarga la página. Si el navegador no deja guardar
// (modo privado), la app sigue funcionando: solo no recuerda la sesión.
const CLAVE = 'lapampa.sesion';

export function leerSesion() {
  try {
    const guardada = JSON.parse(localStorage.getItem(CLAVE));
    return guardada?.token && guardada?.usuario ? guardada : null;
  } catch {
    return null;
  }
}

export function guardarSesion(sesion) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(sesion));
  } catch {
    // sin almacenamiento disponible
  }
}

export function borrarSesion() {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // sin almacenamiento disponible
  }
}

// Milisegundos que le quedan al token (lee el campo "exp" del JWT). 0 si ya venció o no se puede leer.
export function tiempoRestante(token) {
  try {
    const parte = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(parte));
    return Math.max(0, exp * 1000 - Date.now());
  } catch {
    return 0;
  }
}
