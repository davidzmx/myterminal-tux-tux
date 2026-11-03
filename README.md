# 🐧 MyTerminal Tux Tux

**MyTerminal Tux Tux** es un potente emulador de terminal multiplataforma (Linux, Windows y macOS) inspirado en Terminator, diseñado para desarrolladores y administradores de sistemas que necesitan organizar múltiples consolas simultáneas, gestionar pestañas, controlar repositorios Git directamente desde la barra de herramientas, guardar sesiones y conectar servidores SSH con un solo clic.

---

## ✨ Características Principales

### 1. Barra de Herramientas Inteligente por Terminal (con Git y Shells)
Cada terminal abierta cuenta con una barra de herramientas completa:
- **Selector de Shells**:
  - **Linux / macOS**: Detecta automáticamente las shells instaladas (`Bash`, `Dash`, `Zsh`, `Fish`, `Sh`, etc.).
  - **Windows**: Detecta `PowerShell`, `PowerShell 7`, `Command Prompt`, `Git Bash`, `Cygwin`, `WSL`, etc.
  - Cambia de shell al instante conservando el directorio actual.
- **Botón de Enlace (`🔗`)**: Enfoque rápido y vinculación de terminal.
- **Detección Automática de Git**:
  - Si el directorio actual es un repositorio Git, se activa la suite Git:
    - **Pill de Rama Activa (`🌿 master ▾`)**: Muestra la rama actual y, al hacer clic, despliega la lista de ramas locales para cambiar de rama (`git checkout`) o crear una nueva (`➕ Nueva rama...`).
    - **Usuario Git (`👤 David`)**: Muestra el nombre de usuario de Git configurado en el repositorio (`git config user.name`). Al hacer clic permite modificar el nombre y correo del commit.
    - **Botones de Acción Rápida Git**:
      - `Status` → `git status`
      - `Add` → `git add -A`
      - `Unstage` → `git reset`
      - `Commit` → Solicita el mensaje y ejecuta `git commit -m "..."`
      - `Push` → `git push`
      - `Pull` → `git pull`
      - `Fetch` → `git fetch`
      - `Diff` → `git diff`
      - `Log` → `git log --oneline -n 10`
      - `user Git` → Abre el diálogo para configurar `user.name` y `user.email`
- **Controles de División y Conexión**:
  - Botón `⬌ V`: División vertical rápida.
  - Botón `⬍ H`: División horizontal rápida.
  - Selector `🔑 SSH ▾`: Carga y conecta cualquier servidor SSH guardado al instante.
  - Botón `✕`: Cierra la terminal y redistribuye el espacio.

---

### 2. División de Terminales (Splits estilo Terminator)
- Divide cualquier terminal **horizontalmente** o **verticalmente**.
- Divisores interactivos y redimensionables arrastrando el ratón para ajustar las proporciones deseadas.
- Árbol binario de splits recursivos infinitos en una sola pantalla.

---

### 3. Múltiples Pestañas (Tabs)
- Crea tantas pestañas como desees con el botón `➕` o `Ctrl+Shift+T`.
- Cada pestaña posee su propio árbol independiente de terminales y divisiones.
- Doble clic en el título de la pestaña para renombrarla.

---

### 4. Menú Contextual (Click Derecho)
- Haz clic derecho sobre cualquier terminal para desplegar el menú rápido:
  - ⬍ Dividir Horizontalmente (`Ctrl+Shift+O`)
  - ⬌ Dividir Verticalmente (`Ctrl+Shift+E`)
  - 🔑 Cargar Perfil SSH (con submenú desplegable de tus conexiones)
  - 📋 Copiar selección / 📥 Pegar
  - 🧹 Limpiar pantalla
  - ✕ Cerrar terminal (`Ctrl+Shift+W`)

---

### 5. Administrador de Perfiles SSH
- Guarda tus conexiones remotas con:
  - Nombre del perfil (ej. *VPS Producción*, *Raspberry Pi*).
  - Host / Dirección IP y Puerto (por defecto 22).
  - Usuario SSH.
  - Autenticación por Contraseña o por Clave Privada (`.pem`, `.id_rsa`).
  - Argumentos adicionales opcionales (`-X`, `-C`, etc.).

---

### 6. Persistencia de Estado (Sesiones y Plantillas)
- **Estado General**: Guarda todas las pestañas abiertas y toda la estructura jerárquica de terminales con un nombre personalizado (ej. *Monitoreo Diario*, *Dev Backend*). Al restaurar, se reconstruye exactamente toda la distribución de terminales.
- **Estado por Pestaña**: Guarda la disposición de divisiones de una pestaña como plantilla para reutilizarla, o aplica plantillas preestablecidas (*Single Terminal*, *2 Terminals Vertical*, *2 Terminals Horizontal*, *4 Terminals 2x2 Grid*).

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

## 🚀 Ejecución y Compilación Portable

### Ejecutar en Desarrollo
```bash
./run.sh
# O con npm:
npm start
```

### Compilar Versiones Portables (Sin Instalador) e Instaladores
- **Linux**:
  ```bash
  npm run dist:linux:portable    # Genera el .AppImage (Portable)
  npm run dist:linux             # Genera .AppImage y paquete .deb
  ```
- **Windows**:
  ```bash
  npm run dist:win:portable      # Genera el ejecutable .exe (Portable sin instalación)
  npm run dist:win               # Genera el .exe portable y el instalador Setup NSIS
  ```
- **macOS**:
  ```bash
  npm run dist:mac               # Genera archivo .dmg y .zip para macOS
  ```

Los archivos ejecutables y portables resultantes se guardan en la carpeta `dist/`.

---

## 🐧 Licencia
MIT License - Desarrollado para **MyTerminal Tux Tux**.
