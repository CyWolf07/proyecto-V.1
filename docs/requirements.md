# Ingeniería de requisitos — Kitsune

## Alcance y actores

Versión 0.2: catálogo de series, tráilers, cuentas, y CMS básico. Actores: visitante, usuario registrado, administrador y desarrollador. El rol desarrollador se almacena, pero no obtiene permisos administrativos. El procesamiento de vídeo de producción está fuera de alcance de esta versión.

## Requisitos funcionales y aceptación

| ID | Prioridad | Requisito | Criterio de aceptación | Estado |
|---|---|---|---|---|
| RF-01 | Alta | Registrar usuarios con correo y contraseña | Alta válida crea usuario de rol `user`; correo repetido devuelve 409 | Implementado |
| RF-02 | Alta | Iniciar/cerrar sesión | Cookie segura representa sesión persistida; cerrar sesión la invalida; error de acceso enfoca correo o contraseña según corresponda | Implementado |
| RF-03 | Alta | Ingreso separado de administrador | Sólo credenciales privadas del servicio crean sesión admin | Implementado |
| RF-04 | Alta | Explorar catálogo y tráiler | Se muestran series publicadas y su material disponible | Implementado |
| RF-05 | Alta | Administración de contenido | Admin puede crear series, cambiar estado y agregar episodios | Implementado |
| RF-06 | Alta | Gestión de usuarios | Admin puede asignar rol y desactivar cuentas; sesiones previas se revocan | Implementado |
| RF-07 | Media | Auditoría y cola | Cambios administrativos quedan registrados; episodios generan trabajo | Parcial: no hay procesador |
| RF-08 | Media | Reproducción HLS | Un episodio publicado ofrece manifiesto HLS y cambio de calidad | Pendiente |
| RF-09 | Media | Perfiles y progreso | Usuario recupera avance y lista personal entre dispositivos | Pendiente |
| RF-10 | Media | Recuperar cuenta | Correo verificado permite restablecer contraseña | Pendiente |

## Requisitos no funcionales y comprobación

| ID | Objetivo | Comprobación | Estado |
|---|---|---|---|
| RNF-01 | Autorización obligatoria en servidor | Rutas `/admin` responden 403 sin sesión admin | Implementado |
| RNF-02 | Secretos fuera del repositorio | `.env` ignorado y Render usa variables privadas | Implementado |
| RNF-03 | Migraciones reproducibles | Aplicarlas dos veces no duplica registros | Implementado |
| RNF-04 | Health check real de base | `/api/health` responde 503 si PostgreSQL falla | Implementado |
| RNF-05 | Capacidad medible | Prueba de carga y presupuesto p95 definidos antes de escalar | Pendiente |
| RNF-06 | Resiliencia | Backups probados, métricas, alertas, recuperación | Pendiente |
| RNF-07 | Seguridad de cuentas | Límite distribuido de intentos, verificación de correo y rotación de secretos | Pendiente |
| RNF-08 | Distribución multimedia | CDN/objeto para medios, HLS adaptativo y trabajadores independientes | Pendiente |

## Riesgos y decisiones

- El plan gratuito de Render duerme por inactividad; no satisface un SLA de streaming.
- Los medios locales no son un almacén escalable. No colocar archivos nuevos de vídeo en el repositorio a medida que crezca el catálogo.
- El pool de PostgreSQL está limitado a cinco conexiones por instancia; al aumentar réplicas habrá que recalcular el presupuesto total de conexiones y probar carga.
- La conexión cifrada sin CA configurada no autentica el servidor de base de datos; activar validación de certificado para un entorno sensible.
- La publicación de obras ajenas requiere derechos o autorización.

## Criterio de salida para producción

No anunciar reproducción completa hasta disponer de trabajador de procesamiento, almacenamiento de objetos, manifiestos HLS, control de acceso a medios, pruebas de carga y recuperación, protección de inicio de sesión y licencias verificadas.
