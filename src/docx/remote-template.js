/**
 * remote-template.js
 * Obtiene un .docx remoto (por URL pública o base64) y lo devuelve como Buffer.
 */

 const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

 const ALLOWED_HOSTS = [
     's3.amazonaws.com',
     's3.us-east-1.amazonaws.com',
     's3.us-west-2.amazonaws.com',
 ];
 
 function decodeBase64Template(b64string) {
     const base64Data = b64string.includes(',')
         ? b64string.split(',')[1]
         : b64string;
 
     const buffer = Buffer.from(base64Data, 'base64');
 
     if (buffer.length > MAX_SIZE_BYTES) {
         throw new Error('El template supera el tamaño máximo permitido (10 MB).');
     }
 
     // Los .docx son ZIPs y siempre empiezan con PK
     if (buffer[0] !== 0x50 || buffer[1] !== 0x4B) {
         throw new Error('El archivo no parece ser un .docx válido.');
     }
 
     return buffer;
 }
 
 async function fetchRemoteTemplate(url) {
     let parsed;
     try {
         parsed = new URL(url);
     } catch {
         throw new Error('templateUrl inválida.');
     }
 
     const allowed = ALLOWED_HOSTS.some(
         h => parsed.hostname === h || parsed.hostname.endsWith('.' + h)
     );
     if (!allowed) {
         throw new Error(`Host no permitido: ${parsed.hostname}`);
     }
 
     const controller = new AbortController();
     const timeout = setTimeout(() => controller.abort(), 15_000);
 
     let response;
     try {
         response = await fetch(url, { signal: controller.signal });
     } catch (err) {
         throw new Error(`No se pudo descargar el template: ${err.message}`);
     } finally {
         clearTimeout(timeout);
     }
 
     if (!response.ok) {
         throw new Error(`Error descargando template: HTTP ${response.status}`);
     }
 
     const contentLength = response.headers.get('content-length');
     if (contentLength && parseInt(contentLength) > MAX_SIZE_BYTES) {
         throw new Error('El template supera el tamaño máximo permitido (10 MB).');
     }
 
     const buffer = Buffer.from(await response.arrayBuffer());
 
     if (buffer.length > MAX_SIZE_BYTES) {
         throw new Error('El template supera el tamaño máximo permitido (10 MB).');
     }
 
     return buffer;
 }
 
 module.exports = { fetchRemoteTemplate, decodeBase64Template };