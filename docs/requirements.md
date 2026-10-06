# Requisitos funcionales — Kitsune

Estado comprobado en el proyecto para RF01–RF24. «Parcial» significa que existe código o interfaz, pero no se cumple el criterio completo en producción.

| ID | Estado | Comportamiento y límite actual |
|---|---|---|
| RF01 | Funcional | Registro con correo y contraseña; correo duplicado devuelve 409. |
| RF02 | Funcional | Inicio de sesión con sesión persistida en PostgreSQL. |
| RF03 | Funcional | Cerrar sesión revoca la sesión del servidor. |
| RF04 | Pendiente | Recuperación por correo requiere proveedor de envío y flujo de tokens. |
| RF05 | Pendiente | No se verifica la propiedad del correo al registrarse. |
| RF06 | Parcial | El administrador configurado por variables puede usar TOTP con `ADMIN_TOTP_SECRET`; falta imponerlo a cuentas privilegiadas de base de datos y definir `EDITOR`. |
| RF07 | Parcial | Catálogo por título y género; no hay filtro público por estado porque solo se exponen series publicadas. |
| RF08 | Parcial | La ficha muestra temporadas y episodios publicados, si los hay. |
| RF09 | Funcional | Búsqueda por texto de título en catálogo. |
| RF10 | Parcial | Hay secciones de últimos episodios, populares, recomendados y continuar viendo; esta última solo muestra progreso guardado y todavía no reanuda video. |
| RF11 | Parcial | Prototipo HLS mediante Cloudinary Free y hls.js; falta configurar credenciales y probar con un MP4 autorizado. |
| RF12 | Parcial | El perfil `hd` de Cloudinary ofrece adaptación HLS; no está verificada la disponibilidad exacta de 480p/720p/1080p para cada fuente. |
| RF13 | Parcial | El reproductor envía progreso a PostgreSQL cada diez segundos y al pausar; falta probarlo con video real. |
| RF14 | Parcial | El reproductor consulta el progreso al abrir el episodio y busca esa posición; falta probarlo con video real. |
| RF15 | Pendiente | No hay pistas múltiples de audio o subtítulos por episodio. |
| RF16 | Funcional | Agregar y quitar favoritos en la interfaz; persisten por usuario. |
| RF17 | Parcial | Historial basado en progreso persistido; se poblará al registrar reproducciones reales. |
| RF18 | Funcional | Administrador crea, edita, publica/oculta y elimina series. |
| RF19 | Funcional | Administrador crea temporadas y episodios; la API también permite editarlos y eliminarlos. |
| RF20 | Parcial | Administrador puede subir MP4 directamente a Cloudinary mediante firma del servidor; límite de 20 MB en la interfaz, pendiente prueba real. |
| RF21 | Parcial | Cloudinary genera variantes HLS; no es un worker propio de FFmpeg como exige el requisito original. |
| RF22 | Parcial | Aviso de Cloudinary verificado marca el trabajo `ready`; la API rechaza publicar antes (409). Pendiente prueba real. |
| RF23 | Funcional | Cambios de series, temporadas, episodios y usuarios se auditan en la misma transacción de PostgreSQL. |
| RF24 | Parcial | El servidor exige sesión y episodio publicado antes de entregar la URL HLS; Cloudinary Free sirve una URL pública que puede compartirse, sin protección por segmento. |

## Condiciones para completar los pendientes

El despliegue usa PostgreSQL y puede conectarse a Cloudinary Free para un prototipo de video público con contenido propio o autorizado. Para RF04–RF06 falta proveedor de correo y completar recuperación, verificación y MFA. Para satisfacer estrictamente RF21 y RF24 harían falta el worker FFmpeg solicitado y entrega privada por segmento: Cloudinary Free no aporta tokens o cookies temporales para ese control. No use el prototipo con videos que deban permanecer privados ni anuncie streaming completo hasta probar toda la cadena.

## Requisitos no funcionales

- Las rutas administrativas requieren sesión `admin`; la base responde en el health check.
- El límite de ingreso se coordina en PostgreSQL entre instancias y reinicios: 12 intentos por IP en 15 minutos, incluidos los exitosos. Puede afectar redes compartidas; depende de la IP confiable del proxy y no limita el registro.
- Las migraciones numeradas son reproducibles. El pool está limitado a cinco conexiones por instancia; recalcular al escalar.
- Siguen pendientes pruebas de carga, respaldo/restauración, alertas, verificación de licencias y distribución multimedia.
