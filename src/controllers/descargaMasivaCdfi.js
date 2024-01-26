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
import { cerPath, keyPath, passwordPath } from '../config/config.js';
import { validDate } from '../utils/validator.js';

export const descargaMasivaCdfi = async (req, res) => {
  const { dateStart, dateEnd } = req.body;
  validDate(dateStart, dateEnd);

  // Creación de la FIEL, puede leer archivos DER (como los envía el SAT) o PEM (convertidos con openssl)
  const fiel = Fiel.create(
    readFileSync(cerPath, 'binary'),
    readFileSync(keyPath, 'binary'),
    readFileSync(passwordPath, 'binary')
  );
  // verificar que la FIEL sea válida (no sea CSD y sea vigente acorde a la fecha del sistema)
  if (!fiel.isValid()) {
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
  const query = await service.query(request);

  // verificar que el proceso de consulta fue correcto
  if (!query.getStatus().isAccepted()) {
    res.status(500).json({
      error: `Fallo al presentar la consulta: ${query.getStatus().getCode()}`,
    });
    return;
  }

  console.log(`Se generó la solicitud ${query.getRequestId()} +  ${query.t}`);

  const requestId = query.getRequestId();
  try {
    const verify = await service.verify(requestId);

    // revisar que el proceso de verificación fue correcto
    if (!verify.getStatus().isAccepted()) {
      res.status(500).json({
        error: `Fallo al verificar la consulta ${requestId}: ${verify.getStatus().getMessage()}`,
      });
      return;
    }

    // revisar el progreso de la generación de los paquetes
    const statusRequest = verify.getStatusRequest();
    if (
      statusRequest.isTypeOf('Expired') ||
      statusRequest.isTypeOf('Failure') ||
      statusRequest.isTypeOf('Rejected')
    ) {
      res.status(400).json({
        message:'La solictud no se puede completar verifique los datos enviados'
      })
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
      console.log(` > ${packageId}`);
      const download = await service.download(packageId);
      if (!download.getStatus().isAccepted()) {
        console.log(
          `El paquete ${packageId} no se ha podido descargar: ${download.getStatus().getMessage()}`
        );
        continue;
      }
      writeFileSync(`CFDI/${packageId}.zip`, Buffer.from(download.getPackageContent(), 'base64'));
      console.log(`el paquete ${packageId} se ha almacenado`);
      zipFile.push(`CFDI/${packageId}.zip`);
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
        writeFileSync(`CFDI/${name}.xml`, Buffer.from(content, 'utf8'));
      }
    }
    res.status(200).json({
      message: 'Paquete descargado y exportado a XML!',
      name: `${cfdiReader.getFilename()}`,
    });
  } catch (error) {
    console.error('Error:', error);
  }
};
