# Arquitectura y evolución

## Versión actual

```text
Navegador (HTML/CSS/JS)
  ├─ GET catálogo y tráilers locales ──> Express en Render ──> Supabase PostgreSQL
  └─ API autenticada / CMS ────────────> Express en Render ──> esquema privado kitsune
```

`server/index.js` aloja los recursos estáticos y monta la API. `auth.js` crea sesiones y controla roles, `catalog.js` sirve series, `admin.js` gestiona CMS y `db.js` limita el pool. `migrate.js` aplica SQL versionado con bloqueo asesor y transacciones. Las tablas del esquema privado son usuarios, sesiones, series, temporadas, episodios, progreso, auditoría y trabajos de medios.

## Límites y estrategia de escalado

1. **Primero medir**: instrumentar latencia p50/p95, tasa de errores, uso de conexiones y tamaño/tiempo de medios. Definir objetivos a partir de usuarios concurrentes reales.
2. **Separar estáticos y vídeo**: mover portadas y HLS a almacenamiento de objetos/CDN con URLs controladas; mantener la API sin estado de archivos.
3. **Procesamiento asíncrono**: un trabajador separado consume trabajos durables, convierte con FFmpeg, almacena variantes y publica sólo después de validar el resultado. La tabla `media_jobs` es sólo la base del flujo; no es aún una cola activa.
4. **Escalar API**: aumentar instancias cuando el plan y la medición lo justifiquen; cada instancia tiene un pool acotado. Ajustar conexiones considerando el límite del pooler de Supabase.
5. **Operación**: backups restaurados en prueba, alertas de errores, rotación de secretos, pruebas de migración y despliegues reversibles.

## Seguridad

El navegador nunca recibe la cadena de conexión. Express utiliza consultas parametrizadas y verifica roles en cada petición; los cambios de rol revocan sesiones existentes. El esquema `kitsune` no se expone a roles de API pública de Supabase. Antes de abrir a gran escala faltan límites distribuidos de intentos, verificación de correo, política de contenido y autenticación del certificado PostgreSQL mediante CA.
