// Corre antes de cada archivo de pruebas: apunta la API a la base de prueba.
process.env.DB_NAME = 'lapampa_test';
process.env.JWT_SECRET = 'secreto-de-prueba';
