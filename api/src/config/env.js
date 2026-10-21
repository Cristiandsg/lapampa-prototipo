require('dotenv').config();

// SSL para MySQL en la nube (Aiven lo exige). En local con XAMPP se deja DB_SSL vacío.
// DB_SSL_CA es el "CA certificate" que entrega Aiven: con sus saltos de línea reales
// (entre comillas en .env.nube) o en una sola línea con \n.
function configurarSsl() {
  if (process.env.DB_SSL !== 'true') return undefined;
  const ca = process.env.DB_SSL_CA;
  return ca
    ? { ca: ca.replace(/\\n/g, '\n'), rejectUnauthorized: true }
    : { rejectUnauthorized: true };
}

const env = {
  port: Number(process.env.PORT) || 3000,
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'lapampa',
    ssl: configurarSsl(),
  },
  jwt: {
    secreto: process.env.JWT_SECRET || 'solo-para-desarrollo',
    expira: process.env.JWT_EXPIRA || '12h',
  },
  // Uno o varios orígenes separados por coma (por ejemplo, la URL de Vercel y localhost).
  corsOrigen: (process.env.CORS_ORIGEN || 'http://localhost:5173')
    .split(',')
    .map((origen) => origen.trim())
    .filter(Boolean),
};

module.exports = env;
