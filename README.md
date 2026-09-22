# Kitsune Anime Streaming

Prototipo frontend de una plataforma de streaming de anime. Incluye catálogo, autenticación de demostración, reproducción de tráilers, sesión de usuario y panel administrativo.

## Requisitos

- Python 3, o cualquier servidor HTTP estático.
- Navegador moderno con soporte para video MP4.

No es necesario instalar dependencias de Node.js.

## Ejecutar localmente

Desde PowerShell:

```powershell
cd "E:\Programas\Streaming Crusky"
python -m http.server 4173
```

Abrir en el navegador:

```text
http://localhost:4173/
```

La raíz redirige automáticamente a `plataforma.html`.

Para detener el servidor, presionar `Ctrl + C`.

## Accesos de demostración

### Usuario

La pantalla de registro permite crear una sesión local de demostración. Los datos se almacenan únicamente en `localStorage` del navegador.

### Administrador

```text
Correo: admin@kitsune.com
Contraseña: 123456
```

La autorización administrativa usa `sessionStorage` y finaliza al cerrar la sesión o la pestaña.

> Estas credenciales son únicamente para el prototipo. No deben utilizarse en producción. Una versión real necesita autenticación y autorización en el backend, contraseñas cifradas y sesiones seguras.

## Estructura principal

```text
.
├── index.html              # Entrada y redirección
├── plataforma.html         # Interfaz principal
├── plataforma.js           # Catálogo, sesiones y reproductor
├── plataforma.css          # Estilos base
├── ui-fixes.css            # Ajustes responsive y de interfaz
├── admin-tools.js          # Herramientas del panel administrativo
├── admin-tools.css         # Estilos del panel administrativo
└── assets/
    ├── trailers/           # Videos MP4
    └── *.png               # Portadas e imágenes
```

## Despliegue con GitHub Pages

1. Entrar al repositorio en GitHub.
2. Abrir **Settings → Pages**.
3. En **Build and deployment**, seleccionar **Deploy from a branch**.
4. Elegir la rama `main` y la carpeta `/ (root)`.
5. Pulsar **Save**.
6. Esperar a que GitHub publique la URL del sitio.

No se requiere proceso de compilación porque el proyecto es HTML, CSS y JavaScript estático.

## Despliegue con Vercel

1. Importar este repositorio desde Vercel.
2. Seleccionar **Other** como framework.
3. Dejar vacío el comando de compilación.
4. Usar `.` como directorio de salida si Vercel lo solicita.
5. Publicar el proyecto.

## Despliegue con Netlify

1. Importar el repositorio desde Netlify.
2. Dejar vacío el comando de compilación.
3. Usar `.` como directorio de publicación.
4. Iniciar el despliegue.

## Consideraciones para producción

- La autenticación actual es solamente una demostración frontend.
- El catálogo y las acciones administrativas usan almacenamiento local.
- Los videos se sirven como MP4 estáticos. Para producción se recomienda HLS, almacenamiento S3/R2 y CDN.
- Las imágenes y videos incluidos pueden estar sujetos a derechos de autor. Verificar las licencias antes de una publicación comercial.
- Conviene mover los videos grandes a almacenamiento de objetos o Git LFS cuando aumente el catálogo.
