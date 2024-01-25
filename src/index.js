import 'dotenv/config';
import { dirname, join } from 'path';
import { DOMImplementation, DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { Fiel, FielRequestBuilder, HttpsWebClient, Service } from '@nodecfdi/sat-ws-descarga-masiva';
import { fileURLToPath } from "url";
import { install } from '@nodecfdi/cfdiutils-common';
import { readFileSync } from 'fs';
import express from "express";


const app = express();
const port = 3000 || process.env.PORT

//instala tu gestor de DOM preferido para este ejemplo se usa @xmldom/xmldom
install(new DOMParser(), new XMLSerializer(), new DOMImplementation());

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const cerPath = join(__dirname, '_fiel', process.env.CERPATH);
const keyPath = join(__dirname, '_fiel', process.env.KEYPATH);
const passwordPath = join(__dirname, '_fiel', process.env.PASSWORDPATH);

// Creación de la FIEL, puede leer archivos DER (como los envía el SAT) o PEM (convertidos con openssl)
const fiel = Fiel.create(
    readFileSync(cerPath, 'binary'),
    readFileSync(keyPath, 'binary'),
    readFileSync(passwordPath, 'binary')
);
// verificar que la FIEL sea válida (no sea CSD y sea vigente acorde a la fecha del sistema)
if (!fiel.isValid()) {
   throw new Error('Error FIEL no valida')
}

// Creación del cliente web se usa el cliente incluido en nodeJS.
const webClient = new HttpsWebClient();

// creación del objeto encargado de crear las solicitudes firmadas usando una FIEL
const requestBuilder = new FielRequestBuilder(fiel);

// Creación del servicio
const service = new Service(requestBuilder, webClient);

console.log(service);
// app.get('/', (req, res)=>{
//     res.send('Siuuuuu!')
// })


app.listen(port, ()=>{
    console.log(`Server in running on port ${port}`);
})