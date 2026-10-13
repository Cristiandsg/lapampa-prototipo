const { Router } = require('express');
const { obtenerSalud } = require('../controllers/salud.controller');

const router = Router();
router.get('/', obtenerSalud);

module.exports = router;
