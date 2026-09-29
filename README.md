# Kitsune Streaming

Plataforma de catálogo y tráilers de anime con API Node/Express, PostgreSQL en Render o Supabase y panel administrativo. Esta versión sustituye las sesiones de demostración del navegador por autenticación y autorización del servidor.

## Estado real

El catálogo, registro, inicio de sesión, sesiones, roles, creación de series y episodios, auditoría y cola de trabajos se guardan en PostgreSQL. El tráiler de Mushoku Tensei es MP4 y el de Astral Edge es una animación del navegador. La cola de medios registra trabajos, pero **todavía no hay un trabajador FFmpeg/Kafka ni reproducción HLS**. No se debe presentar como servicio de streaming completo hasta implementar y validar esa fase. Consulte [requisitos](docs/requirements.md) y [arquitectura](docs/architecture.md).

## Requisitos

- Node.js 22 o posterior.
- Una base PostgreSQL. El Blueprint crea una en Render; también puede usar una instancia externa, como Supabase.
- Derechos de publicación sobre imágenes y vídeos antes de hacer público el proyecto.

## Desarrollo local

```powershell
npm ci
Copy-Item .env.example .env
```

Edite `.env` con su propia `DATABASE_URL`, `ADMIN_EMAIL` y una `ADMIN_PASSWORD` única de al menos 16 caracteres. `DATABASE_URL` debe ser una URL completa que empiece por `postgres://` o `postgresql://`; si la contraseña contiene símbolos, use la URL copiada del proveedor en vez de construirla a mano. No publique este archivo. Node no carga `.env` automáticamente en este proyecto; inicie así:

```powershell
node --env-file=.env server/migrate.js
node --env-file=.env server/index.js
```

Abra `http://localhost:4173/`. Para pruebas sin recarga automática, use `npm start` cuando las variables ya estén en el entorno. `npm run check` comprueba la sintaxis y las validaciones de configuración. El puerto se puede cambiar mediante `PORT`.

Al arrancar en producción, Kitsune se detiene con un mensaje claro si falta una variable, si `DATABASE_URL` conserva los marcadores del ejemplo, si `ADMIN_EMAIL` no es válido o si `ADMIN_PASSWORD` tiene menos de 16 caracteres. Esto evita publicar por accidente un panel sin credenciales seguras.

## Despliegue en Render

### Servicio existente configurado como Docker

Si Render muestra `load build definition from Dockerfile`, ese servicio está configurado para Docker y no utiliza el `runtime: node` de `render.yaml`. El repositorio incluye ahora un `Dockerfile` en la raíz. Configure `DATABASE_URL`, `ADMIN_EMAIL` y `ADMIN_PASSWORD` como variables de entorno privadas del servicio y ejecute **Manual Deploy → Deploy latest commit**. No coloque credenciales en el Dockerfile ni en Git. El contenedor aplica las migraciones antes de iniciar la API y escucha el `PORT` proporcionado por Render.

### Servicio nuevo mediante Blueprint Node

1. Suba este repositorio a GitHub. En Render, elija **New → Blueprint**, conecte el repositorio y confirme los recursos. [render.yaml](render.yaml) crea `kitsune-postgres` y el servicio web `kitsune-streaming` en la misma región.
2. En el formulario inicial, introduzca `ADMIN_EMAIL` y `ADMIN_PASSWORD`. Use un correo real bajo su control y una contraseña nueva, única y de al menos 16 caracteres. Render las guarda como variables privadas porque ambas tienen `sync: false`; no las escriba en Git ni en el Blueprint.
3. No copie manualmente `DATABASE_URL`: el Blueprint la obtiene de `kitsune-postgres` mediante `fromDatabase`, usando la conexión privada de Render. El primer arranque ejecuta las migraciones antes de iniciar la API. Si una variable es inválida, el despliegue falla al comienzo y el registro indica cuál debe corregir.
4. Espere a que la base y el servicio indiquen estado disponible. Compruebe que `https://<su-servicio>.onrender.com/api/health` responde `{"status":"ok"}`, que aparecen siete series y que funcionan registro, cierre de sesión e ingreso administrativo.
5. Active copias de seguridad, alertas y rotación de secretos según el plan contratado. El plan gratuito sirve para la primera prueba, no para datos que necesiten garantías de conservación o disponibilidad.

### Usar PostgreSQL externo o Supabase

El Blueprint incluido está preparado para una base nueva de Render. Si necesita conservar una base externa, cambie `DATABASE_URL` en su copia de `render.yaml` de `fromDatabase` a `sync: false` y elimine el bloque `databases` **antes de crear el Blueprint**. Durante la creación, pegue la URL PostgreSQL privada o la del *session pooler* de Supabase. No use la URL HTTP de la API de Supabase ni una clave `anon`; Kitsune necesita una cadena `postgresql://...` con permisos para crear el esquema y ejecutar las migraciones.

Si el servicio ya existe, configure las tres variables en **Environment** y vuelva a desplegar. No conecte a la vez el mismo servicio o base a más de un Blueprint. `DATABASE_CA_FILE` es opcional y debe apuntar a un archivo CA instalado de forma segura cuando el proveedor externo requiera validación explícita del certificado.

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

Las contraseñas de usuarios se almacenan con `scrypt` y sal aleatoria; las sesiones usan tokens opacos con hash en la base y cookie `HttpOnly`, `SameSite=Strict` y `Secure` en producción. El esquema `kitsune` es privado: se revoca el acceso de `PUBLIC` y, si existen, de los roles `anon` y `authenticated` de Supabase. Así la migración inicial también funciona en PostgreSQL de Render, donde esos dos roles no existen. El servidor usa la conexión privada. Sin un archivo CA configurado, la conexión PostgreSQL va cifrada pero no verifica la identidad del servidor: para producción sensible, instale el CA del proveedor y configure `DATABASE_CA_FILE`.

Los ingresos normales y administrativos comparten un límite de **12 solicitudes por IP cada 15 minutos**. Cada solicitud consume un intento antes de validar el correo o la contraseña, incluso si el ingreso tiene éxito; el intento 13 recibe HTTP 429 y `Retry-After` hasta que venza la ventana. PostgreSQL guarda el contador bajo un hash de la IP y lo actualiza de forma atómica, por lo que el límite persiste tras reinicios y se comparte entre instancias. Los registros vencidos se eliminan al iniciar el servidor y cada hora. Si PostgreSQL no está disponible, los ingresos fallan en vez de saltarse el límite. La migración `004_login_attempts.sql` debe aplicarse antes de servir la API; el comando de inicio de Render ya ejecuta las migraciones.

El límite por IP puede afectar a personas que compartan una red y depende de que `req.ip` corresponda a la IP real entregada por el proxy de confianza de Render. No sustituye controles por cuenta, protección en el borde, detección de abuso ni límites para el registro de cuentas. No hay recuperación de contraseña, verificación de correo, CDN, transcodificación, HLS ni política de retención automática de sesiones. Las pistas de campo en errores de acceso pueden revelar si un correo está registrado; conviene desactivarlas o rediseñarlas antes de abrir el servicio a gran escala. Esas tareas figuran en el backlog de requisitos. Las imágenes y el vídeo incorporados pueden tener derechos de terceros; verifique licencias antes de difusión comercial.
