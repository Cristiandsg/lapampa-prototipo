import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Inicio from './pages/Inicio';
import GuiaEstilo from './pages/GuiaEstilo';

// Las rutas de cada módulo se agregan sprint a sprint (login, mesas, caja, domicilios, reportes)
// y la ruta pública /pedir para el formulario de domicilio del cliente (Sprint 3).
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/estilo" element={<GuiaEstilo />} />
      </Routes>
    </BrowserRouter>
  );
}
