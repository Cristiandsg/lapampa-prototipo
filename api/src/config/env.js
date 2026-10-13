require('dotenv').config();

const env = {
  port: Number(process.env.PORT) || 3000,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'lapampa',
  },
  jwt: {
    secreto: process.env.JWT_SECRET || 'solo-para-desarrollo',
    expira: process.env.JWT_EXPIRA || '12h',
  },
  corsOrigen: process.env.CORS_ORIGEN || 'http://localhost:5173',
};

module.exports = env;
