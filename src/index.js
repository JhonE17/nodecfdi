import express from "express";

import { readFileSync, writeFileSync } from 'fs';
import { Fiel, HttpsWebClient, FielRequestBuilder, Service, ServiceEndpoints, ServiceType, RequestType, QueryParameters, DateTimePeriod, CfdiPackageReader, OpenZipFileException } from '@nodecfdi/sat-ws-descarga-masiva';
import { install } from '@nodecfdi/cfdiutils-common';
import { DOMParser, XMLSerializer, DOMImplementation } from '@xmldom/xmldom';

const app = express();
const port = 3000 || process.env.PORT

//instala tu gestor de DOM preferido para este ejemplo se usa @xmldom/xmldom
install(new DOMParser(), new XMLSerializer(), new DOMImplementation());

const cerPath = 'C:\\Users\\Casty\\OneDrive\\Documents\\GitProyects\\sdsd\\nodecfdi\\src\\fiel\\OEOO760411SQ6.cer';
const keyPath = 'C:\\Users\\Casty\\OneDrive\\Documents\\GitProyects\\sdsd\\nodecfdi\\src\\fiel\\OEOO760411SQ6.key';

// Creación de la FIEL, puede leer archivos DER (como los envía el SAT) o PEM (convertidos con openssl)
const fiel = Fiel.create(
    readFileSync(cerPath, 'binary'),
    readFileSync(keyPath, 'binary'),
    'OSCARO8A'
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
//const service = new Service(requestBuilder, webClient);


const service = new Service(requestBuilder, webClient, undefined, ServiceEndpoints.cfdi());

console.log("Servicio:", service);
// app.get('/', (req, res)=>{
//     res.send('Siuuuuu!')
// })
const requestTypeInstance = new RequestType('cfdi');



app.listen(port, async () => {
    console.log(`Server in running on port ${port}`);
    const request = QueryParameters.create(
        DateTimePeriod.createFromValues('2023-09-01 00:00:00', '2023-09-30 23:59:59'),

        );

    // presentar la consulta
    const query = await service.query(request);

    // verificar que el proceso de consulta fue correcto
    if (!query.getStatus().isAccepted()) {
        console.log(`Fallo al presentar la consulta: ${query.getStatus().getMessage()}`);
        return;

    }

    console.log(`Se generó la solicitud ${query.getRequestId()} +  ${query.t}`);


    const requestId = query.getRequestId();
    try {
        const verify = await service.verify(requestId);

        // revisar que el proceso de verificación fue correcto
        if (!verify.getStatus().isAccepted()) {
            console.log(`Fallo al verificar la consulta ${requestId}: ${verify.getStatus().getMessage()}`);
            return;
        }

        // revisar el progreso de la generación de los paquetes
        const statusRequest = verify.getStatusRequest();
        if (statusRequest.isTypeOf('Expired') || statusRequest.isTypeOf('Failure') || statusRequest.isTypeOf('Rejected')) {
            console.log(`La solicitud ${requestId} no se puede completar`);
            return;
        }

        if (statusRequest.isTypeOf('InProgress') || statusRequest.isTypeOf('Accepted')) {
            console.log(`La solicitud ${requestId} se está procesando`);
            return;
        }
        if (statusRequest.isTypeOf('Finished')) {
            console.log(`La solicitud ${requestId} está lista`);
        }

        console.log(`Se encontraron ${verify.countPackages()} paquetes`);
        let zipFile = [];
       
        const packageID = verify.getPackageIds();
        for (const packageId of packageID) {
            console.log(` > ${packageId}`)
            const download = await service.download(packageId);
            if (!download.getStatus().isAccepted()) {
                console.log(`El paquete ${packageId} no se ha podido descargar: ${download.getStatus().getMessage()}`);
                continue;
            }
            writeFileSync(`CFDI/${packageId}.zip`, Buffer.from(download.getPackageContent(), 'base64'));
            console.log(`el paquete ${packageId} se ha almacenado`);
            zipFile.push(`CFDI/${packageId}.zip`);
        }


        let cfdiReader;
        try {
            console.log("zip: ",zipFile[0]);
            cfdiReader = await CfdiPackageReader.createFromFile(zipFile[0]);
             console.log("cfdiReader:",cfdiReader, "Nombre:" , cfdiReader.getFilename())
        } catch (error) {
            console.log("Error:",error.message);
            return;
        }

        for await (const map of cfdiReader.cfdis()) {
            console.log("Entro a For Await")
            for (const [name, content] of map) {
                writeFileSync(`CFDI/${name}.xml`, Buffer.from(content, 'utf8'));
            }
        }
    } catch (error) {
        console.error("Error:", error);
    }

})
