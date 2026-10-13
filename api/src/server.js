const app = require('./app');
const env = require('./config/env');

app.listen(env.port, () => {
  console.log(`API de La Pampa escuchando en http://localhost:${env.port}/api`);
});
