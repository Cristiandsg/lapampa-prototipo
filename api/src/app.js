const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const rutas = require('./routes');
const { noEncontrado, manejarErrores } = require('./middlewares/errores');

const app = express();

app.use(cors({ origin: env.corsOrigen }));
app.use(express.json());

app.use('/api', rutas);

app.use(noEncontrado);
app.use(manejarErrores);

module.exports = app;
