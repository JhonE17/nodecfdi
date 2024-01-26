import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const baseDir = join(__dirname, '..');

const cerPath = join(baseDir, '_fiel', process.env.CERPATH);
const keyPath = join(baseDir, '_fiel', process.env.KEYPATH);
const passwordPath = join(baseDir, '_fiel', process.env.PASSWORDPATH);

export { cerPath, keyPath, passwordPath };
