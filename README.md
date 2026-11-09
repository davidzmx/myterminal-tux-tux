# <p align="center"><img src="build/icon.png" width="96" height="96" alt="Tux Tux Icon"><br>MyTerminal Tux Tux</p>

<p align="center">
  <b>Emulador de terminal multiplataforma (Linux, Windows y macOS) con divisiones estilo Terminator, grupos de comandos configurables, integración con Git, perfiles SSH con LED de estado, favoritos y persistencia de sesiones.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-33.2-blue?logo=electron" alt="Electron">
  <img src="https://img.shields.io/badge/Platform-Linux%20%7C%20Windows%20%7C%20macOS-green" alt="Platforms">
  <img src="https://img.shields.io/badge/License-MIT-purple" alt="License">
</p>

---

## ✨ Características Principales

### 1. Barra de Herramientas Inteligente por Terminal
Cada terminal abierta cuenta con una barra de herramientas completa:
- **Selector de Shells**:
  - **Linux / macOS**: Detecta automáticamente shells instaladas (`Bash`, `Zsh`, `Fish`, `Dash`, etc.).
  - **Windows**: Detecta `PowerShell`, `PowerShell 7`, `Command Prompt`, `Git Bash`, `WSL`, etc.
- **Carpetas Favoritas (`⭐▾`)**: Menú desplegable para saltar de inmediato a tus directorios guardados o agregar la carpeta actual con un clic.
- **Grupos de Comandos Configurables (`💻 Sistema ▾` / `🌿 Git ▾` / `🐳 Docker ▾`)**:
  - Conmutación automática inteligente: se activa el grupo Git si la carpeta es un repositorio, o el grupo predeterminado configurado (ej. Sistema) si no lo es.
  - Paleta interactiva de emojis/iconos al crear o editar grupos de botones.
  - Botones reordenables y personalizables con parámetros interactivos `{prompt:Mensaje}`.
- **Detección e Integración de Git**:
  - Pill de rama activa (`🌿 master ▾`): cambiar de rama o crear nuevas al vuelo.
  - Usuario Git (`👤 Usuario`): ver o editar autor del commit.
  - Botones rápidos: `Status`, `Add` (interactivo), `Commit` (con modal de mensaje), `Push`, `Pull`, `Fetch`, `Diff`, `Log`.
- **Sesión SSH Activa con Indicador LED Pulsante**:
  - Barra en rojo de alto contraste con LED verde parpadeante (`🟢`) tanto en la terminal como en la pestaña activa.
  - Botón de desconexión segura (`✖ Desconectar`).

---

### 2. División de Terminales (Splits estilo Terminator)
- Divide cualquier terminal **horizontalmente** (`Ctrl+Shift+O` o botón `⬍`) o **verticalmente** (`Ctrl+Shift+E` o botón `⬌`).
- Divisores interactivos arrastrables para ajustar proporciones.
- Árbol recursivo de divisiones ilimitadas en una sola pantalla.
- La nueva terminal hereda automáticamente el directorio de trabajo actual (`cwd`).

---

### 3. Pestañas (Tabs) y Sesiones
- Crea múltiples pestañas con `➕` o `Ctrl+Shift+T`.
- Renombrado rápido con doble clic.
- Indicador LED de sesión SSH en la pestaña correspondiente.
- **Guardado y Restauración de Sesiones**: Exporta/importa todas tus terminales, rutas y conexiones activas.

---

### 4. Menú Contextual (Click Derecho)
- ⬍ Dividir Horizontalmente (`Ctrl+Shift+O`)
- ⬌ Dividir Verticalmente (`Ctrl+Shift+E`)
- 🔑 Cargar Perfil SSH (con submenú)
- 📋 Copiar selección (`Ctrl+Shift+C`) / 📥 Pegar (`Ctrl+Shift+V` o botón rueda)
- 🧹 Limpiar pantalla
- ✕ Cerrar terminal (`Ctrl+Shift+W`) con confirmación si hay SSH activo

---

### 5. Copia de Seguridad y Portabilidad Multiplataforma
- En **Ajustes > Copia de Seguridad** puedes exportar toda la configuración de la aplicación en un único archivo JSON con nombre sugerido y fecha/hora (`myterminal-config-AAAA-MM-DD_HH-mm-ss.json`).
- Compatible entre computadoras Linux y Windows (con ajuste automático del shell por defecto de cada sistema).

---

## ⌨️ Atajos de Teclado

| Atajo | Acción |
|---|---|
| `Ctrl + Shift + O` | Dividir terminal activa **horizontalmente** |
| `Ctrl + Shift + E` | Dividir terminal activa **verticalmente** |
| `Ctrl + Shift + T` | Abrir una **nueva pestaña** |
| `Ctrl + Shift + W` | **Cerrar** terminal activa (con confirmación si hay SSH) |
| `Ctrl + Shift + C` | **Copiar** selección al portapapeles |
| `Ctrl + Shift + V` / `Shift + Insert` | **Pegar** conservando el foco en la terminal |
| `Esc` | Cerrar cualquier ventana modal activa y devolver foco a la consola |
| `Click Central (Rueda)` | Pegar directamente en Linux |
| `Click Derecho` | Abrir menú contextual de la terminal |

---

## 📦 Compilación y Generación de Instaladores

### Ejecutar en Desarrollo
```bash
npm install
npm start
# O usando el script:
./run.sh
```

### Generar Paquetes e Instaladores
- **Para Linux**:
  ```bash
  npm run dist:linux            # Genera .AppImage (Portable) y paquete instalable .deb
  npm run dist:linux:portable   # Genera únicamente .AppImage
  ```
- **Para Windows**:
  ```bash
  npm run dist:win              # Genera instalador Setup NSIS (.exe) y versión Portable (.exe)
  npm run dist:win:portable     # Genera únicamente la versión Portable (.exe)
  ```
- **Para macOS**:
  ```bash
  npm run dist:mac              # Genera instalador .dmg y archivo .zip
  ```

Los archivos ejecutables finales se ubican en la carpeta `dist/`.

---

## 🤖 Compilación Automática en GitHub Actions (CI/CD)

El repositorio incluye un flujo de trabajo en `.github/workflows/build-and-release.yml`:
1. **En cada push a `main` o `master`**: Compila en paralelo para Linux (AppImage y deb), Windows (instalador y portable) y macOS (dmg), dejándolos como artefactos descargables.
2. **Al publicar una etiqueta de versión (`v*`, ej. `v1.0.0`)**: Publica automáticamente una **GitHub Release** con todos los instaladores y ejecutables portables listos para el público general.

---

## 🚀 Subir a tu Repositorio de GitHub

Si vas a subir este proyecto a un nuevo repositorio de GitHub:

```bash
# 1. Enlazar con tu repositorio remoto de GitHub (sustituye TU_USUARIO y TU_REPOSITORIO):
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git

# 2. Asegurarte de que la rama principal se llame main:
git branch -M main

# 3. Subir todos los commits y etiquetas:
git push -u origin main
```

Para generar una versión oficial de lanzamiento con todos los instaladores:
```bash
git tag v1.0.0
git push origin v1.0.0
```

---

## 🐧 Licencia
MIT License - Desarrollado para **MyTerminal Tux Tux**.
