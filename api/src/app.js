const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const rutas = require('./routes');
const { noEncontrado, manejarErrores } = require('./middlewares/errores');

const app = express();

// Render pone un proxy delante de la API: así req.ip es la IP real del celular, que usa el
// límite de pedidos del formulario público de domicilios (HU09). Se confía solo en ese proxy.
app.set('trust proxy', 1);

app.use(cors({ origin: env.corsOrigen }));
app.use(express.json());

app.use('/api', rutas);

app.use(noEncontrado);
app.use(manejarErrores);

module.exports = app;
