
import multer from 'multer';

const storage = multer.memoryStorage(); 
const multerConfig = multer({ storage: storage });

export default multerConfig;
