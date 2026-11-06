import '@testing-library/jest-dom/vitest';

// jsdom no implementa el desplazamiento de la ventana (lo usa /pedir al cambiar de paso)
window.scrollTo = () => {};
