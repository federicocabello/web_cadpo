# Criterios permanentes del proyecto

- No ejecutar `npm run build` automáticamente. El usuario realiza la compilación manualmente.
- Mantener `README.md` actualizado cuando haya cambios generales o nuevas funciones relevantes; evitar registrar cada ajuste visual menor.
- Ante una ruta pública nueva, eliminada o renombrada, revisar y actualizar en conjunto:
  - `frontend/src/components/SeoManager.jsx` (título, descripción, términos relacionados y URL canónica);
  - `frontend/public/sitemap.xml` (solo URLs públicas canónicas y `lastmod` real cuando corresponda);
  - `frontend/public/robots.txt` si cambia qué contenido debe o no debe rastrearse;
  - los datos estructurados de `frontend/index.html` cuando cambien la identidad, enlaces oficiales o información general de CADPO.
- No agregar al sitemap rutas duplicadas, filtros, parámetros, endpoints de API ni Administración.
- Las rutas privadas o administrativas deben usar `noindex`; `robots.txt` no reemplaza autenticación ni controles de acceso.
