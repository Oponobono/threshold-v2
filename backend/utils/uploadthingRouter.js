/**
 * Uploadthing Upload Router — v7
 * Define los tipos de archivos permitidos por endpoint.
 * Documentación: https://docs.uploadthing.com/backend/express
 */
const { createUploadthing } = require('uploadthing/express');

const f = createUploadthing();

const uploadRouter = {
  // Foto de perfil: máx 4MB, solo imágenes
  profileImage: f({ image: { maxFileSize: '4MB', maxFileCount: 1 } })
    .middleware(() => ({ uploadedAt: new Date().toISOString() }))
    .onUploadComplete(({ file }) => {
      console.log(`[Uploadthing] Foto de perfil subida: ${file.ufsUrl}`);
      return { url: file.ufsUrl };
    }),

  // Fotos de la galería académica: máx 8MB, hasta 10 fotos
  galleryPhoto: f({ image: { maxFileSize: '8MB', maxFileCount: 10 } })
    .middleware(() => ({ uploadedAt: new Date().toISOString() }))
    .onUploadComplete(({ file }) => {
      console.log(`[Uploadthing] Foto de galería subida: ${file.ufsUrl}`);
      return { url: file.ufsUrl };
    }),

  // Grabaciones de audio: máx 64MB
  audioRecording: f({ audio: { maxFileSize: '64MB', maxFileCount: 1 } })
    .middleware(() => ({ uploadedAt: new Date().toISOString() }))
    .onUploadComplete(({ file }) => {
      console.log(`[Uploadthing] Audio subido: ${file.ufsUrl}`);
      return { url: file.ufsUrl };
    }),

  // Documentos académicos (PDF, TXT): máx 32MB
  document: f({
    'application/pdf': { maxFileSize: '32MB' },
    'text/plain': { maxFileSize: '8MB' },
  })
    .middleware(() => ({ uploadedAt: new Date().toISOString() }))
    .onUploadComplete(({ file }) => {
      console.log(`[Uploadthing] Documento subido: ${file.ufsUrl}`);
      return { url: file.ufsUrl };
    }),
};

module.exports = { uploadRouter };
