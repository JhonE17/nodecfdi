// multerConfig.js
import multer from 'multer';

const storage = multer.memoryStorage(); // Almacenar en memoria para acceder al buffer de los archivos
const multerConfig = multer({ storage: storage });

export default multerConfig;
