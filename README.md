# 🐧 MyTerminal Tux Tux

**MyTerminal Tux Tux** es un potente emulador de terminal multiplataforma (Linux, Windows y macOS) inspirado en Terminator, diseñado para desarrolladores y administradores de sistemas que necesitan organizar múltiples consolas simultáneas, gestionar pestañas, guardar sesiones y conectar servidores SSH con un solo clic.

---

## ✨ Características Principales

1. **División de Terminales (Splits estilo Terminator)**:
   - Divide cualquier terminal **horizontalmente** o **verticalmente**.
   - Divisores interactivos y redimensionables arrastrando el ratón para ajustar las proporciones deseadas.
   - Árbol binario de splits recursivos infinitos en una sola pantalla.

2. **Múltiples Pestañas (Tabs)**:
   - Crea tantas pestañas como necesites con el botón `➕` o `Ctrl+Shift+T`.
   - Cada pestaña posee su propio árbol independiente de terminales y divisiones.
   - Doble clic en el título de la pestaña para renombrarla.

3. **Menú Contextual (Click Derecho)**:
   - Haz clic derecho sobre cualquier terminal para desplegar el menú rápido:
     - ⬍ Dividir Horizontalmente
     - ⬌ Dividir Verticalmente
     - 🔑 Cargar Perfil SSH (con submenú desplegable de tus conexiones guardadas)
     - 📋 Copiar selección
     - 📥 Pegar
     - 🧹 Limpiar pantalla
     - ✕ Cerrar terminal

4. **Barra de Herramientas por Terminal (Header Toolbar)**:
   - Cada terminal cuenta con su propia barra superior individual que incluye:
     - Badge de estado (`LOCAL` o `SSH`) y título identificativo.
     - Botón `⬌ V`: División vertical rápida.
     - Botón `⬍ H`: División horizontal rápida.
     - Menú `🔑 SSH ▾`: Despliega tus perfiles SSH para conectarte instantáneamente en esa terminal o abrir el administrador de perfiles.
     - Botón `✕`: Cierra la terminal y redistribuye el espacio automáticamente entre sus paneles vecinos.

5. **Administrador de Perfiles SSH**:
   - Guarda tus servidores remotos con:
     - Nombre del perfil (ej. *VPS Producción*, *Raspberry Pi*, *Database Server*).
     - Host / Dirección IP y Puerto (por defecto 22).
     - Usuario SSH.
     - Autenticación por Contraseña o por Clave Privada (`.pem`, `.id_rsa`).
     - Argumentos adicionales opcionales (`-X`, `-C`, etc.).
   - Al cargar un perfil en cualquier terminal, la aplicación ejecuta automáticamente el comando SSH y actualiza el título y badge de la terminal.

6. **Persistencia de Estado (Guardar y Cargar)**:
   - **Estado General (Sesiones)**: Guarda todas las pestañas abiertas y toda la estructura jerárquica de terminales con un nombre personalizado (ej. *Monitoreo Diario*, *Dev Backend*). Al restaurar, se reconstruye exactamente toda la distribución de terminales.
   - **Estado por Pestaña (Layouts / Plantillas)**: Guarda la disposición de divisiones de una pestaña como plantilla para reutilizarla, o aplica plantillas preestablecidas (*Single Terminal*, *2 Terminals Vertical*, *2 Terminals Horizontal*, *4 Terminals 2x2 Grid*).

---

## ⌨️ Atajos de Teclado (Shortcuts)

| Atajo | Acción |
|---|---|
| `Ctrl + Shift + O` | Dividir terminal activa **horizontalmente** |
| `Ctrl + Shift + E` | Dividir terminal activa **verticalmente** |
| `Ctrl + Shift + T` | Abrir una **nueva pestaña** |
| `Ctrl + Shift + W` | **Cerrar** terminal activa (o pestaña si es la última) |
| `Click Derecho` | Abrir menú contextual de la terminal |

---

## 🚀 Instalación y Ejecución

### Requisitos previos
- **Node.js** v18 o superior y **npm** instalados.

### Ejecución Rápida en Modo Desarrollo
En la carpeta del proyecto, ejecuta:
```bash
# Iniciar con npm
npm start

# O mediante el script directo
./run.sh
```

---

## 📦 Empaquetado y Distribución Multiplataforma

MyTerminal Tux Tux está configurado con `electron-builder` para generar instaladores o binarios para cada sistema operativo:

- **Linux**:
  ```bash
  npx electron-builder --linux AppImage deb
  ```
- **Windows**:
  ```bash
  npx electron-builder --win nsis
  ```
- **macOS**:
  ```bash
  npx electron-builder --mac dmg
  ```

---

## 📂 Estructura del Código

```text
myterminal-tux-tux/
├── package.json              # Configuración y dependencias (Electron, xterm, node-pty)
├── run.sh                    # Script de inicio rápido
├── src/
│   ├── main/
│   │   ├── main.js           # Proceso principal: PTY spawn nativo, IPC y almacenamiento JSON
│   │   └── preload.js        # Context bridge seguro entre Main y Renderer
│   └── renderer/
│       ├── index.html        # Estructura de pestañas, modales y menú contextual
│       ├── styles.css        # Tema oscuro Terminator, splitters y toolbars
│       └── app.js            # Lógica de splits recursivos, xterm, SSH y persistencia
└── README.md                 # Documentación completa del proyecto
```

---

## 🐧 Licencia
MIT License - Creado para **MyTerminal Tux Tux**.
