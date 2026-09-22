
## Idea general

El proyecto consiste en desarrollar una **plataforma de streaming de anime y video bajo demanda**, similar en funcionamiento a Crunchyroll.

La primera versión debe ser sencilla de ejecutar, segura y organizada para que después pueda crecer sin tener que rehacer todo el sistema.

La plataforma permitirá:

- Registrar usuarios.
    
- Iniciar sesión.
    
- Explorar anime.
    
- Consultar temporadas.
    
- Consultar episodios.
    
- Reproducir video mediante streaming.
    
- Guardar el progreso de reproducción.
    
- Continuar viendo un episodio.
    
- Agregar anime a favoritos.
    
- Administrar contenido.
    
- Procesar automáticamente los videos.
    

Notas relacionadas:

- [[Arquitectura del sistema]]
    
- [[Stack tecnológico]]
    
- [[Base de datos]]
    
- [[Sistema de streaming]]
    
- [[Seguridad de la plataforma]]
    
- [[Prueba 0]]
    
- [[Roadmap del proyecto]]
    

---

# Arquitectura del sistema

La aplicación estará dividida en:

- Frontend.
    
- Backend.
    
- Base de datos.
    
- Cache.
    
- Procesamiento de video.
    
- Almacenamiento.
    
- CDN.
    
- Sistema de colas.
    

## Estructura general

```
Usuario
   |
   v
Cloudflare / CDN
   |
   +-----------------------+
   |                       |
   v                       v
Frontend                 Video CDN
Next.js                    |
   |                       v
   |                  Streaming HLS
   v
Backend Laravel
   |
   +------------+-------------+
   |            |             |
   v            v             v
PostgreSQL    Redis         Queue
                              |
                              v
                        FFmpeg Worker
                              |
                              v
                       Object Storage
```

Ver también:

- [[Frontend]]
    
- [[Backend]]
    
- [[CDN y almacenamiento]]
    
- [[Procesamiento de video]]
    

---

# Stack tecnológico

## Frontend

- **Next.js**
    
- **React**
    
- **TypeScript**
    
- **Tailwind CSS**
    
- **hls.js**
    

## Backend

- **Laravel**
    
- API REST
    
- Laravel Sanctum
    
- Laravel Policies
    
- Middleware
    
- Laravel Queue
    

## Base de datos

- **PostgreSQL**
    

## Cache y colas

- **Redis**
    

## Procesamiento multimedia

- **FFmpeg**
    
- **HLS**
    
- **WebVTT**
    

## Almacenamiento

Durante desarrollo:

- **MinIO**
    

En producción:

- Amazon S3.
    
- Cloudflare R2.
    
- Otro almacenamiento compatible con S3.
    

## Infraestructura

- Docker.
    
- Docker Compose.
    
- Nginx.
    

## Seguridad

- HTTPS.
    
- Argon2id.
    
- Cookies HttpOnly.
    
- Protección CSRF.
    
- CORS restringido.
    
- Rate Limiting.
    
- RBAC.
    
- MFA para administradores.
    
- URLs firmadas.
    
- Logs de auditoría.
    

---

# Estructura del proyecto

```
anime-streaming/
|
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   └── utils/
│   |
│   ├── public/
│   └── package.json
|
├── backend/
│   ├── app/
│   │   ├── Domain/
│   │   │   ├── Anime/
│   │   │   ├── Auth/
│   │   │   ├── Episode/
│   │   │   ├── Playback/
│   │   │   ├── User/
│   │   │   └── Subscription/
│   │   |
│   │   ├── Http/
│   │   ├── Jobs/
│   │   ├── Policies/
│   │   └── Services/
│   |
│   ├── database/
│   ├── routes/
│   ├── tests/
│   └── composer.json
|
├── transcoder/
│   ├── scripts/
│   ├── presets/
│   └── Dockerfile
|
├── infrastructure/
│   ├── nginx/
│   ├── docker/
│   └── scripts/
|
├── docker-compose.yml
├── .env.example
└── README.md
```

Para comenzar se utilizará un **monolito modular**.

Los microservicios se dejarán para etapas posteriores.

Ver:

- [[Escalabilidad y microservicios]]
    
- [[Docker]]
    

---

# Módulos principales

## Sistema de autenticación

Funciones iniciales:

- Registro.
    
- Inicio de sesión.
    
- Cerrar sesión.
    
- Recuperación de contraseña.
    
- Verificación de correo.
    
- Manejo de sesiones.
    
- Roles.
    
- Permisos.
    

### Roles iniciales

```
USER
EDITOR
ADMIN
```

### Roles futuros

```
MODERATOR
CONTENT_MANAGER
SUPER_ADMIN
```

Ver:

- [[Sistema de autenticación]]
    
- [[Seguridad de contraseñas]]
    
- [[Autenticación multifactor]]
    

---

# Módulo de anime

La estructura del contenido será:

```
Anime
 |
 ├── Temporada 1
 |     ├── Episodio 1
 |     ├── Episodio 2
 |     └── Episodio 3
 |
 └── Temporada 2
       ├── Episodio 1
       └── Episodio 2
```

Cada entidad debe mantenerse separada.

No se deben guardar los episodios directamente dentro de la tabla `anime`.

Ver:

- [[Módulo de anime]]
    
- [[Base de datos]]
    

---

# Base de datos

## Tablas iniciales

```
users
roles
user_roles

anime
seasons
episodes

genres
anime_genres

video_assets
video_variants

subtitles
audio_tracks

watch_history
watch_progress

favorites
watchlists

ratings

plans
subscriptions

devices
sessions

audit_logs
```

Ver:

- [[Base de datos]]
    
- [[Modelo entidad relación]]
    

---

# Tabla anime

```
anime

id
uuid
title
slug
original_title
description
release_year
status
age_rating
poster_url
banner_url
created_at
updated_at
```

## Estados posibles

```
draft
published
finished
cancelled
hidden
```

---

# Tabla seasons

```
seasons

id
anime_id
season_number
title
description
release_year
created_at
updated_at
```

---

# Tabla episodes

```
episodes

id
uuid
season_id
episode_number
title
description
duration_seconds
release_date
thumbnail_url
status
created_at
updated_at
```

## Estados posibles

```
draft
processing
ready
published
blocked
```

---

# Gestión de video

Los archivos de video **no deben guardarse en PostgreSQL**.

Tampoco deberían guardarse directamente dentro del proyecto Laravel.

Se utilizará almacenamiento externo.

Ver:

- [[Sistema de streaming]]
    
- [[Procesamiento de video]]
    
- [[CDN y almacenamiento]]
    

---

# Tabla video_assets

```
video_assets

id
episode_id
original_file
storage_provider
processing_status
duration
width
height
codec
created_at
updated_at
```

---

# Tabla video_variants

Cada video puede tener diferentes versiones.

```
video_variants

id
video_asset_id
resolution
bitrate
codec
playlist_path
created_at
updated_at
```

Ejemplo:

```
480p
720p
1080p
```

Más adelante:

```
1440p
2160p
```

---

# Sistema de streaming

La plataforma utilizará **HLS**.

No se recomienda reproducir directamente:

```
<video src="/videos/episode01.mp4">
```

El video debe convertirse a diferentes niveles de calidad.

## Ejemplo de estructura HLS

```
episode01/
|
├── master.m3u8
|
├── 480p/
│   ├── playlist.m3u8
│   ├── segment001.m4s
│   ├── segment002.m4s
│   └── ...
|
├── 720p/
│   ├── playlist.m3u8
│   └── ...
|
└── 1080p/
    ├── playlist.m3u8
    └── ...
```

El reproductor utilizará:

```
master.m3u8
```

Dependiendo de la conexión podrá seleccionar automáticamente:

```
480p
720p
1080p
```

Ver: [[Sistema de streaming]]

---

# Procesamiento de video

Cuando un administrador suba:

```
episode01.mp4
```

Laravel no debería procesarlo directamente.

## Flujo

```
Administrador
     |
     v
Subir video
     |
     v
Object Storage
     |
     v
Backend
     |
     v
Crear trabajo
     |
     v
Redis Queue
     |
     v
FFmpeg Worker
     |
     +---- 480p
     |
     +---- 720p
     |
     +---- 1080p
     |
     +---- thumbnails
     |
     +---- HLS
     |
     v
Object Storage
     |
     v
Estado = READY
```

Esto permite procesar los videos sin bloquear el backend.

Ver: [[Procesamiento de video]]

---

# Redis

Redis se utilizará para:

- Cache.
    
- Colas.
    
- Sesiones.
    
- Rate limiting.
    
- Datos temporales.
    

## Ejemplos de cache

```
anime:trending
anime:popular
anime:latest
anime:{uuid}
```

Ver: [[Redis]]

---

# CDN y almacenamiento

Durante desarrollo se puede utilizar MinIO.

En producción:

```
Usuario
   |
   v
CDN
   |
   v
Object Storage
```

La CDN evita que todos los usuarios descarguen directamente los archivos desde el servidor principal.

Ver: [[CDN y almacenamiento]]

---

# Seguridad de los videos

No se deben utilizar enlaces públicos permanentes como:

```
https://storage.example.com/anime/episode1/master.m3u8
```

La reproducción debería solicitarse mediante:

```
GET /api/v1/episodes/{uuid}/play
```

## Flujo de autorización

```
¿Está autenticado?
        |
        v
¿Puede reproducir el episodio?
        |
        v
Generar URL firmada
        |
        v
Permitir streaming
```

Ejemplo:

```
video.example.com/episode/abc/master.m3u8
?expires=...
&signature=...
```

Las URLs deben expirar.

Ver: [[Seguridad de la plataforma]]

---

# Autorización

Nunca se debe confiar en información enviada por el frontend como:

```
{
    "premium": true
}
```

La autorización se realiza siempre desde el backend.

Ejemplo:

```
if (!$user->canWatch($episode)) {
    abort(403);
}
```

---

# Seguridad de contraseñas

Las contraseñas nunca deben almacenarse directamente.

Laravel deberá utilizar hashing.

Ejemplo:

```
Hash::make($password);
```

Algoritmo recomendado:

```
Argon2id
```

Ver: [[Seguridad de contraseñas]]

---

# Sesiones

Para la aplicación web se puede utilizar:

- Laravel Sanctum.
    
- Cookies HttpOnly.
    
- HTTPS.
    

Configuración:

```
HttpOnly = true
Secure = true
SameSite = Lax
```

Evitar almacenar tokens sensibles directamente en:

```
localStorage
```

---

# Rate limiting

Endpoints sensibles:

```
/login
/register
/password-reset
/search
/play
```

Ejemplo:

```
POST /login
```

Límite inicial:

```
5 intentos por minuto
```

Cuando se supere:

```
429 Too Many Requests
```

---

# Autenticación multifactor

Para usuarios normales puede ser opcional.

Para los siguientes roles debería ser obligatorio:

```
EDITOR
ADMIN
SUPER_ADMIN
```

Ejemplo:

```
Contraseña
+
TOTP
```

Ver: [[Autenticación multifactor]]

---

# Identificadores públicos

Para URLs y API se utilizarán UUID.

Ejemplo:

```
/api/v1/users/550e8400-e29b-41d4-a716-446655440000
```

Internamente PostgreSQL puede utilizar:

```
BIGINT id
```

junto con:

```
UUID uuid
```

---

# Historial y progreso

## Tabla watch_progress

```
watch_progress

id
user_id
episode_id
position_seconds
duration_seconds
completed
last_watched_at
created_at
updated_at
```

Ejemplo:

```
Anime: Attack on Titan
Episodio: 12

position_seconds = 1095
duration_seconds = 1440
completed = false
```

La interfaz puede mostrar:

```
Continuar viendo
18:15 / 24:00
```

Ver: [[Historial y progreso]]

---

# Actualización del progreso

Endpoint:

```
PUT /api/v1/me/progress/{episode}
```

Ejemplo:

```
{
    "position": 1095
}
```

No se debe enviar una petición cada segundo.

Se puede actualizar aproximadamente cada:

```
10 - 20 segundos
```

También al detectar:

- Pause.
    
- Cierre del reproductor.
    
- Cambio de episodio.
    
- Finalización del episodio.
    

---

# Página principal

La pantalla principal puede contener:

```
Inicio
|
├── Continuar viendo
├── Últimos episodios
├── Populares
├── Recomendados
├── Acción
├── Romance
├── Comedia
└── Próximos estrenos
```

Ver: [[Frontend]]

---

# Sistema de búsqueda

Para la Prueba 0 se puede utilizar PostgreSQL.

Ejemplo:

```
SELECT *
FROM anime
WHERE title ILIKE '%naruto%';
```

Después se puede utilizar:

```
PostgreSQL Full Text Search
```

Cuando el catálogo crezca:

```
Meilisearch
```

o:

```
OpenSearch
```

Ver: [[Sistema de búsqueda]]

---

# Sistema de recomendaciones

Inicialmente no se necesita inteligencia artificial.

Las recomendaciones se pueden generar utilizando:

- Géneros vistos.
    
- Anime favorito.
    
- Historial.
    
- Popularidad.
    
- Contenido terminado.
    

Ejemplo:

```
Usuario ve:

Attack on Titan
Jujutsu Kaisen
Chainsaw Man
```

El sistema puede identificar:

```
Action
Dark Fantasy
Shounen
```

Luego busca contenido relacionado.

Ver: [[Sistema de recomendaciones]]

---

# API REST

URL base:

```
/api/v1/
```

## Auth

```
POST /auth/register
POST /auth/login
POST /auth/logout
POST /auth/forgot-password
POST /auth/reset-password

GET /auth/me
```

## Anime

```
GET /anime
GET /anime/{slug}
GET /anime/{slug}/seasons
```

## Episodios

```
GET /episodes/{uuid}
GET /episodes/{uuid}/play
```

## Usuario

```
GET /me/watchlist
POST /me/watchlist/{anime}

GET /me/history

GET /me/progress
PUT /me/progress/{episode}
```

## Favoritos

```
POST /favorites/{anime}
DELETE /favorites/{anime}
```

Ver: [[API REST]]

---

# Panel administrativo

Ruta:

```
/admin
```

## Funciones

```
Dashboard

Anime
├── Crear
├── Modificar
├── Eliminar
└── Publicar

Temporadas

Episodios
├── Crear
├── Subir video
├── Procesar
├── Publicar
└── Bloquear

Usuarios

Géneros

Subtítulos

Auditoría

Configuración
```

Ver: [[Panel administrativo]]

---

# Subtítulos

## Tabla subtitles

```
subtitles

id
episode_id
language
label
storage_path
format
is_default
```

Ejemplo:

```
language = es
label = Español
format = WebVTT
is_default = true
```

Formato recomendado:

```
.vtt
```

Ver: [[Subtítulos]]

---

# Audio

## Tabla audio_tracks

```
audio_tracks

id
episode_id
language
label
storage_path
is_default
```

Ejemplo:

```
ja-JP = Japonés
es-LA = Español Latino
es-ES = Español España
en-US = Inglés
```

Ver: [[Audio]]

---

# Seguridad de datos

## Datos públicos

```
username
avatar
```

## Datos personales

```
email
fecha de nacimiento
```

## Datos internos sensibles

```
password_hash
MFA secrets
sessions
refresh tokens
```

## Datos operativos

```
IP
dispositivos
logs
auditoría
```

Ver: [[Seguridad de la plataforma]]

---

# Datos que no se deben almacenar

Nunca almacenar:

- Contraseña original.
    
- CVV.
    
- Número completo de tarjeta.
    
- Tokens sensibles sin protección.
    
- Credenciales externas.
    

Para pagos se puede utilizar:

- Stripe.
    
- Mercado Pago.
    
- Wompi.
    
- PayU.
    

La aplicación solo debería guardar referencias como:

```
payment_provider_customer_id
subscription_id
status
```

---

# Logs de auditoría

## Tabla audit_logs

```
audit_logs

id
user_id
action
entity
entity_id
ip
user_agent
metadata
created_at
```

Ejemplo:

```
Usuario:
ADMIN_52

Acción:
DELETE_EPISODE

Entidad:
episode

ID:
EP_891
```

Esto permitirá saber qué administrador realizó un cambio.

Ver: [[Logs de auditoría]]

---

# Backups

## Base de datos

```
Backup diario
```

Además:

```
Backup completo semanal
```

## Almacenamiento

```
Object Versioning
```

## Prueba de restauración

```
Crear backup
     |
     v
Crear base de datos nueva
     |
     v
Restaurar
     |
     v
Verificar información
```

Ver: [[Backups]]

---

# Docker

Servicios iniciales:

```
frontend
backend
postgres
redis
minio
worker
nginx
```

## Arquitectura local

```
Next.js
   |
   v
Nginx
   |
   v
Laravel
   |
   +---------+
   |         |
   v         v
PostgreSQL Redis
             |
             v
           Queue
             |
             v
       FFmpeg Worker
             |
             v
           MinIO
```

Ver: [[Docker]]

---

# Prueba 0

El objetivo inicial será tener una plataforma mínima completamente funcional.

## Funciones requeridas

- Crear usuario.
    
- Iniciar sesión.
    
- Cerrar sesión.
    
- Mostrar catálogo.
    
- Abrir anime.
    
- Mostrar temporadas.
    
- Mostrar episodios.
    
- Reproducir episodio mediante HLS.
    
- Cambiar automáticamente la calidad.
    
- Guardar progreso.
    
- Continuar reproducción.
    
- Agregar anime a favoritos.
    
- Administrar contenido.
    

## Funciones del administrador

- Crear anime.
    
- Crear temporada.
    
- Crear episodio.
    
- Subir video.
    

## Procesamiento automático

El sistema deberá generar:

```
480p
720p
1080p
```

Cuando FFmpeg termine:

```
episode.status = READY
```

Después el episodio podrá publicarse.

Ver: [[Prueba 0]]

---

# Funciones que no se construirán en la Prueba 0

Se dejarán para etapas posteriores:

- Kubernetes.
    
- Microservicios.
    
- Kafka.
    
- Inteligencia artificial.
    
- Comentarios.
    
- Chat.
    
- Streaming en vivo.
    
- Aplicación Android.
    
- Aplicación iOS.
    
- Smart TV.
    
- DRM avanzado.
    
- Video 4K.
    
- Pagos reales.
    

---

# Roadmap del proyecto

## Fase 0

```
Usuarios
Autenticación
Anime
Temporadas
Episodios
HLS
FFmpeg
Progreso
Favoritos
Panel administrador
```

## Fase 1

```
Subtítulos
Múltiples audios
Búsqueda avanzada
Watchlist
Ratings
Perfiles
```

## Fase 2

```
Planes Premium
Pagos
CDN
URLs firmadas
MFA
Auditoría avanzada
```

## Fase 3

```
Sistema de recomendaciones
Aplicación móvil
Notificaciones
Descargas offline
```

## Fase 4

```
DRM
Smart TV
Multi-región
Autoescalado
Microservicios
```

Ver: [[Roadmap del proyecto]]

---

# Escalabilidad y microservicios

No se utilizarán microservicios desde el comienzo.

## Arquitectura inicial

```
Frontend
   |
Backend
   |
   +-------- PostgreSQL
   |
   +-------- Redis
   |
   +-------- Queue
              |
              v
         FFmpeg Worker
              |
              v
        Object Storage
```

## Arquitectura futura

```
API Gateway
     |
     +------------------+
     |                  |
     v                  v
Auth Service       Catalog Service
     |                  |
     +--------+---------+
              |
              v
           Event Bus
              |
     +--------+---------+
     |        |         |
     v        v         v
Playback  Billing   Recommendations
```

Ver: [[Escalabilidad y microservicios]]

---

# Arquitectura seleccionada

Para la primera versión se utilizará:

```
                      Cloudflare
                          |
              +-----------+-----------+
              |                       |
              v                       v
           Next.js                Video CDN
              |                       |
              |                       v
              |                  HLS Streaming
              |
              v
           Laravel
              |
       +------+-------+------+
       |              |      |
       v              v      v
PostgreSQL          Redis   Queue
                             |
                             v
                       FFmpeg Worker
                             |
                             v
                      Object Storage
```

Esta arquitectura permite comenzar localmente y reemplazar componentes conforme aumenten los usuarios.

---

# Índice de notas

- [[Arquitectura del sistema]]
    
- [[Stack tecnológico]]
    
- [[Estructura del proyecto]]
    
- [[Frontend]]
    
- [[Backend]]
    
- [[Base de datos]]
    
- [[Modelo entidad relación]]
    
- [[Sistema de autenticación]]
    
- [[Seguridad de contraseñas]]
    
- [[Autenticación multifactor]]
    
- [[Seguridad de la plataforma]]
    
- [[Módulo de anime]]
    
- [[Sistema de streaming]]
    
- [[Procesamiento de video]]
    
- [[CDN y almacenamiento]]
    
- [[Redis]]
    
- [[Historial y progreso]]
    
- [[Sistema de búsqueda]]
    
- [[Sistema de recomendaciones]]
    
- [[API REST]]
    
- [[Panel administrativo]]
    
- [[Subtítulos]]
    
- [[Audio]]
    
- [[Logs de auditoría]]
    
- [[Backups]]
    
- [[Docker]]
    
- [[Prueba 0]]
    
- [[Roadmap del proyecto]]
    
- [[Escalabilidad y microservicios]]