# Kitsune Streaming

Plataforma de catálogo y tráilers de anime con API Node/Express, PostgreSQL en Supabase y panel administrativo. Esta versión sustituye las sesiones de demostración del navegador por autenticación y autorización del servidor.

## Estado real

El catálogo, registro, inicio de sesión, sesiones, roles, creación de series y episodios, auditoría y cola de trabajos se guardan en PostgreSQL. El tráiler de Mushoku Tensei es MP4 y el de Astral Edge es una animación del navegador. La cola de medios registra trabajos, pero **todavía no hay un trabajador FFmpeg/Kafka ni reproducción HLS**. No se debe presentar como servicio de streaming completo hasta implementar y validar esa fase. Consulte [requisitos](docs/requirements.md) y [arquitectura](docs/architecture.md).

## Requisitos

- Node.js 22 o posterior.
- Una base PostgreSQL de Supabase accesible mediante la cadena de conexión del *session pooler*.
- Derechos de publicación sobre imágenes y vídeos antes de hacer público el proyecto.

## Desarrollo local

```powershell
npm ci
Copy-Item .env.example .env
```

Edite `.env` con su propia `DATABASE_URL`, `ADMIN_EMAIL` y una `ADMIN_PASSWORD` robusta. No publique este archivo. Node no carga `.env` automáticamente en este proyecto; inicie así:

```powershell
node --env-file=.env server/migrate.js
node --env-file=.env server/index.js
```

Abra `http://localhost:4173/`. Para pruebas sin recarga automática, use `npm start` cuando las variables ya estén en el entorno. `npm run check` comprueba la sintaxis del servidor. El puerto se puede cambiar mediante `PORT`.

## Despliegue en Render

1. Suba este repositorio a GitHub. En Render, cree un **Blueprint** desde el repositorio. El archivo [render.yaml](render.yaml) define un servicio web Node en la rama `main`, instala con `npm ci`, aplica migraciones al iniciar y usa `/api/health` como verificación.
2. Configure en Render las variables privadas `DATABASE_URL`, `ADMIN_EMAIL` y `ADMIN_PASSWORD`. Use la URL del *session pooler* de Supabase; nunca la añada a GitHub ni a `render.yaml`. La contraseña administrativa debe ser nueva y robusta. Opcionalmente, configure `DATABASE_CA_FILE` con la ruta de un certificado CA de confianza si lo distribuye de forma segura en el servicio.
3. Despliegue. Compruebe que `https://<su-servicio>.onrender.com/api/health` responde `{"status":"ok"}` y que aparecen siete series en el catálogo. Pruebe registro, salida e ingreso admin.
4. Active copia de seguridad, alertas y rotación de secretos según el plan contratado. La clave de base de datos compartida en una conversación debe rotarse después de configurar la nueva URL en Render.

En el plan gratuito de Render el servicio puede suspenderse por inactividad y el primer acceso puede tardar. Un único servicio no proporciona escalado horizontal ni garantiza disponibilidad continua. Para carga real use un plan apropiado, almacenamiento de objetos/CDN para vídeo e imágenes y un trabajador separado para transcodificación.

## Estructura

```text
server/             API, autenticación, consultas y migrador
db/migrations/      esquema SQL versionado y datos iniciales
docs/               requisitos y arquitectura
assets/             portadas y tráiler de demostración
plataforma.*        interfaz pública
admin-tools.*       interfaz administrativa
render.yaml         infraestructura declarativa de Render
```

## Seguridad y límites

Las contraseñas de usuarios se almacenan con `scrypt` y sal aleatoria; las sesiones usan tokens opacos con hash en la base y cookie `HttpOnly`, `SameSite=Strict` y `Secure` en producción. El esquema `kitsune` es privado y se revocó su acceso a `anon` y `authenticated`; el servidor usa la conexión privada. Sin un archivo CA configurado, la conexión PostgreSQL va cifrada pero no verifica la identidad del servidor: para producción sensible, instale el CA de Supabase y configure `DATABASE_CA_FILE`.

No hay recuperación de contraseña, verificación de correo, límites de intentos de acceso, CDN, transcodificación, HLS ni política de retención automática de sesiones. Esas tareas figuran en el backlog de requisitos. Las imágenes y el vídeo incorporados pueden tener derechos de terceros; verifique licencias antes de difusión comercial.
