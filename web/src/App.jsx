import { Navigate, Route, Routes } from 'react-router-dom';
import { SesionProvider } from './sesion/SesionContext';
import RequiereSesion from './components/RequiereSesion';
import Ingreso from './pages/Ingreso';
import Panel from './pages/Panel';
import Usuarios from './pages/Usuarios';
import Carta from './pages/Carta';
import Mesas from './pages/Mesas';
import Caja from './pages/Caja';
import TomarPedido from './pages/TomarPedido';
import VerPedido from './pages/VerPedido';
import Inicio from './pages/Inicio';
import GuiaEstilo from './pages/GuiaEstilo';

// Las rutas de cada módulo se agregan sprint a sprint (mesas, carta, caja, domicilios, reportes)
// y la ruta pública /pedir para el formulario de domicilio del cliente (Sprint 3).
export default function App() {
  return (
    <SesionProvider>
      <Routes>
        <Route path="/ingresar" element={<Ingreso />} />
        <Route path="/estado" element={<Inicio />} />
        <Route path="/estilo" element={<GuiaEstilo />} />
        <Route
          path="/"
          element={
            <RequiereSesion>
              <Panel />
            </RequiereSesion>
          }
        />
        <Route
          path="/usuarios"
          element={
            <RequiereSesion roles={['propietario']}>
              <Usuarios />
            </RequiereSesion>
          }
        />
        <Route
          path="/carta"
          element={
            <RequiereSesion roles={['propietario']}>
              <Carta />
            </RequiereSesion>
          }
        />
        <Route
          path="/mesas"
          element={
            <RequiereSesion roles={['mesero', 'propietario']}>
              <Mesas />
            </RequiereSesion>
          }
        />
        <Route
          path="/caja"
          element={
            <RequiereSesion roles={['cajero', 'propietario']}>
              <Caja />
            </RequiereSesion>
          }
        />
        <Route
          path="/mesas/:id/pedido"
          element={
            <RequiereSesion roles={['mesero', 'propietario']}>
              <TomarPedido />
            </RequiereSesion>
          }
        />
        <Route
          path="/pedidos/:id/agregar"
          element={
            <RequiereSesion roles={['mesero', 'propietario']}>
              <TomarPedido adicion />
            </RequiereSesion>
          }
        />
        <Route
          path="/pedidos/:id"
          element={
            <RequiereSesion>
              <VerPedido />
            </RequiereSesion>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SesionProvider>
  );
}
