import 'dotenv/config';
import { DOMImplementation, DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { install } from '@nodecfdi/cfdiutils-common';
import express from 'express';
import cors from 'cors';
import router from './src/routes/index.js';
import hbs from 'hbs';
import { baseDir } from './src/config/config.js';
import multerConfig from './src/utils/multerConfig.js'; 
//import multer from 'multer'; 

const app = express();
const PORT = 3000 || process.env.PORT;

//instala tu gestor de DOM preferido para este ejemplo se usa @xmldom/xmldom
install(new DOMParser(), new XMLSerializer(), new DOMImplementation());

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }))
;
app.use('/api', multerConfig.fields([
  { name: 'certificado', maxCount: 1 },
  { name: 'clave', maxCount: 1 },
]), router);


hbs.registerPartial(baseDir + '/views/partials', (err)=>console.log(err));
app.set('view engine', 'hbs')
app.set('views', baseDir + '/views');

app.get('/', (req, res)=>{
  res.render('index')
})


app.listen(PORT, async () => {
  console.log(`Server in running on port ${PORT}`);
});
