const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { shell } = require('electron');

class GDriveService {
  constructor(configDir) {
    this.configDir = configDir || path.join(os.homedir(), '.config', 'myterminal-tux-tux');
    this.clientCredsPath = path.join(this.configDir, 'gdrive-client.json');
    this.tokenPath = path.join(this.configDir, 'gdrive-token.json');

    this.oauthServer = null;
    this.syncFileName = 'tux-tux-sync.enc';
    this.authTimeout = 120000; // 2 minutos para completar login en navegador
  }

  /**
   * Obtiene el estado actual de la integración con Google Drive
   */
  async getStatus() {
    const hasClient = fs.existsSync(this.clientCredsPath);
    let clientInfo = null;
    if (hasClient) {
      try {
        const clientData = JSON.parse(fs.readFileSync(this.clientCredsPath, 'utf8'));
        const creds = clientData.installed || clientData.web || clientData;
        if (creds && creds.client_id) {
          clientInfo = {
            clientId: creds.client_id.substring(0, 16) + '...',
            projectId: creds.project_id || 'Personal'
          };
        }
      } catch (err) {
        console.warn('Error leyendo gdrive-client.json:', err.message);
      }
    }

    const hasToken = fs.existsSync(this.tokenPath);
    let userEmail = null;
    let isAuthenticated = false;

    if (hasToken) {
      try {
        const tokenData = JSON.parse(fs.readFileSync(this.tokenPath, 'utf8'));
        if (tokenData && (tokenData.access_token || tokenData.refresh_token)) {
          userEmail = tokenData.userEmail || null;
          isAuthenticated = true;
        }
      } catch (err) {
        console.warn('Error leyendo gdrive-token.json:', err.message);
      }
    }

    return {
      hasClientConfig: !!clientInfo,
      clientInfo,
      isAuthenticated,
      userEmail,
      syncFileName: this.syncFileName
    };
  }

  /**
   * Importa y valida un archivo de credenciales de Google OAuth (credentials.json)
   */
  async importClientCredentials(filePathOrContent) {
    let content;
    if (typeof filePathOrContent === 'string' && fs.existsSync(filePathOrContent)) {
      content = fs.readFileSync(filePathOrContent, 'utf8');
    } else if (typeof filePathOrContent === 'string') {
      content = filePathOrContent;
    } else {
      content = JSON.stringify(filePathOrContent);
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      throw new Error('El archivo no contiene un JSON válido.');
    }

    const creds = parsed.installed || parsed.web || parsed;
    if (!creds || !creds.client_id || !creds.client_secret) {
      throw new Error('El JSON no contiene client_id o client_secret válidos de Google OAuth.');
    }

    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }

    fs.writeFileSync(this.clientCredsPath, JSON.stringify(parsed, null, 2), 'utf8');
    return {
      success: true,
      clientId: creds.client_id.substring(0, 16) + '...',
      projectId: creds.project_id || 'Personal'
    };
  }

  /**
   * Carga las credenciales del cliente guardadas
   */
  getClientCredentials() {
    if (!fs.existsSync(this.clientCredsPath)) {
      throw new Error('No se han configurado las credenciales de Google OAuth. Carga tu credentials.json primero.');
    }

    const data = JSON.parse(fs.readFileSync(this.clientCredsPath, 'utf8'));
    const creds = data.installed || data.web || data;
    if (!creds || !creds.client_id || !creds.client_secret) {
      throw new Error('Credenciales de Google OAuth inválidas.');
    }

    return creds;
  }

  /**
   * Carga los tokens de acceso/refresco
   */
  getTokenData() {
    if (!fs.existsSync(this.tokenPath)) {
      return null;
    }
    try {
      return JSON.parse(fs.readFileSync(this.tokenPath, 'utf8'));
    } catch (e) {
      return null;
    }
  }

  /**
   * Guarda los tokens de acceso
   */
  saveTokenData(tokenData) {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
    fs.writeFileSync(this.tokenPath, JSON.stringify(tokenData, null, 2), 'utf8');
  }

  /**
   * Cierra la sesión de Google Drive
   */
  async logout() {
    if (fs.existsSync(this.tokenPath)) {
      fs.unlinkSync(this.tokenPath);
    }
    return { success: true };
  }

  /**
   * Inicia el flujo OAuth 2.0 en el navegador del usuario y captura el token
   */
  async startOAuthFlow() {
    const creds = this.getClientCredentials();

    return new Promise((resolve, reject) => {
      // Iniciar servidor loopback local en un puerto disponible
      const server = http.createServer();
      this.oauthServer = server;

      let authTimeoutTimer = null;
      let redirectUri = '';

      server.on('request', async (req, res) => {
        try {
          const parsedUrl = url.parse(req.url, true);
          if (parsedUrl.pathname === '/oauth2callback' || parsedUrl.pathname === '/' || parsedUrl.query.code || parsedUrl.query.error) {
            const code = parsedUrl.query.code;
            const error = parsedUrl.query.error;

            if (error) {
              res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(`
                <html>
                  <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #0f172a; color: #f87171;">
                    <h2>❌ Error de autenticación</h2>
                    <p>${error}</p>
                    <p>Puedes cerrar esta ventana e intentarlo nuevamente en MyTerminal Tux Tux.</p>
                  </body>
                </html>
              `);
              cleanup();
              reject(new Error(`Error de autenticación de Google: ${error}`));
              return;
            }

            if (code) {
              // Intercambiar código por tokens
              const tokenData = await this.exchangeCodeForTokens(code, creds, redirectUri);

              // Obtener información del usuario (email)
              let userEmail = 'Usuario de Google';
              try {
                const userInfo = await this.fetchUserInfo(tokenData.access_token);
                if (userInfo && userInfo.email) {
                  userEmail = userInfo.email;
                  tokenData.userEmail = userEmail;
                }
              } catch (err) {
                console.warn('No se pudo obtener el email del usuario:', err.message);
              }

              this.saveTokenData(tokenData);

              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(`
                <!DOCTYPE html>
                <html>
                  <head>
                    <meta charset="utf-8">
                    <title>Autenticación Exitosa - MyTerminal Tux Tux</title>
                    <style>
                      body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        background: #0e0f12;
                        color: #e2e8f0;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        min-height: 80vh;
                        margin: 0;
                      }
                      .card {
                        background: #1c1d25;
                        border: 1px solid #2b2e3c;
                        border-radius: 12px;
                        padding: 36px 48px;
                        text-align: center;
                        max-width: 480px;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                      }
                      h2 { color: #00adb5; margin-top: 10px; }
                      p { color: #94a3b8; font-size: 15px; line-height: 1.6; }
                      .user-tag { background: #22242f; padding: 6px 14px; border-radius: 20px; font-weight: 600; color: #4ade80; display: inline-block; margin: 10px 0; }
                    </style>
                  </head>
                  <body>
                    <div class="card">
                      <div style="font-size: 48px;">🐧 ✅</div>
                      <h2>¡Autenticación Exitosa!</h2>
                      <div class="user-tag">${userEmail}</div>
                      <p>MyTerminal Tux Tux se ha conectado correctamente a tu Google Drive para sincronizar tus sesiones y perfiles SSH.</p>
                      <p style="font-size: 13px; color: #64748b;">Ya puedes cerrar esta pestaña del navegador y regresar a la aplicación.</p>
                    </div>
                  </body>
                </html>
              `);

              cleanup();
              resolve({
                success: true,
                userEmail,
                tokenData
              });
            }
          }
        } catch (err) {
          cleanup();
          reject(err);
        }
      });

      const cleanup = () => {
        if (authTimeoutTimer) clearTimeout(authTimeoutTimer);
        if (server) {
          try {
            server.close();
          } catch (e) {}
        }
        this.oauthServer = null;
      };

      // Iniciar en puerto disponible (loopback)
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        const redirectHost = (creds.redirect_uris && creds.redirect_uris.some((u) => u.includes('localhost')))
          ? 'localhost'
          : '127.0.0.1';
        redirectUri = `http://${redirectHost}:${port}/oauth2callback`;

        // Scopes para drive:
        // 'https://www.googleapis.com/auth/drive.file' permite leer y escribir archivos creados por Tux Tux
        // 'https://www.googleapis.com/auth/drive.appdata' permite almacenar datos ocultos en Drive
        const scopes = [
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/drive.appdata',
          'https://www.googleapis.com/auth/userinfo.email'
        ].join(' ');

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
          `client_id=${encodeURIComponent(creds.client_id)}&` +
          `redirect_uri=${encodeURIComponent(redirectUri)}&` +
          `response_type=code&` +
          `scope=${encodeURIComponent(scopes)}&` +
          `access_type=offline&` +
          `prompt=consent`;

        // Abrir navegador
        shell.openExternal(authUrl);

        authTimeoutTimer = setTimeout(() => {
          cleanup();
          reject(new Error('Tiempo de espera agotado para el inicio de sesión con Google.'));
        }, this.authTimeout);
      });

      server.on('error', (err) => {
        cleanup();
        reject(new Error(`Error al iniciar el servidor local de autenticación: ${err.message}`));
      });
    });
  }

  /**
   * Intercambia el código de autorización por tokens
   */
  async exchangeCodeForTokens(code, creds, redirectUri) {
    const postData = new URLSearchParams({
      code,
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    }).toString();

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: postData
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Error canjeando código OAuth (${response.status}): ${errText}`);
    }

    const data = await response.json();
    data.expires_at = Date.now() + (data.expires_in || 3600) * 1000;
    return data;
  }

  /**
   * Obtiene la información del usuario (email)
   */
  async fetchUserInfo(accessToken) {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (response.ok) {
      return await response.json();
    }
    return null;
  }

  /**
   * Obtiene un access_token válido, refrescándolo si está expirado
   */
  async getValidAccessToken() {
    const tokenData = this.getTokenData();
    if (!tokenData || (!tokenData.access_token && !tokenData.refresh_token)) {
      throw new Error('No has iniciado sesión en Google Drive. Conecta tu cuenta primero.');
    }

    // Si aún no expira (con margen de 60 segundos), usar el actual
    if (tokenData.access_token && tokenData.expires_at && Date.now() < (tokenData.expires_at - 60000)) {
      return tokenData.access_token;
    }

    // Refrescar token
    if (!tokenData.refresh_token) {
      throw new Error('La sesión de Google Drive ha expirado. Por favor, vuelve a iniciar sesión.');
    }

    const creds = this.getClientCredentials();
    const postData = new URLSearchParams({
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      refresh_token: tokenData.refresh_token,
      grant_type: 'refresh_token'
    }).toString();

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: postData
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Error al refrescar token de Google (${response.status}): ${errText}`);
    }

    const refreshed = await response.json();
    tokenData.access_token = refreshed.access_token;
    tokenData.expires_at = Date.now() + (refreshed.expires_in || 3600) * 1000;
    if (refreshed.refresh_token) {
      tokenData.refresh_token = refreshed.refresh_token;
    }

    this.saveTokenData(tokenData);
    return tokenData.access_token;
  }

  /**
   * Busca si el archivo de sincronización ya existe en Google Drive
   */
  async findRemoteSyncFile() {
    const accessToken = await this.getValidAccessToken();
    const query = encodeURIComponent(`name = '${this.syncFileName}' and trashed = false`);
    const fields = encodeURIComponent('files(id, name, modifiedTime, size)');
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&spaces=drive,appDataFolder`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Error al consultar Google Drive (${response.status}): ${errText}`);
    }

    const data = await response.json();
    if (data.files && data.files.length > 0) {
      return data.files[0];
    }
    return null;
  }

  /**
   * Sube el paquete cifrado a Google Drive (crea o actualiza)
   * @param {string} encryptedContent - Paquete cifrado con la contraseña maestra
   * @returns {object} Información del archivo en Google Drive
   */
  async uploadSyncFile(encryptedContent) {
    const accessToken = await this.getValidAccessToken();
    const existingFile = await this.findRemoteSyncFile();

    if (existingFile) {
      // Actualizar archivo existente (PATCH media)
      const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`;
      const response = await fetch(uploadUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: encryptedContent
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Error al actualizar archivo en Google Drive (${response.status}): ${errText}`);
      }

      const result = await response.json();
      return {
        action: 'updated',
        fileId: existingFile.id,
        modifiedTime: result.modifiedTime || new Date().toISOString()
      };
    } else {
      // Crear nuevo archivo multipart
      const metadata = {
        name: this.syncFileName,
        mimeType: 'application/json',
        description: 'Copia de seguridad cifrada de MyTerminal Tux Tux'
      };

      const boundary = '-------TuxTuxSyncBoundary' + Math.random().toString(36).substring(2);
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const multipartBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        encryptedContent +
        closeDelimiter;

      const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartBody
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Error al subir archivo a Google Drive (${response.status}): ${errText}`);
      }

      const result = await response.json();
      return {
        action: 'created',
        fileId: result.id,
        modifiedTime: result.modifiedTime || new Date().toISOString()
      };
    }
  }

  /**
   * Descarga el paquete cifrado desde Google Drive
   * @returns {string} Contenido cifrado recibido de Google Drive
   */
  async downloadSyncFile() {
    const accessToken = await this.getValidAccessToken();
    const remoteFile = await this.findRemoteSyncFile();

    if (!remoteFile) {
      throw new Error('No se encontró ninguna copia de seguridad en tu Google Drive.');
    }

    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${remoteFile.id}?alt=media`;
    const response = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Error al descargar desde Google Drive (${response.status}): ${errText}`);
    }

    const content = await response.text();
    return {
      content,
      remoteFile
    };
  }
}

module.exports = GDriveService;

