import {
  Fiel,
  FielRequestBuilder,
  HttpsWebClient,
  Service,
  QueryParameters,
  DateTimePeriod,
  CfdiPackageReader,
  RequestType,
} from '@nodecfdi/sat-ws-descarga-masiva';
import { readFileSync, writeFileSync } from 'fs';
// import { cerPath, keyPath,  } from '../config/config.js';

import { baseDir } from '../config/config.js';
import { validDate } from '../utils/validator.js';
import fs from 'fs';
import tmp from 'tmp';
export const descargaMasivaCdfi = async (req, res) => {

  const passwordFilePath = baseDir + '\\_fiel\\password.txt';
  const password = req.body.password; 
  writeFileSync(passwordFilePath, password, 'utf8');

  const certPath = baseDir + '\\_fiel\\' + req.files.certificado[0].originalname;
  fs.writeFileSync(certPath, req.files.certificado[0].buffer);

  // Guarda el archivo .key en la carpeta
  const keyPath = baseDir + '\\_fiel\\' + req.files.clave[0].originalname;
  fs.writeFileSync(keyPath, req.files.clave[0].buffer);

  const { dateStart, dateEnd } = req.body;
  validDate(dateStart, dateEnd);

  // Creación de la FIEL, puede leer archivos DER (como los envía el SAT) o PEM (convertidos con openssl)
  const fiel = Fiel.create(
    readFileSync(certPath, 'binary'),
    readFileSync(keyPath, 'binary'),
    readFileSync(passwordFilePath, 'binary')
  );
  // verificar que la FIEL sea válida (no sea CSD y sea vigente acorde a la fecha del sistema)
  if (!fiel.isValid()) {
    res.status(500).json({
      error: 'Error FIEL no valida',
    });
    throw new Error('Error FIEL no valida');
  }

  // Creación del cliente web se usa el cliente incluido en nodeJS.
  const webClient = new HttpsWebClient();

  // creación del objeto encargado de crear las solicitudes firmadas usando una FIEL
  const requestBuilder = new FielRequestBuilder(fiel);

  // Creación del servicio
  const service = new Service(requestBuilder, webClient);

  // Consulta
  const xml = new RequestType('xml');

  const request = QueryParameters.create(
    DateTimePeriod.createFromValues(dateStart, dateEnd)
  ).withRequestType(xml);

  // presentar la consulta
  let query = await service.query(request);

  // verificar que el proceso de consulta fue correcto
  if (!query.getStatus().isAccepted()) {
    res.status(500).json({
      error: `Fallo al presentar la consulta: ${query.getStatus().getCode()}`,
    });
    return;
  }

  console.log(`Se generó la solicitud ${query.getRequestId()} +  ${query.t}`);

  const requestId = query.getRequestId();
  let base64Content = '';
  let tmpDir = '';

  try {
    let verify = await service.verify(requestId);

    // revisar que el proceso de verificación fue correcto
    if (!verify.getStatus().isAccepted()) {
      res.status(500).json({
        error: `Fallo al verificar la consulta ${requestId}: ${verify.getStatus().getMessage()}`,
      });
      return;
    }

    // revisar el progreso de la generación de los paquetes
    let statusRequest = verify.getStatusRequest();
    if (
      statusRequest.isTypeOf('Expired') ||
      statusRequest.isTypeOf('Failure') ||
      statusRequest.isTypeOf('Rejected')
    ) {
      res.status(400).json({
        message: 'La solictud no se puede completar verifique los datos enviados'
      })
      console.log(`La solicitud ${requestId} no se puede completar`);
      return;
    }

  if (statusRequest.isTypeOf('InProgress') ) {
      console.log(`La solicitud ${requestId} se está procesando`);
      // return;
    }
    if(statusRequest.isTypeOf('Accepted')) {
      console.log(`La solicitud ${requestId} se ha aceptado`);

    }
    if (statusRequest.isTypeOf('Finished')) {
      console.log(`La solicitud ${requestId} está lista`);
    }

    console.log(`Se encontraron ${verify.countPackages()} paquetes`);
    let intentos = 0;

    // Esperar a que se generen los paquetes
    while ( statusRequest.isTypeOf('Accepted') && verify.countPackages() === 0 && intentos < 3) {
        await new Promise(resolve => setTimeout(resolve, 60000));
        query = await service.query(request);
        console.log(`La solicitud ${requestId} se está reenviando..`);
        verify = await service.verify(requestId);
        statusRequest = verify.getStatusRequest();

        intentos++;
    }

    // Verificar si se encontraron paquetes después de los intentos
    if ( statusRequest.isTypeOf('Accepted')&& verify.countPackages() === 0) {
        res.status(400).json({
            message: 'No se encontraron paquetes después de varios intentos',
        });
        return;
    }
    let zipFile = [];

    const packageID = verify.getPackageIds();
    for (const packageId of packageID) {
      console.log(` > ${packageId}`);
      const download = await service.download(packageId);
      if (!download.getStatus().isAccepted()) {
        console.log(
          `El paquete ${packageId} no se ha podido descargar: ${download.getStatus().getMessage()}`
        );
        continue;
      }
      base64Content = download.getPackageContent();
      
       tmpDir = tmp.dirSync().name;
       fs.writeFileSync(`${tmpDir}/${packageId}.zip`, Buffer.from(download.getPackageContent(), 'base64'));

      console.log(`el paquete ${packageId} se ha almacenado`);
      zipFile.push(`${tmpDir}/${packageId}.zip`);
    }

    let cfdiReader;
    try {
      console.log('zip: ', zipFile[0]);
      cfdiReader = await CfdiPackageReader.createFromFile(zipFile[0]);
      console.log('cfdiReader:', cfdiReader, 'Nombre:', cfdiReader.getFilename());
    } catch (error) {

      console.log('Error:', error.message);
      return;
    }

    for await (const map of cfdiReader.cfdis()) {
      for (const [name, content] of map) {
        fs.writeFileSync(`${tmpDir}/${name}.xml`, Buffer.from(content, 'utf8'));
      }
    }
    res.status(200).json({
      message: 'Paquete descargado y exportado a XML!',
      name: `${cfdiReader.getFilename()}`,
      base64Content: base64Content,
    });

    fs.unlinkSync(certPath);
    fs.unlinkSync(keyPath);
    fs.unlinkSync(passwordFilePath);

  } catch (error) {
    console.error('Error:', error);
  }

};
