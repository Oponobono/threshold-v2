import * as FileSystem from 'expo-file-system/legacy';
import { PDFDocument } from 'pdf-lib';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Sharing from 'expo-sharing';

/**
 * Genera un archivo PDF a partir de una lista de URIs de imágenes locales.
 * Comprime cada imagen drásticamente para reducir el peso final del archivo,
 * incrusta las imágenes en el documento PDF usando `pdf-lib` y permite compartir el archivo.
 * 
 * @param uris - Arreglo de rutas locales de las imágenes a exportar.
 * @returns La ruta local del archivo PDF generado, o lanza un error si falla.
 */
export const generatePdfFromImages = async (uris: string[]): Promise<string> => {
  if (!uris || uris.length === 0) {
    throw new Error('No se proporcionaron imágenes para exportar.');
  }

  console.log('[PDF] Iniciando exportación. URIs:', uris);
  const pdfDoc = await PDFDocument.create();

  for (const uri of uris) {
    if (!uri) continue;
    console.log('[PDF] Procesando:', uri);

    try {
      // Comprimir imagen antes de incrustar (reduce de 5MB a ~300KB)
      // Esto acelera embedJpg y saveAsBase64 drásticamente
      const saveFormat = ImageManipulator.SaveFormat?.JPEG || 'jpeg';
      const compressed = await ImageManipulator.manipulateAsync(
        uri,
        [], // sin transformaciones de escala
        { compress: 0.7, format: saveFormat }
      );

      if (!compressed || !compressed.uri) {
        throw new Error(`Failed to compress image: ${uri}`);
      }

      console.log('[PDF] Imagen comprimida:', compressed.width, 'x', compressed.height);

      const fileResponse = await fetch(compressed.uri);
      if (!fileResponse.ok) {
        throw new Error(`Failed to fetch compressed image: ${fileResponse.statusText}`);
      }

      const arrayBuffer = await fileResponse.arrayBuffer();
      console.log('[PDF] ArrayBuffer bytes:', arrayBuffer.byteLength);

      const embeddedImage = await pdfDoc.embedJpg(arrayBuffer);
      console.log('[PDF] Imagen incrustada');

      // Página exactamente del tamaño de la imagen comprimida
      const page = pdfDoc.addPage([compressed.width, compressed.height]);
      page.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: compressed.width,
        height: compressed.height,
      });
      console.log('[PDF] Página añadida');
    } catch (error) {
      console.error('[PDF] Error procesando imagen:', uri, error);
      throw new Error(`Error procesando imagen ${uri}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  try {
    console.log('[PDF] Guardando...');
    const pdfBase64 = await pdfDoc.saveAsBase64({ dataUri: false });
    const pdfUri = `${FileSystem.cacheDirectory}Documento_${Date.now()}.pdf`;
    
    await FileSystem.writeAsStringAsync(
      pdfUri,
      pdfBase64,
      { encoding: FileSystem.EncodingType.Base64 }
    );
    console.log('[PDF] Guardado en:', pdfUri);

    const isSharingAvailable = await Sharing.isAvailableAsync();
    if (isSharingAvailable) {
      await Sharing.shareAsync(pdfUri);
    } else {
      console.warn('[PDF] Sharing is not available on this device');
    }

    console.log('[PDF] PDF completado y listo');

    return pdfUri;
  } catch (error) {
    console.error('[PDF] Error guardando PDF:', error);
    throw new Error(`Error al guardar el PDF: ${error instanceof Error ? error.message : String(error)}`);
  }
};
