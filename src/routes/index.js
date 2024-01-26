import express from 'express';
import { descargaMasivaCdfi } from '../controllers/descargaMasivaCdfi.js';
const router = express.Router();

// Descarga Masiva CFDI
router.post('/descarga-masiva-cfdi', descargaMasivaCdfi);

export default router;
