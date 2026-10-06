# Arquitectura y evolución

## Versión actual

```text
Navegador (HTML/CSS/JS)
  ├─ GET catálogo y tráilers locales ──> Express en Render ──> PostgreSQL (Render o Supabase)
  └─ API autenticada / CMS ────────────> Express en Render ──> esquema privado kitsune
```

`server/index.js` aloja los recursos estáticos y monta la API. `auth.js` crea sesiones y controla roles; `totp.js` comprueba el segundo factor administrativo cuando está configurado y PostgreSQL impide reutilizar códigos. `catalog.js` sirve series y secciones de inicio; `library.js` conserva favoritos y progreso por usuario; `admin.js` gestiona el CMS y `db.js` limita el pool. `login-limit.js` reserva intentos de ingreso mediante una operación atómica en PostgreSQL y limpia contadores vencidos. `migrate.js` aplica SQL versionado con bloqueo asesor y transacciones. Las tablas del esquema privado incluyen usuarios, sesiones, series, temporadas, episodios, favoritos, progreso, auditoría, intentos de ingreso, códigos TOTP usados y trabajos de medios.

## Límites y estrategia de escalado

1. **Primero medir**: instrumentar latencia p50/p95, tasa de errores, uso de conexiones y tamaño/tiempo de medios. Definir objetivos a partir de usuarios concurrentes reales.
2. **Separar estáticos y vídeo**: mover portadas y HLS a almacenamiento de objetos/CDN con URLs controladas; mantener la API sin estado de archivos.
3. **Prototipo multimedia**: el panel pide al servidor una firma para subir directamente un MP4 autorizado a Cloudinary Free. Cloudinary genera HLS en segundo plano y notifica por webhook firmado; PostgreSQL registra el trabajo y habilita la publicación tras verificar el resultado. No hay worker propio de FFmpeg. La reproducción exige sesión antes de entregar la URL, pero la URL y sus segmentos siguen siendo compartibles en el plan gratuito.
4. **Escalar API**: aumentar instancias cuando el plan y la medición lo justifiquen; cada instancia tiene un pool acotado. Ajustar conexiones considerando el límite de PostgreSQL o del pooler utilizado.
5. **Operación**: backups restaurados en prueba, alertas de errores, rotación de secretos, pruebas de migración y despliegues reversibles.

## Seguridad

El navegador nunca recibe la cadena de conexión. Express utiliza consultas parametrizadas y verifica roles en cada petición; los cambios de rol revocan sesiones existentes. El esquema `kitsune` revoca el acceso de `PUBLIC` y de los roles de API pública de Supabase sólo cuando existen. Los ingresos normales y administrativos comparten un contador por hash de IP que PostgreSQL actualiza antes de comprobar credenciales; un error de base impide el ingreso. Antes de abrir a gran escala faltan protección de abuso en el borde, controles por cuenta, verificación de correo, política de contenido y autenticación del certificado PostgreSQL mediante CA.
