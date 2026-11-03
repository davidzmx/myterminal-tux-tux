// MyTerminal Tux Tux - Main Application Logic

function getTerminalClass() {
  return (window.Terminal && window.Terminal.Terminal) || window.Terminal;
}

function getFitAddonClass() {
  return (window.FitAddon && window.FitAddon.FitAddon) || window.FitAddon;
}

function getWebLinksAddonClass() {
  return (window.WebLinksAddon && window.WebLinksAddon.WebLinksAddon) || window.WebLinksAddon;
}

class TuxTerminalApp {
  constructor() {
    this.config = null;
    this.tabs = [];
    this.activeTabId = null;
    this.activeTerminalId = null;
    this.terminals = new Map(); // id -> { term, fitAddon, ptyId, shellPath, gitInfo, ... }
    this.profiles = [];
    this.availableShells = [];
    this.contextTargetTermId = null;
    this.gitTargetTermId = null;

    this.initElements();
    this.bindGlobalEvents();
    this.loadInitialData();
  }

  initElements() {
    this.tabsListEl = document.getElementById('tabs-list');
    this.workspaceEl = document.getElementById('workspace');
    this.btnNewTab = document.getElementById('btn-new-tab');
    this.statusBarActiveTab = document.getElementById('active-tab-info');
    this.statusBarActiveTerm = document.getElementById('active-term-info');
    this.contextMenu = document.getElementById('context-menu');
    this.ctxSshSubmenu = document.getElementById('ctx-ssh-submenu');

    // Theme Toggle
    this.btnThemeToggle = document.getElementById('btn-theme-toggle');
    this.themeIcon = document.getElementById('theme-icon');
    this.themeText = document.getElementById('theme-text');

    // Modals
    this.modalSettings = document.getElementById('modal-settings');
    this.modalSsh = document.getElementById('modal-ssh');
    this.modalSession = document.getElementById('modal-session');
    this.modalTabLayout = document.getElementById('modal-tab-layout');
    this.modalGitUser = document.getElementById('modal-git-user');
    this.modalEditGitAction = document.getElementById('modal-edit-git-action');

    // Settings Modal elements
    this.cfgThemeSelect = document.getElementById('cfg-theme');
    this.cfgDefaultShellSelect = document.getElementById('cfg-default-shell');
    this.cfgDefaultDirSelect = document.getElementById('cfg-default-dir');
    this.cfgFontSizeInput = document.getElementById('cfg-font-size');
    this.cfgFontFamilyInput = document.getElementById('cfg-font-family');
    this.cfgScrollbackInput = document.getElementById('cfg-scrollback');
    this.generalConfigForm = document.getElementById('general-config-form');
    this.gitActionsListEl = document.getElementById('git-actions-list');

    // Edit Single Git Action Form
    this.editGitActionForm = document.getElementById('edit-git-action-form');
    this.editGitModalTitle = document.getElementById('edit-git-modal-title');
    this.editGitModalIcon = document.getElementById('edit-git-modal-icon');
    this.editGitActionIdInput = document.getElementById('edit-git-action-id');
    this.editGitActionLabelInput = document.getElementById('edit-git-action-label');
    this.editGitActionCmdInput = document.getElementById('edit-git-action-cmd');
    this.groupEditGitCmd = document.getElementById('group-edit-git-cmd');

    // SSH Form elements
    this.sshForm = document.getElementById('ssh-profile-form');
    this.sshProfilesListEl = document.getElementById('ssh-profiles-list');
    this.sshAuthTypeSelect = document.getElementById('ssh-auth-type');
    this.sshPasswordGroup = document.getElementById('group-ssh-password');
    this.sshKeyGroup = document.getElementById('group-ssh-key');
    this.sshPassphraseGroup = document.getElementById('group-ssh-passphrase');
    this.btnToggleSshPwd = document.getElementById('btn-toggle-ssh-pwd');
    this.btnToggleSshPhrase = document.getElementById('btn-toggle-ssh-phrase');
    this.btnSshDelete = document.getElementById('btn-ssh-delete');
    this.btnSshConnectActive = document.getElementById('btn-ssh-connect-active');

    // Git Form
    this.gitUserForm = document.getElementById('git-user-form');
  }

  async loadInitialData() {
    try {
      this.config = await window.api.getConfig();
      if (this.config && this.config.gitActions) {
        this.config.gitActions = this.config.gitActions.filter(a => a.action !== 'user-git' && a.label !== 'user Git');
      }
    } catch (e) {
      console.error('Error loading config:', e);
      this.config = { theme: 'dark', defaultDir: 'cwd', gitActions: [] };
    }

    try {
      this.availableShells = await window.api.getAvailableShells();
    } catch (e) {
      console.error('Error fetching shells:', e);
      this.availableShells = [{ name: 'Bash', path: '/bin/bash' }];
    }

    this.applyTheme(this.config.theme || 'dark');

    try {
      this.profiles = await window.api.getProfiles();
      this.renderSshProfilesList();
    } catch (e) {
      console.error('Error loading SSH profiles:', e);
      this.profiles = [];
    }

    // Create first default tab
    this.createTab('Principal');

    // Polling git info every 2.5s for terminals
    setInterval(() => {
      this.updateAllGitInfo();
    }, 2500);

    window.addEventListener('resize', () => {
      this.fitAllTerminals();
    });
  }

  // ================= THEME (DARK / LIGHT) =================
  applyTheme(theme) {
    if (!this.config) this.config = {};
    this.config.theme = theme;

    if (theme === 'light') {
      document.body.classList.remove('theme-dark');
      document.body.classList.add('theme-light');
      this.themeIcon.textContent = '☀️';
      this.themeText.textContent = 'Claro';
    } else {
      document.body.classList.remove('theme-light');
      document.body.classList.add('theme-dark');
      this.themeIcon.textContent = '🌙';
      this.themeText.textContent = 'Oscuro';
    }

    const xtermTheme = this.getXtermTheme(theme);
    for (const item of this.terminals.values()) {
      if (item.term) {
        item.term.options.theme = xtermTheme;
      }
    }
  }

  getXtermTheme(theme) {
    if (theme === 'light') {
      return {
        background: '#ffffff',
        foreground: '#1e293b',
        cursor: '#2563eb',
        cursorAccent: '#ffffff',
        selectionBackground: 'rgba(37, 99, 235, 0.25)',
        black: '#000000',
        red: '#dc2626',
        green: '#16a34a',
        yellow: '#ca8a04',
        blue: '#2563eb',
        magenta: '#9333ea',
        cyan: '#0891b2',
        white: '#64748b'
      };
    }
    return {
      background: '#0c0d12',
      foreground: '#e2e8f0',
      cursor: '#00adb5',
      cursorAccent: '#0c0d12',
      selectionBackground: 'rgba(0, 173, 181, 0.3)',
      black: '#121317',
      red: '#ef4444',
      green: '#10b981',
      yellow: '#ffb703',
      blue: '#3a86ff',
      magenta: '#8b5cf6',
      cyan: '#00adb5',
      white: '#ffffff'
    };
  }

  async toggleTheme() {
    const next = this.config.theme === 'light' ? 'dark' : 'light';
    this.applyTheme(next);
    await window.api.saveConfig(this.config);
  }

  bindGlobalEvents() {
    this.btnThemeToggle.addEventListener('click', () => {
      this.toggleTheme();
    });

    document.getElementById('btn-settings').addEventListener('click', () => {
      this.openSettingsModal();
    });

    this.btnNewTab.addEventListener('click', () => {
      this.createTab(`Pestaña ${this.tabs.length + 1}`);
    });

    document.getElementById('btn-ssh-manager').addEventListener('click', () => {
      this.openSshModal();
    });

    document.getElementById('btn-global-sessions').addEventListener('click', () => {
      this.openSessionModal();
    });

    document.getElementById('btn-tab-layouts').addEventListener('click', () => {
      this.openTabLayoutModal();
    });

    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close-modal');
        document.getElementById(modalId).classList.add('hidden');
      });
    });

    document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
      backdrop.addEventListener('click', (e) => {
        e.target.closest('.modal').classList.add('hidden');
      });
    });

    document.querySelectorAll('.settings-nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.settings-nav-btn').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.settings-tab-pane').forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        const targetId = btn.getAttribute('data-settings-tab');
        document.getElementById(targetId).classList.add('active');
      });
    });

    this.generalConfigForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveGeneralConfig();
    });

    // Button: + Nueva Acción (Opens clean modal to enter Name & Command)
    document.getElementById('btn-add-git-action').addEventListener('click', () => {
      this.openCreateGitActionModal();
    });

    document.getElementById('btn-reset-git-actions').addEventListener('click', async () => {
      if (confirm('¿Restaurar todas las acciones y comandos Git predeterminados?')) {
        await this.resetDefaultGitActions();
      }
    });

    document.getElementById('btn-save-git-actions').addEventListener('click', async () => {
      await this.saveGitActionsConfig();
    });

    // Single Git Action form submit
    this.editGitActionForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const actionId = this.editGitActionIdInput.value;
      const newLabel = this.editGitActionLabelInput.value.trim();
      const newCmd = this.editGitActionCmdInput.value.trim();

      if (!newLabel) {
        alert('Por favor ingresa un nombre para el botón.');
        return;
      }

      if (actionId) {
        // Edit existing
        const action = this.config.gitActions.find((a) => a.id === actionId);
        if (action) {
          action.label = newLabel;
          if (action.action !== 'user-git') {
            action.cmd = newCmd;
          }
        }
      } else {
        // Create new
        if (!this.config.gitActions) this.config.gitActions = [];
        this.config.gitActions.push({
          id: 'act_' + Math.random().toString(36).substring(2, 8),
          label: newLabel,
          cmd: newCmd || 'git ',
          enabled: true
        });
      }

      await window.api.saveConfig(this.config);
      this.renderGitActionsConfig();
      this.refreshAllGitToolbars();
      this.modalEditGitAction.classList.add('hidden');
    });

    // SSH form auth type toggle
    this.sshAuthTypeSelect.addEventListener('change', (e) => {
      const isKey = e.target.value === 'key';
      this.sshKeyGroup.style.display = isKey ? 'block' : 'none';
      this.sshPassphraseGroup.style.display = isKey ? 'block' : 'none';
      this.sshPasswordGroup.style.display = isKey ? 'none' : 'block';
    });

    // Toggle password visibility buttons
    this.btnToggleSshPwd.addEventListener('click', () => {
      const pwdInput = document.getElementById('ssh-password');
      pwdInput.type = pwdInput.type === 'password' ? 'text' : 'password';
    });

    this.btnToggleSshPhrase.addEventListener('click', () => {
      const phraseInput = document.getElementById('ssh-passphrase');
      phraseInput.type = phraseInput.type === 'password' ? 'text' : 'password';
    });

    this.sshForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSaveSshProfile();
    });

    this.btnSshDelete.addEventListener('click', () => {
      this.handleDeleteSshProfile();
    });

    this.btnSshConnectActive.addEventListener('click', () => {
      const profile = this.getSelectedFormProfile();
      if (profile && this.activeTerminalId) {
        this.handleSshProfileSelection(this.activeTerminalId, profile);
        this.modalSsh.classList.add('hidden');
      } else if (!this.activeTerminalId) {
        alert('Selecciona o haz clic en una terminal primero.');
      }
    });

    this.modalSshSwitch = document.getElementById('modal-ssh-switch');

    document.getElementById('btn-ssh-switch-replace').addEventListener('click', () => {
      this.modalSshSwitch.classList.add('hidden');
      const termId = this.sshSwitchTermId;
      const targetProfile = this.sshSwitchTargetProfile;
      if (!termId || !targetProfile) return;

      const inst = this.terminals.get(termId);
      if (inst) {
        window.api.writeTerminal(termId, 'exit\r');
        inst.sshSession = null;
        inst.sshShowGit = false;
        this.updateToolbarSshStatus(termId);
      }
      setTimeout(() => {
        this.connectSshProfile(termId, targetProfile);
      }, 400);
    });

    document.getElementById('btn-ssh-switch-split').addEventListener('click', () => {
      this.modalSshSwitch.classList.add('hidden');
      const termId = this.sshSwitchTermId;
      const targetProfile = this.sshSwitchTargetProfile;
      if (!termId || !targetProfile) return;

      this.splitTerminal(termId, 'vertical');
      const newTermId = this.activeTerminalId;
      setTimeout(() => {
        this.connectSshProfile(newTermId, targetProfile);
      }, 350);
    });

    document.getElementById('btn-ssh-switch-tab').addEventListener('click', () => {
      this.modalSshSwitch.classList.add('hidden');
      const targetProfile = this.sshSwitchTargetProfile;
      if (!targetProfile) return;

      this.addNewTab(targetProfile.name);
      const newTermId = this.activeTerminalId;
      setTimeout(() => {
        this.connectSshProfile(newTermId, targetProfile);
      }, 350);
    });

    document.getElementById('btn-ssh-add-new').addEventListener('click', () => {
      this.clearSshForm();
    });

    document.getElementById('btn-save-current-session').addEventListener('click', () => {
      this.handleSaveSession();
    });

    document.getElementById('btn-save-tab-template').addEventListener('click', () => {
      this.handleSaveTabTemplate();
    });

    this.gitUserForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const termId = this.gitTargetTermId || this.activeTerminalId;
      if (!termId) return;

      const name = document.getElementById('git-user-name').value.trim();
      const email = document.getElementById('git-user-email').value.trim();

      await window.api.setGitUser(termId, name, email);
      this.modalGitUser.classList.add('hidden');
      this.refreshGitInfo(termId);
    });

    document.addEventListener('click', (e) => {
      if (!this.contextMenu.contains(e.target)) {
        this.hideContextMenu();
      }
      if (!e.target.closest('.ssh-select-wrapper')) {
        document.querySelectorAll('.ssh-dropdown-menu.show').forEach((m) => m.classList.remove('show'));
      }
      if (!e.target.closest('.tb-git-branch-wrapper')) {
        document.querySelectorAll('.tb-git-dropdown.show').forEach((m) => m.classList.remove('show'));
      }
      if (!e.target.closest('.tb-git-overflow-wrapper')) {
        document.querySelectorAll('.tb-git-overflow-menu.show').forEach((m) => m.classList.remove('show'));
      }
    });

    this.contextMenu.addEventListener('click', (e) => {
      const item = e.target.closest('.menu-item');
      if (!item || item.classList.contains('has-submenu')) return;

      const action = item.getAttribute('data-action');
      const termId = this.contextTargetTermId || this.activeTerminalId;

      this.hideContextMenu();
      if (!termId) return;

      switch (action) {
        case 'split-h':
          this.splitTerminal(termId, 'horizontal');
          break;
        case 'split-v':
          this.splitTerminal(termId, 'vertical');
          break;
        case 'copy':
          this.copyTerminalSelection(termId);
          break;
        case 'paste':
          this.pasteToTerminal(termId);
          break;
        case 'clear':
          this.clearTerminal(termId);
          break;
        case 'close-terminal':
          this.closeTerminal(termId);
          break;
      }
    });

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey) {
        if (e.key === 'T' || e.key === 't') {
          e.preventDefault();
          this.createTab(`Pestaña ${this.tabs.length + 1}`);
        } else if (e.key === 'O' || e.key === 'o') {
          e.preventDefault();
          if (this.activeTerminalId) this.splitTerminal(this.activeTerminalId, 'horizontal');
        } else if (e.key === 'E' || e.key === 'e') {
          e.preventDefault();
          if (this.activeTerminalId) this.splitTerminal(this.activeTerminalId, 'vertical');
        } else if (e.key === 'W' || e.key === 'w') {
          e.preventDefault();
          if (this.activeTerminalId) this.closeTerminal(this.activeTerminalId);
        }
      }
    });
  }

  // ================= SETTINGS MODAL =================
  openSettingsModal() {
    this.cfgThemeSelect.value = this.config.theme || 'dark';
    this.cfgDefaultDirSelect.value = this.config.defaultDir || 'cwd';
    this.cfgFontSizeInput.value = this.config.fontSize || 13;
    this.cfgFontFamilyInput.value = this.config.fontFamily || "Consolas, 'Fira Code', monospace";
    this.cfgScrollbackInput.value = this.config.scrollback || 5000;

    this.cfgDefaultShellSelect.innerHTML = '';
    this.availableShells.forEach((sh) => {
      const opt = document.createElement('option');
      opt.value = sh.path;
      opt.textContent = `${sh.name} (${sh.path})`;
      if (sh.path === this.config.defaultShell) {
        opt.selected = true;
      }
      this.cfgDefaultShellSelect.appendChild(opt);
    });

    this.renderGitActionsConfig();
    this.modalSettings.classList.remove('hidden');
  }

  async saveGeneralConfig() {
    this.config.theme = this.cfgThemeSelect.value;
    this.config.defaultShell = this.cfgDefaultShellSelect.value;
    this.config.defaultDir = this.cfgDefaultDirSelect.value;
    this.config.fontSize = parseInt(this.cfgFontSizeInput.value, 10) || 13;
    this.config.fontFamily = this.cfgFontFamilyInput.value.trim() || "Consolas, 'Fira Code', monospace";
    this.config.scrollback = parseInt(this.cfgScrollbackInput.value, 10) || 5000;

    this.applyTheme(this.config.theme);

    for (const item of this.terminals.values()) {
      if (item.term) {
        item.term.options.fontSize = this.config.fontSize;
        item.term.options.fontFamily = this.config.fontFamily;
        item.term.options.scrollback = this.config.scrollback;
      }
    }
    this.fitAllTerminals();

    await window.api.saveConfig(this.config);
    this.modalSettings.classList.add('hidden');
  }

  renderGitActionsConfig() {
    this.gitActionsListEl.innerHTML = '';
    const actions = this.config.gitActions || [];

    actions.forEach((act, index) => {
      const row = document.createElement('div');
      row.className = 'git-action-config-row';

      // Checkbox
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.className = 'git-action-enable col-vis';
      chk.checked = act.enabled !== false;
      chk.title = 'Mostrar botón en la barra';

      // Label input
      const inputLabel = document.createElement('input');
      inputLabel.type = 'text';
      inputLabel.className = 'git-action-input-label col-name';
      inputLabel.value = act.label || '';
      inputLabel.placeholder = 'Etiqueta';

      // Command input
      const inputCmd = document.createElement('input');
      inputCmd.type = 'text';
      inputCmd.className = 'git-action-input-cmd col-cmd';
      inputCmd.value = act.cmd || (act.action === 'user-git' ? '(Abre ventana de usuario Git)' : '');
      inputCmd.placeholder = 'Comando git exacto (ej. git status)';
      if (act.action === 'user-git') {
        inputCmd.readOnly = true;
      }

      // Buttons container
      const btnsBox = document.createElement('div');
      btnsBox.className = 'git-action-row-btns col-ops';

      // Edit dialog button
      const btnEdit = document.createElement('button');
      btnEdit.type = 'button';
      btnEdit.className = 'btn btn-sm btn-primary';
      btnEdit.innerHTML = '✏️';
      btnEdit.title = 'Editar en ventana dedicada';
      btnEdit.addEventListener('click', () => {
        this.openEditSingleGitActionModal(act);
      });

      // Delete button
      const btnDel = document.createElement('button');
      btnDel.type = 'button';
      btnDel.className = 'btn btn-sm btn-danger';
      btnDel.innerHTML = '🗑️';
      btnDel.title = 'Eliminar acción';
      btnDel.addEventListener('click', () => {
        this.config.gitActions.splice(index, 1);
        this.renderGitActionsConfig();
      });

      btnsBox.appendChild(btnEdit);
      btnsBox.appendChild(btnDel);

      row.appendChild(chk);
      row.appendChild(inputLabel);
      row.appendChild(inputCmd);
      row.appendChild(btnsBox);

      this.gitActionsListEl.appendChild(row);
    });
  }

  openCreateGitActionModal() {
    this.editGitModalIcon.textContent = '➕';
    this.editGitModalTitle.textContent = 'Nueva Acción Git';
    this.editGitActionIdInput.value = '';
    this.editGitActionLabelInput.value = '';
    this.editGitActionCmdInput.value = 'git ';
    this.editGitActionCmdInput.readOnly = false;
    this.modalEditGitAction.classList.remove('hidden');
    this.editGitActionLabelInput.focus();
  }

  openEditSingleGitActionModal(act) {
    this.editGitModalIcon.textContent = '✏️';
    this.editGitModalTitle.textContent = `Editar Acción: ${act.label}`;
    this.editGitActionIdInput.value = act.id;
    this.editGitActionLabelInput.value = act.label;
    this.editGitActionCmdInput.value = act.cmd || '';

    if (act.action === 'user-git') {
      this.editGitActionCmdInput.readOnly = true;
      this.editGitActionCmdInput.value = '(Abre ventana de usuario Git)';
    } else {
      this.editGitActionCmdInput.readOnly = false;
    }

    this.modalEditGitAction.classList.remove('hidden');
    this.editGitActionLabelInput.focus();
  }

  async resetDefaultGitActions() {
    const defaults = [
      { id: 'act-status', label: 'Status', cmd: 'git status', enabled: true },
      { id: 'act-add', label: 'Add', cmd: 'git add -A', enabled: true },
      { id: 'act-unstage', label: 'Unstage', cmd: 'git reset', enabled: true },
      { id: 'act-commit', label: 'Commit', cmd: 'git commit -m "{prompt:Mensaje de commit}"', enabled: true },
      { id: 'push', label: 'Push', cmd: 'git push', enabled: true },
      { id: 'pull', label: 'Pull', cmd: 'git pull', enabled: true },
      { id: 'fetch', label: 'Fetch', cmd: 'git fetch', enabled: true },
      { id: 'diff', label: 'Diff', cmd: 'git diff', enabled: true },
      { id: 'log', label: 'Log', cmd: 'git log --oneline -n 10', enabled: true }
    ];
    this.config.gitActions = defaults;
    await window.api.saveConfig(this.config);
    this.renderGitActionsConfig();
    this.refreshAllGitToolbars();
  }

  async saveGitActionsConfig() {
    const rows = this.gitActionsListEl.querySelectorAll('.git-action-config-row');
    const updated = [];

    rows.forEach((row, i) => {
      const orig = this.config.gitActions[i] || {};
      const chk = row.querySelector('.git-action-enable');
      const inputLabel = row.querySelector('.git-action-input-label');
      const inputCmd = row.querySelector('.git-action-input-cmd');

      updated.push({
        id: orig.id || 'act_' + i,
        label: inputLabel.value.trim() || 'Acción',
        cmd: orig.action === 'user-git' ? undefined : inputCmd.value.trim(),
        action: orig.action || undefined,
        enabled: chk.checked
      });
    });

    this.config.gitActions = updated;
    await window.api.saveConfig(this.config);
    this.refreshAllGitToolbars();
    this.modalSettings.classList.add('hidden');
  }

  refreshAllGitToolbars() {
    for (const termId of this.terminals.keys()) {
      const gitActionsEl = document.getElementById(`git-actions-${termId}`);
      if (gitActionsEl) {
        this.renderTerminalGitActions(gitActionsEl, termId);
      }
    }
  }

  // ================= TABS MANAGEMENT =================
  createTab(title = 'Pestaña', layoutTree = null) {
    const tabId = 'tab_' + Math.random().toString(36).substring(2, 9);
    
    const initialTree = layoutTree || {
      id: 'term_' + Math.random().toString(36).substring(2, 9),
      type: 'terminal',
      title: 'Terminal 1'
    };

    const tab = {
      id: tabId,
      title: title,
      tree: initialTree
    };

    this.tabs.push(tab);

    const tabView = document.createElement('div');
    tabView.id = `view-${tabId}`;
    tabView.className = 'tab-view';
    this.workspaceEl.appendChild(tabView);

    this.renderTabsNav();
    this.switchTab(tabId);
    this.renderTabWorkspace(tabId);
    this.setActiveTerminal(newTermId);

    return tab;
  }

  switchTab(tabId) {
    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab) return;

    this.activeTabId = tabId;

    document.querySelectorAll('.tab-item').forEach((el) => {
      el.classList.toggle('active', el.getAttribute('data-tab-id') === tabId);
    });

    document.querySelectorAll('.tab-view').forEach((el) => {
      el.classList.toggle('active', el.id === `view-${tabId}`);
    });

    const leaves = this.getLeafTerminals(tab.tree);
    const targetTerm = leaves.find((l) => l.id === this.activeTerminalId) || leaves[0];
    if (targetTerm) {
      this.setActiveTerminal(targetTerm.id);
    }

    this.updateStatusBar();
    this.fitAllTerminals();
    setTimeout(() => this.updateAllGitOverflow(), 50);
  }

  closeTab(tabId) {
    if (this.tabs.length <= 1) {
      alert('No puedes cerrar la última pestaña abierta.');
      return;
    }

    const tabIndex = this.tabs.findIndex((t) => t.id === tabId);
    if (tabIndex === -1) return;

    const tab = this.tabs[tabIndex];
    this.destroySubtreeTerminals(tab.tree);

    const viewEl = document.getElementById(`view-${tabId}`);
    if (viewEl) viewEl.remove();

    this.tabs.splice(tabIndex, 1);

    const nextTab = this.tabs[Math.max(0, tabIndex - 1)];
    this.renderTabsNav();
    this.switchTab(nextTab.id);
  }

  isTabInSsh(tabId) {
    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab) return false;
    const leaves = this.getLeafTerminals(tab.tree);
    return leaves.some((leaf) => {
      const inst = this.terminals.get(leaf.id);
      return Boolean(inst && inst.sshSession);
    });
  }

  renderTabsNav() {
    this.tabsListEl.innerHTML = '';
    this.tabs.forEach((tab) => {
      const inSsh = this.isTabInSsh(tab.id);
      const tabEl = document.createElement('div');
      tabEl.className = `tab-item ${tab.id === this.activeTabId ? 'active' : ''} ${inSsh ? 'tab-ssh' : ''}`;
      tabEl.setAttribute('data-tab-id', tab.id);

      const titleEl = document.createElement('span');
      titleEl.className = 'tab-title';
      titleEl.textContent = (inSsh ? '🔑 ' : '') + tab.title;

      titleEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const newName = prompt('Renombrar pestaña:', tab.title);
        if (newName && newName.trim()) {
          tab.title = newName.trim();
          titleEl.textContent = (this.isTabInSsh(tab.id) ? '🔑 ' : '') + tab.title;
          this.updateStatusBar();
        }
      });

      const closeBtn = document.createElement('button');
      closeBtn.className = 'tab-close-btn';
      closeBtn.innerHTML = '&times;';
      closeBtn.title = 'Cerrar pestaña';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeTab(tab.id);
      });

      tabEl.appendChild(titleEl);
      tabEl.appendChild(closeBtn);

      tabEl.addEventListener('click', () => {
        this.switchTab(tab.id);
      });

      this.tabsListEl.appendChild(tabEl);
    });
  }

  // ================= WORKSPACE SPLITS & TREE =================
  renderTabWorkspace(tabId) {
    const tab = this.tabs.find((t) => t.id === tabId);
    const viewEl = document.getElementById(`view-${tabId}`);
    if (!tab || !viewEl) return;

    viewEl.innerHTML = '';
    const domNode = this.buildSplitDom(tab.tree, tabId);
    viewEl.appendChild(domNode);

    this.initUnmountedTerminals(tab.tree);
    this.fitAllTerminals();
  }

  buildSplitDom(node, tabId) {
    if (node.type === 'terminal') {
      return this.createTerminalPaneDom(node, tabId);
    }

    const container = document.createElement('div');
    container.className = `split-box ${node.orientation}`;
    container.setAttribute('data-node-id', node.id);

    const firstWrapper = document.createElement('div');
    firstWrapper.className = 'split-child first-child';
    const firstRatio = (node.ratio || 0.5) * 100;
    firstWrapper.style.flex = `0 0 calc(${firstRatio}% - 2px)`;
    firstWrapper.appendChild(this.buildSplitDom(node.first, tabId));

    const splitter = document.createElement('div');
    splitter.className = 'splitter';
    this.bindSplitterDrag(splitter, node, firstWrapper, container);

    const secondWrapper = document.createElement('div');
    secondWrapper.className = 'split-child second-child';
    secondWrapper.style.flex = '1 1 0%';
    secondWrapper.appendChild(this.buildSplitDom(node.second, tabId));

    container.appendChild(firstWrapper);
    container.appendChild(splitter);
    container.appendChild(secondWrapper);

    return container;
  }

  bindSplitterDrag(splitterEl, splitNode, firstWrapper, containerEl) {
    let isDragging = false;

    const onPointerDown = () => {
      isDragging = true;
      splitterEl.classList.add('dragging');
      document.body.style.cursor = splitNode.orientation === 'vertical' ? 'col-resize' : 'row-resize';
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    };

    const onPointerMove = (e) => {
      if (!isDragging) return;
      const rect = containerEl.getBoundingClientRect();
      let ratio;

      if (splitNode.orientation === 'vertical') {
        const offset = e.clientX - rect.left;
        ratio = offset / rect.width;
      } else {
        const offset = e.clientY - rect.top;
        ratio = offset / rect.height;
      }

      ratio = Math.max(0.1, Math.min(0.9, ratio));
      splitNode.ratio = ratio;
      firstWrapper.style.flex = `0 0 calc(${ratio * 100}% - 2px)`;

      this.fitAllTerminals();
    };

    const onPointerUp = () => {
      if (isDragging) {
        isDragging = false;
        splitterEl.classList.remove('dragging');
        document.body.style.cursor = 'default';
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        this.fitAllTerminals();
      }
    };

    splitterEl.addEventListener('pointerdown', onPointerDown);
  }

  // ================= TERMINAL TOOLBAR =================
  createTerminalPaneDom(node, tabId) {
    const pane = document.createElement('div');
    pane.className = `terminal-pane ${this.activeTerminalId === node.id ? 'active-pane' : ''}`;
    pane.id = `pane-${node.id}`;
    pane.setAttribute('data-term-id', node.id);

    const header = document.createElement('div');
    header.className = 'terminal-header';
    header.id = `header-${node.id}`;

    const leftGroup = document.createElement('div');
    leftGroup.className = 'tb-left-group';

    // 1. "Terminal" label
    const termLabel = document.createElement('span');
    termLabel.className = 'tb-label';
    termLabel.id = `tb-label-${node.id}`;
    termLabel.textContent = 'Terminal';

    // 2. Shell dropdown select
    const shellSelect = document.createElement('select');
    shellSelect.className = 'tb-shell-select';
    shellSelect.id = `shell-select-${node.id}`;
    this.populateShellSelect(shellSelect, node.id);

    shellSelect.addEventListener('change', async (e) => {
      const chosenPath = e.target.value;
      await this.handleSwitchShell(node.id, chosenPath);
    });

    // 2.5 SSH Active Badge (Shown when connected to an SSH profile)
    const sshBadge = document.createElement('div');
    sshBadge.className = 'tb-ssh-badge hidden';
    sshBadge.id = `ssh-badge-${node.id}`;
    sshBadge.innerHTML = `
      <span class="ssh-key-icon">🔑</span>
      <span class="ssh-badge-name" id="ssh-badge-name-${node.id}"></span>
      <span class="ssh-badge-host" id="ssh-badge-host-${node.id}"></span>
      <button type="button" class="ssh-toggle-git-btn" id="ssh-toggle-git-${node.id}" title="Mostrar u ocultar botones de Git en el servidor remoto">🌿 Git</button>
      <button type="button" class="ssh-disconnect-btn" id="ssh-disconnect-${node.id}" title="Desconectar y volver a local">✕ Salir</button>
    `;

    sshBadge.querySelector('.ssh-toggle-git-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleSshGitActions(node.id);
    });

    sshBadge.querySelector('.ssh-disconnect-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.disconnectSshSession(node.id);
    });

    // 3. Git Branch Button & Dropdown wrapper
    const gitBranchWrapper = document.createElement('div');
    gitBranchWrapper.className = 'tb-git-branch-wrapper';
    gitBranchWrapper.id = `git-branch-wrapper-${node.id}`;

    const gitBranchBtn = document.createElement('button');
    gitBranchBtn.className = 'tb-git-branch-btn';
    gitBranchBtn.id = `git-branch-btn-${node.id}`;
    gitBranchBtn.innerHTML = '🌿 <span class="branch-name">...</span> ▾';
    gitBranchBtn.title = 'Cambiar de rama Git o crear nueva';

    const gitDropdown = document.createElement('div');
    gitDropdown.className = 'tb-git-dropdown';
    gitDropdown.id = `git-dropdown-${node.id}`;

    gitBranchBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.tb-git-dropdown.show').forEach((m) => {
        if (m !== gitDropdown) m.classList.remove('show');
      });
      this.populateGitBranchesDropdown(gitDropdown, node.id);
      gitDropdown.classList.toggle('show');
    });

    gitBranchWrapper.appendChild(gitBranchBtn);
    gitBranchWrapper.appendChild(gitDropdown);

    // 4. Git User Button
    const gitUserBtn = document.createElement('button');
    gitUserBtn.className = 'tb-git-user-btn';
    gitUserBtn.id = `git-user-btn-${node.id}`;
    gitUserBtn.innerHTML = '👤 <span class="user-name">Git</span>';
    gitUserBtn.title = 'Configurar usuario Git (user.name / user.email)';
    gitUserBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openGitUserModal(node.id);
    });

    // 5. Configurable Git Action Buttons
    const gitActions = document.createElement('div');
    gitActions.className = 'tb-git-actions';
    gitActions.id = `git-actions-${node.id}`;
    this.renderTerminalGitActions(gitActions, node.id);

    // 5.5 Overflow Button & Dropdown Menu
    const gitOverflowWrapper = document.createElement('div');
    gitOverflowWrapper.className = 'tb-git-overflow-wrapper hidden';
    gitOverflowWrapper.id = `git-overflow-wrapper-${node.id}`;

    const btnOverflow = document.createElement('button');
    btnOverflow.type = 'button';
    btnOverflow.className = 'tb-git-overflow-btn';
    btnOverflow.id = `git-overflow-btn-${node.id}`;
    btnOverflow.innerHTML = '&raquo;';
    btnOverflow.title = 'Más acciones Git';

    const overflowMenu = document.createElement('div');
    overflowMenu.className = 'tb-git-overflow-menu';
    overflowMenu.id = `git-overflow-menu-${node.id}`;

    btnOverflow.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.tb-git-overflow-menu.show').forEach((m) => {
        if (m !== overflowMenu) m.classList.remove('show');
      });
      overflowMenu.classList.toggle('show');
    });

    gitOverflowWrapper.appendChild(btnOverflow);
    gitOverflowWrapper.appendChild(overflowMenu);

    // Fallback badge if folder is not git
    const nonGitBadge = document.createElement('span');
    nonGitBadge.className = 'tb-non-git-badge hidden';
    nonGitBadge.id = `non-git-${node.id}`;
    nonGitBadge.textContent = '(No es repo Git)';

    leftGroup.appendChild(termLabel);
    leftGroup.appendChild(shellSelect);
    leftGroup.appendChild(sshBadge);
    leftGroup.appendChild(gitBranchWrapper);
    leftGroup.appendChild(gitUserBtn);
    leftGroup.appendChild(gitActions);
    leftGroup.appendChild(gitOverflowWrapper);
    leftGroup.appendChild(nonGitBadge);

    // Right toolbar tools (Splits, SSH, Close)
    const rightGroup = document.createElement('div');
    rightGroup.className = 'tb-right-group';

    // Split V
    const btnSplitV = document.createElement('button');
    btnSplitV.className = 'term-tool-btn';
    btnSplitV.innerHTML = '<svg class="split-icon" width="13" height="13" viewBox="0 0 16 16"><rect x="2" y="1" width="4.5" height="14" rx="1"/><rect x="9.5" y="1" width="4.5" height="14" rx="1"/></svg>';
    btnSplitV.title = 'Dividir Verticalmente (Ctrl+Shift+E)';
    btnSplitV.addEventListener('click', (e) => {
      e.stopPropagation();
      this.splitTerminal(node.id, 'vertical');
    });

    // Split H
    const btnSplitH = document.createElement('button');
    btnSplitH.className = 'term-tool-btn';
    btnSplitH.innerHTML = '<svg class="split-icon" width="13" height="13" viewBox="0 0 16 16"><rect x="1" y="2" width="14" height="4.5" rx="1"/><rect x="1" y="9.5" width="14" height="4.5" rx="1"/></svg>';
    btnSplitH.title = 'Dividir Horizontalmente (Ctrl+Shift+O)';
    btnSplitH.addEventListener('click', (e) => {
      e.stopPropagation();
      this.splitTerminal(node.id, 'horizontal');
    });

    // SSH Dropdown
    const sshWrapper = document.createElement('div');
    sshWrapper.className = 'ssh-select-wrapper';

    const btnSsh = document.createElement('button');
    btnSsh.className = 'ssh-select-btn';
    btnSsh.innerHTML = '🔑 SSH ▾';
    btnSsh.title = 'Cargar Perfil SSH en esta terminal';

    const sshDropdown = document.createElement('div');
    sshDropdown.className = 'ssh-dropdown-menu';

    btnSsh.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.ssh-dropdown-menu.show').forEach((m) => {
        if (m !== sshDropdown) m.classList.remove('show');
      });
      this.populateSshDropdown(sshDropdown, node.id);
      sshDropdown.classList.toggle('show');
    });

    sshWrapper.appendChild(btnSsh);
    sshWrapper.appendChild(sshDropdown);

    // Close terminal
    const btnClose = document.createElement('button');
    btnClose.className = 'term-tool-btn danger';
    btnClose.innerHTML = '✕';
    btnClose.title = 'Cerrar esta terminal (Ctrl+Shift+W)';
    btnClose.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeTerminal(node.id);
    });

    rightGroup.appendChild(btnSplitV);
    rightGroup.appendChild(btnSplitH);
    rightGroup.appendChild(sshWrapper);
    rightGroup.appendChild(btnClose);

    header.appendChild(leftGroup);
    header.appendChild(rightGroup);

    const body = document.createElement('div');
    body.className = 'terminal-body';
    body.id = `body-${node.id}`;

    pane.appendChild(header);
    pane.appendChild(body);

    pane.addEventListener('pointerdown', () => {
      this.setActiveTerminal(node.id);
    });

    pane.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.tb-git-action-btn')) return;
      e.preventDefault();
      this.showContextMenu(e.clientX, e.clientY, node.id);
    });

    setTimeout(() => {
      this.updateToolbarSshStatus(node.id);
      this.updateGitButtonsOverflow(node.id);
    }, 0);

    const resizeObs = new ResizeObserver(() => {
      this.updateGitButtonsOverflow(node.id);
    });
    resizeObs.observe(header);

    return pane;
  }

  renderTerminalGitActions(containerEl, termId) {
    containerEl.innerHTML = '';
    const actions = (this.config && this.config.gitActions) || [];

    actions.forEach((act) => {
      if (act.enabled === false) return;

      const btn = document.createElement('button');
      btn.className = 'tb-git-action-btn';
      btn.textContent = act.label;
      btn.title = `${act.cmd || act.label} (Click derecho: Editar comando)`;

      // Left Click: Execute command
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setActiveTerminal(termId);

        if (act.action === 'user-git') {
          this.openGitUserModal(termId);
          return;
        }

        if (act.cmd) {
          let command = act.cmd;
          const promptMatch = command.match(/\{prompt(?::([^}]+))?\}/);
          if (promptMatch) {
            const promptMsg = promptMatch[1] || 'Ingresa el valor:';
            const userVal = prompt(promptMsg);
            if (userVal === null) return;
            command = command.replace(promptMatch[0], userVal.replace(/"/g, '\\"'));
          }

          window.api.writeTerminal(termId, `${command}\r`);
          setTimeout(() => this.refreshGitInfo(termId), 500);
        }
      });

      // Right Click: Edit this button's command directly!
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openEditSingleGitActionModal(act);
      });

      btn._gitActionData = act;
      containerEl.appendChild(btn);
    });

    setTimeout(() => {
      this.updateGitButtonsOverflow(termId);
    }, 20);
  }

  populateShellSelect(selectEl, termId) {
    selectEl.innerHTML = '';
    const inst = this.terminals.get(termId);
    const activeShellPath = inst ? inst.shellPath : (this.config?.defaultShell || this.availableShells[0]?.path || '');

    this.availableShells.forEach((sh) => {
      const opt = document.createElement('option');
      opt.value = sh.path;
      opt.textContent = sh.name;
      if (sh.path === activeShellPath) {
        opt.selected = true;
      }
      selectEl.appendChild(opt);
    });
  }

  async handleSwitchShell(termId, newShellPath) {
    const inst = this.terminals.get(termId);
    if (!inst) return;

    this.setActiveTerminal(termId);
    inst.shellPath = newShellPath;
    inst.sshSession = null;
    this.updateToolbarSshStatus(termId);

    if (inst.term) {
      inst.term.clear();
      inst.term.write(`\r\n\x1b[36mCambiando shell a: ${newShellPath}...\x1b[0m\r\n\r\n`);
    }

    try {
      await window.api.switchTerminalShell(termId, newShellPath, inst.term?.cols || 80, inst.term?.rows || 24);
      setTimeout(() => {
        this.refreshGitInfo(termId);
        if (inst.term) inst.term.focus();
      }, 150);
    } catch (e) {
      console.error('Error switching shell:', e);
    }
  }

  // ================= SSH & GIT TOOLBAR STATUS =================
  toggleSshGitActions(termId) {
    const inst = this.terminals.get(termId);
    if (!inst) return;
    inst.sshShowGit = !inst.sshShowGit;
    this.updateToolbarSshStatus(termId);
  }

  updateToolbarSshStatus(termId) {
    const inst = this.terminals.get(termId);
    const sshBadge = document.getElementById(`ssh-badge-${termId}`);
    const termLabel = document.getElementById(`tb-label-${termId}`);
    const shellSelect = document.getElementById(`shell-select-${termId}`);
    const branchWrapper = document.getElementById(`git-branch-wrapper-${termId}`);
    const userBtn = document.getElementById(`git-user-btn-${termId}`);
    const gitActions = document.getElementById(`git-actions-${termId}`);
    const nonGitBadge = document.getElementById(`non-git-${termId}`);
    const toggleGitBtn = document.getElementById(`ssh-toggle-git-${termId}`);
    const headerEl = document.getElementById(`header-${termId}`);

    if (!sshBadge) return;

    if (inst && inst.sshSession) {
      const sess = inst.sshSession;
      const nameEl = document.getElementById(`ssh-badge-name-${termId}`);
      const hostEl = document.getElementById(`ssh-badge-host-${termId}`);
      if (nameEl) nameEl.textContent = sess.name;
      const portStr = (sess.port && Number(sess.port) !== 22) ? `:${sess.port}` : '';
      if (hostEl) hostEl.textContent = `(${sess.username}@${sess.host}${portStr})`;

      sshBadge.classList.remove('hidden');
      if (headerEl) headerEl.classList.add('header-ssh');

      // Hide local shell select and label while in remote SSH
      if (termLabel) termLabel.classList.add('hidden');
      if (shellSelect) shellSelect.classList.add('hidden');

      // In remote SSH, hide local git branch and user config
      if (branchWrapper) branchWrapper.classList.add('hidden');
      if (userBtn) userBtn.classList.add('hidden');
      if (nonGitBadge) nonGitBadge.classList.add('hidden');

      // Toggleable Git actions buttons
      if (gitActions) {
        if (inst.sshShowGit) {
          gitActions.classList.remove('hidden');
        } else {
          gitActions.classList.add('hidden');
        }
      }

      if (toggleGitBtn) {
        toggleGitBtn.classList.toggle('active', Boolean(inst.sshShowGit));
        toggleGitBtn.textContent = inst.sshShowGit ? '🌿 Git ✓' : '🌿 Git';
        toggleGitBtn.title = inst.sshShowGit ? 'Ocultar botones de Git' : 'Mostrar botones de acciones Git en el servidor remoto';
      }
    } else {
      sshBadge.classList.add('hidden');
      if (headerEl) headerEl.classList.remove('header-ssh');

      // Restore local shell select and label
      if (termLabel) termLabel.classList.remove('hidden');
      if (shellSelect) shellSelect.classList.remove('hidden');

      this.refreshGitInfo(termId);
    }

    setTimeout(() => this.updateGitButtonsOverflow(termId), 20);
    this.renderTabsNav();
    this.updateStatusBar();
  }

  disconnectSshSession(termId) {
    window.api.writeTerminal(termId, 'exit\r');
    const inst = this.terminals.get(termId);
    if (inst) {
      inst.sshSession = null;
      inst.sshShowGit = false;
      inst.title = 'Terminal';
    }
    this.updateToolbarSshStatus(termId);
  }

  // ================= GIT INFORMATION & BRANCHES =================
  async refreshGitInfo(termId) {
    try {
      const inst = this.terminals.get(termId);
      if (inst && inst.sshSession) {
        this.updateToolbarSshStatus(termId);
        return;
      }

      const gitInfo = await window.api.getGitInfo(termId);
      if (inst) inst.gitInfo = gitInfo;

      const branchWrapper = document.getElementById(`git-branch-wrapper-${termId}`);
      const branchBtn = document.getElementById(`git-branch-btn-${termId}`);
      const userBtn = document.getElementById(`git-user-btn-${termId}`);
      const gitActions = document.getElementById(`git-actions-${termId}`);
      const nonGitBadge = document.getElementById(`non-git-${termId}`);

      if (!branchWrapper || !branchBtn) return;

      if (gitInfo && gitInfo.isRepo) {
        branchWrapper.classList.remove('hidden');
        userBtn.classList.remove('hidden');
        gitActions.classList.remove('hidden');
        if (nonGitBadge) nonGitBadge.classList.add('hidden');

        branchBtn.querySelector('.branch-name').textContent = gitInfo.branch;
        userBtn.querySelector('.user-name').textContent = gitInfo.userName || 'Git';
      } else {
        branchWrapper.classList.add('hidden');
        userBtn.classList.add('hidden');
        gitActions.classList.add('hidden');
        if (nonGitBadge) nonGitBadge.classList.remove('hidden');
      }

      setTimeout(() => this.updateGitButtonsOverflow(termId), 20);
    } catch (e) {}
  }

  updateAllGitInfo() {
    for (const termId of this.terminals.keys()) {
      this.refreshGitInfo(termId);
      this.updateGitButtonsOverflow(termId);
    }
  }

  // ================= GIT BUTTONS OVERFLOW MENU =================
  updateGitButtonsOverflow(termId) {
    const header = document.getElementById(`header-${termId}`);
    const gitActions = document.getElementById(`git-actions-${termId}`);
    const overflowWrapper = document.getElementById(`git-overflow-wrapper-${termId}`);
    const overflowMenu = document.getElementById(`git-overflow-menu-${termId}`);
    if (!header || !gitActions || !overflowWrapper || !overflowMenu) return;

    if (header.clientWidth === 0 || gitActions.classList.contains('hidden')) {
      overflowWrapper.classList.add('hidden');
      return;
    }

    const rightGroup = header.querySelector('.tb-right-group');
    if (!rightGroup) return;

    const actionButtons = Array.from(gitActions.querySelectorAll('.tb-git-action-btn'));
    if (actionButtons.length === 0) {
      overflowWrapper.classList.add('hidden');
      return;
    }

    // Unhide all buttons temporarily to measure available width
    actionButtons.forEach((btn) => (btn.style.display = ''));
    overflowWrapper.classList.remove('hidden');
    overflowMenu.innerHTML = '';

    const overflowBtn = overflowWrapper.querySelector('.tb-git-overflow-btn');
    const overflowBtnWidth = overflowBtn ? overflowBtn.offsetWidth + 8 : 32;

    const rightBoundary = rightGroup.getBoundingClientRect().left - 8;

    let overflowStartIndex = -1;

    for (let i = 0; i < actionButtons.length; i++) {
      const btn = actionButtons[i];
      const rect = btn.getBoundingClientRect();
      if (rect.right > rightBoundary - overflowBtnWidth) {
        overflowStartIndex = i;
        break;
      }
    }

    if (overflowStartIndex !== -1) {
      for (let i = overflowStartIndex; i < actionButtons.length; i++) {
        const btn = actionButtons[i];
        btn.style.display = 'none';

        const actData = btn._gitActionData;
        const item = document.createElement('div');
        item.className = 'tb-git-overflow-item';
        item.textContent = btn.textContent;
        item.title = btn.title;

        item.addEventListener('click', (e) => {
          e.stopPropagation();
          overflowMenu.classList.remove('show');
          btn.click();
        });

        item.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          overflowMenu.classList.remove('show');
          if (actData) {
            this.openEditSingleGitActionModal(actData);
          }
        });

        overflowMenu.appendChild(item);
      }
      overflowWrapper.classList.remove('hidden');
    } else {
      overflowWrapper.classList.add('hidden');
    }
  }

  updateAllGitOverflow() {
    for (const termId of this.terminals.keys()) {
      this.updateGitButtonsOverflow(termId);
    }
  }

  populateGitBranchesDropdown(dropdownEl, termId) {
    dropdownEl.innerHTML = '';
    const inst = this.terminals.get(termId);
    const gitInfo = inst?.gitInfo;

    if (!gitInfo || !gitInfo.isRepo) {
      const empty = document.createElement('div');
      empty.className = 'tb-git-dropdown-item';
      empty.textContent = 'No es un repositorio Git';
      dropdownEl.appendChild(empty);
      return;
    }

    (gitInfo.branches || [gitInfo.branch]).forEach((bName) => {
      const item = document.createElement('div');
      item.className = `tb-git-dropdown-item ${bName === gitInfo.branch ? 'active' : ''}`;
      item.textContent = bName;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownEl.classList.remove('show');
        if (bName !== gitInfo.branch) {
          window.api.writeTerminal(termId, `git checkout ${bName}\r`);
          setTimeout(() => this.refreshGitInfo(termId), 500);
        }
      });
      dropdownEl.appendChild(item);
    });

    const newBranchItem = document.createElement('div');
    newBranchItem.className = 'tb-git-dropdown-item new-branch';
    newBranchItem.innerHTML = '➕ Nueva rama...';
    newBranchItem.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownEl.classList.remove('show');
      const branchName = prompt('Nombre de la nueva rama:');
      if (branchName && branchName.trim()) {
        window.api.writeTerminal(termId, `git checkout -b ${branchName.trim()}\r`);
        setTimeout(() => this.refreshGitInfo(termId), 500);
      }
    });
    dropdownEl.appendChild(newBranchItem);
  }

  openGitUserModal(termId) {
    this.gitTargetTermId = termId;
    const inst = this.terminals.get(termId);
    const gitInfo = inst?.gitInfo;

    document.getElementById('git-user-name').value = gitInfo?.userName || '';
    document.getElementById('git-user-email').value = gitInfo?.userEmail || '';
    this.modalGitUser.classList.remove('hidden');
  }

  // ================= TERMINAL MOUNTING =================
  initUnmountedTerminals(node) {
    if (node.type === 'terminal') {
      if (!this.terminals.has(node.id)) {
        this.mountTerminal(node);
      } else {
        const existing = this.terminals.get(node.id);
        const bodyEl = document.getElementById(`body-${node.id}`);
        if (bodyEl && !bodyEl.contains(existing.term.element)) {
          bodyEl.appendChild(existing.term.element);
        }
      }
      return;
    }
    this.initUnmountedTerminals(node.first);
    this.initUnmountedTerminals(node.second);
  }

  async mountTerminal(node) {
    const bodyEl = document.getElementById(`body-${node.id}`);
    if (!bodyEl) return;

    const TerminalClass = getTerminalClass();
    const FitAddonClass = getFitAddonClass();
    const WebLinksAddonClass = getWebLinksAddonClass();

    if (!TerminalClass) {
      console.error('Terminal constructor not found!');
      return;
    }

    const termTheme = this.getXtermTheme(this.config?.theme || 'dark');
    const term = new TerminalClass({
      theme: termTheme,
      fontFamily: this.config?.fontFamily || 'Consolas, "Fira Code", monospace',
      fontSize: this.config?.fontSize || 13,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: this.config?.scrollback || 5000,
      allowTransparency: true
    });

    const fitAddon = FitAddonClass ? new FitAddonClass() : null;
    const webLinksAddon = WebLinksAddonClass ? new WebLinksAddonClass() : null;

    if (fitAddon) term.loadAddon(fitAddon);
    if (webLinksAddon) term.loadAddon(webLinksAddon);

    term.open(bodyEl);
    if (fitAddon) fitAddon.fit();

    const cols = term.cols || 80;
    const rows = term.rows || 24;
    const chosenShell = node.shellPath || this.config?.defaultShell || null;

    try {
      const ptyResult = await window.api.createTerminal({
        id: node.id,
        cols,
        rows,
        shellPath: chosenShell,
        initialCommand: node.initialCommand || null
      });

      term.onData((data) => {
        window.api.writeTerminal(node.id, data);
        if (data.includes('\r')) {
          setTimeout(() => this.refreshGitInfo(node.id), 400);
        }
      });

      const unsubData = window.api.onTerminalData(node.id, (data) => {
        term.write(data);
        const curInst = this.terminals.get(node.id);
        if (curInst && curInst.sshSession) {
          if (/(Connection to [^\r\n]+ closed|Cerrada la conexi[oó]n a|Connection closed by|logout\r?\n|Killed by signal)/i.test(data)) {
            curInst.sshSession = null;
            curInst.sshShowGit = false;
            curInst.title = 'Terminal';
            this.updateToolbarSshStatus(node.id);
          }
        }
      });

      const unsubExit = window.api.onTerminalExit(node.id, ({ exitCode }) => {
        term.write(`\r\n\x1b[33m[Proceso finalizado con código ${exitCode}]\x1b[0m\r\n`);
      });

      const termInfo = {
        term,
        fitAddon,
        ptyId: node.id,
        shellPath: ptyResult.shellPath,
        unsubData,
        unsubExit,
        title: node.title || 'Terminal',
        gitInfo: null,
        sshSession: null,
        sshShowGit: false,
        sshPwdListener: null
      };

      this.terminals.set(node.id, termInfo);

      const shellSelect = document.getElementById(`shell-select-${node.id}`);
      if (shellSelect) {
        shellSelect.value = ptyResult.shellPath;
      }

      if (!this.activeTerminalId || this.activeTerminalId === node.id) {
        this.setActiveTerminal(node.id);
      }

      setTimeout(() => {
        if (fitAddon) fitAddon.fit();
        this.refreshGitInfo(node.id);
        if (this.activeTerminalId === node.id) {
          term.focus();
        }
      }, 80);
    } catch (err) {
      console.error('Failed to create terminal backend:', err);
      term.write(`\r\n\x1b[31mError al iniciar la consola: ${err.message}\x1b[0m\r\n`);
    }
  }

  setActiveTerminal(termId) {
    this.activeTerminalId = termId;

    document.querySelectorAll('.terminal-pane').forEach((p) => {
      p.classList.toggle('active-pane', p.getAttribute('data-term-id') === termId);
    });

    const termObj = this.terminals.get(termId);
    if (termObj && termObj.term) {
      termObj.term.focus();
      setTimeout(() => {
        if (this.activeTerminalId === termId && termObj.term) {
          termObj.term.focus();
        }
      }, 60);
    }

    this.updateStatusBar();
  }

  fitAllTerminals() {
    for (const [id, t] of this.terminals.entries()) {
      if (t.fitAddon && t.term && t.term.element) {
        try {
          t.fitAddon.fit();
          if (t.term.cols > 0 && t.term.rows > 0) {
            window.api.resizeTerminal(id, t.term.cols, t.term.rows);
          }
        } catch (e) {}
      }
    }
  }

  // ================= SPLIT ACTIONS =================
  splitTerminal(targetTermId, orientation) {
    const tab = this.tabs.find((t) => t.id === this.activeTabId);
    if (!tab) return;

    const newTermId = 'term_' + Math.random().toString(36).substring(2, 9);
    const newTermNode = {
      id: newTermId,
      type: 'terminal',
      title: `Terminal ${this.terminals.size + 1}`
    };

    const replaceInTree = (node) => {
      if (node.id === targetTermId) {
        return {
          id: 'split_' + Math.random().toString(36).substring(2, 9),
          type: 'split',
          orientation: orientation,
          ratio: 0.5,
          first: node,
          second: newTermNode
        };
      }
      if (node.type === 'split') {
        node.first = replaceInTree(node.first);
        node.second = replaceInTree(node.second);
      }
      return node;
    };

    tab.tree = replaceInTree(tab.tree);
    this.activeTerminalId = newTermId;
    this.renderTabWorkspace(this.activeTabId);
    this.setActiveTerminal(newTermId);
  }

  closeTerminal(termId) {
    const tab = this.tabs.find((t) => t.id === this.activeTabId);
    if (!tab) return;

    if (tab.tree.id === termId && tab.tree.type === 'terminal') {
      if (this.tabs.length > 1) {
        this.closeTab(tab.id);
      } else {
        this.destroyTerminalInstance(termId);
        const newId = 'term_' + Math.random().toString(36).substring(2, 9);
        tab.tree = { id: newId, type: 'terminal', title: 'Terminal 1' };
        this.renderTabWorkspace(tab.id);
        this.setActiveTerminal(newId);
      }
      return;
    }

    const removeFromTree = (node) => {
      if (node.type !== 'split') return node;

      if (node.first.id === termId) return node.second;
      if (node.second.id === termId) return node.first;

      node.first = removeFromTree(node.first);
      node.second = removeFromTree(node.second);
      return node;
    };

    this.destroyTerminalInstance(termId);
    tab.tree = removeFromTree(tab.tree);

    const remainingTerms = this.getLeafTerminals(tab.tree);
    if (remainingTerms.length > 0) {
      this.activeTerminalId = remainingTerms[0].id;
    }

    this.renderTabWorkspace(this.activeTabId);
    if (this.activeTerminalId) {
      this.setActiveTerminal(this.activeTerminalId);
    }
  }

  getLeafTerminals(node) {
    if (node.type === 'terminal') return [node];
    return [...this.getLeafTerminals(node.first), ...this.getLeafTerminals(node.second)];
  }

  destroyTerminalInstance(termId) {
    const inst = this.terminals.get(termId);
    if (inst) {
      if (inst.unsubData) inst.unsubData();
      if (inst.unsubExit) inst.unsubExit();
      if (inst.sshPwdListener) inst.sshPwdListener();
      window.api.killTerminal(termId);
      if (inst.term) inst.term.dispose();
      this.terminals.delete(termId);
    }
  }

  destroySubtreeTerminals(node) {
    if (node.type === 'terminal') {
      this.destroyTerminalInstance(node.id);
      return;
    }
    this.destroySubtreeTerminals(node.first);
    this.destroySubtreeTerminals(node.second);
  }

  // ================= CONTEXT MENU =================
  showContextMenu(x, y, termId) {
    this.contextTargetTermId = termId;
    this.setActiveTerminal(termId);
    this.populateSshDropdown(this.ctxSshSubmenu, termId);

    this.contextMenu.style.left = `${Math.min(window.innerWidth - 220, x)}px`;
    this.contextMenu.style.top = `${Math.min(window.innerHeight - 250, y)}px`;
    this.contextMenu.classList.remove('hidden');
  }

  hideContextMenu() {
    this.contextMenu.classList.add('hidden');
    this.contextTargetTermId = null;
  }

  copyTerminalSelection(termId) {
    const inst = this.terminals.get(termId);
    if (inst && inst.term) {
      const selection = inst.term.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection);
      }
    }
  }

  async pasteToTerminal(termId) {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        window.api.writeTerminal(termId, text);
      }
    } catch (err) {
      console.error('Clipboard paste failed:', err);
    }
  }

  clearTerminal(termId) {
    window.api.writeTerminal(termId, 'clear\r');
  }

  // ================= SSH PROFILES & PASSWORD AUTO-INJECTION =================
  setupSshPasswordAutoInjector(termId, secret) {
    const inst = this.terminals.get(termId);
    if (!inst) return;

    if (inst.sshPwdListener) {
      inst.sshPwdListener();
      inst.sshPwdListener = null;
    }

    let buffer = '';
    let answered = false;

    const timeoutId = setTimeout(() => {
      cleanup();
    }, 30000);

    const cleanup = () => {
      clearTimeout(timeoutId);
      if (inst.sshPwdListener) {
        inst.sshPwdListener();
        inst.sshPwdListener = null;
      }
    };

    const unsub = window.api.onTerminalData(termId, (data) => {
      buffer += data;
      const isPrompt = /(password|passphrase|contraseña|password for [^:]+):\s*$/i.test(buffer.trim());
      if (isPrompt && !answered) {
        answered = true;
        setTimeout(() => {
          window.api.writeTerminal(termId, `${secret}\r`);
          cleanup();
        }, 120);
      }
    });

    inst.sshPwdListener = () => {
      unsub();
    };
  }

  connectSshProfile(termId, profile) {
    let sshCmd = 'ssh';
    if (profile.port && Number(profile.port) !== 22) {
      sshCmd += ` -p ${profile.port}`;
    }
    if (profile.authType === 'key' && profile.keyPath) {
      sshCmd += ` -i "${profile.keyPath}"`;
    }
    if (profile.extraArgs) {
      sshCmd += ` ${profile.extraArgs}`;
    }
    sshCmd += ` ${profile.username}@${profile.host}`;

    const secretToSend = profile.authType === 'key' ? (profile.passphrase || '') : (profile.password || '');
    if (secretToSend) {
      this.setupSshPasswordAutoInjector(termId, secretToSend);
    }

    window.api.writeTerminal(termId, `${sshCmd}\r`);

    const inst = this.terminals.get(termId);
    if (inst) {
      inst.sshSession = profile;
      inst.sshShowGit = false;
      inst.title = `SSH: ${profile.name} (${profile.host})`;
    }
    this.updateToolbarSshStatus(termId);
    this.updateStatusBar();
  }

  populateSshDropdown(menuEl, targetTermId) {
    menuEl.innerHTML = '';
    if (this.profiles.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'ssh-dropdown-item';
      empty.textContent = 'Sin perfiles guardados';
      menuEl.appendChild(empty);
    } else {
      this.profiles.forEach((p) => {
        const item = document.createElement('div');
        item.className = 'ssh-dropdown-item';
        item.innerHTML = `<span>${p.name}</span> <small style="color:var(--text-dim)">${p.username}@${p.host}</small>`;
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          menuEl.classList.remove('show');
          this.handleSshProfileSelection(targetTermId, p);
        });
        menuEl.appendChild(item);
      });
    }

    const manageItem = document.createElement('div');
    manageItem.className = 'ssh-dropdown-item action';
    manageItem.innerHTML = '➕ Administrar perfiles...';
    manageItem.addEventListener('click', (e) => {
      e.stopPropagation();
      menuEl.classList.remove('show');
      this.openSshModal();
    });
    menuEl.appendChild(manageItem);
  }

  handleSshProfileSelection(termId, profile) {
    const inst = this.terminals.get(termId);
    if (!inst) return;

    if (inst.sshSession) {
      if (inst.sshSession.id === profile.id || (inst.sshSession.host === profile.host && inst.sshSession.username === profile.username)) {
        alert(`Esta terminal ya se encuentra conectada al perfil "${profile.name}" (${profile.host}).`);
        return;
      }
      this.openSshSwitchModal(termId, profile);
      return;
    }

    this.connectSshProfile(termId, profile);
  }

  openSshSwitchModal(termId, targetProfile) {
    this.sshSwitchTermId = termId;
    this.sshSwitchTargetProfile = targetProfile;

    const inst = this.terminals.get(termId);
    const currName = inst?.sshSession ? `${inst.sshSession.name} (${inst.sshSession.username}@${inst.sshSession.host})` : 'la sesión actual';

    document.getElementById('ssh-switch-current-name').textContent = currName;
    document.getElementById('ssh-switch-target-name').textContent = `${targetProfile.name} (${targetProfile.username}@${targetProfile.host})`;

    this.modalSshSwitch.classList.remove('hidden');
  }

  openSshModal() {
    this.renderSshProfilesList();
    this.clearSshForm();
    this.modalSsh.classList.remove('hidden');
  }

  renderSshProfilesList() {
    this.sshProfilesListEl.innerHTML = '';
    this.profiles.forEach((p) => {
      const card = document.createElement('div');
      card.className = 'profile-card';
      const hasPwd = Boolean(p.password || p.passphrase);
      card.innerHTML = `
        <div class="profile-card-name">${p.name} ${hasPwd ? '🔒' : ''}</div>
        <div class="profile-card-details">${p.username}@${p.host}:${p.port || 22}</div>
      `;
      card.addEventListener('click', () => {
        document.querySelectorAll('.profile-card').forEach((c) => c.classList.remove('active'));
        card.classList.add('active');
        this.fillSshForm(p);
      });
      this.sshProfilesListEl.appendChild(card);
    });
  }

  clearSshForm() {
    document.getElementById('ssh-form-title').textContent = 'Crear Nuevo Perfil SSH';
    document.getElementById('ssh-id').value = '';
    document.getElementById('ssh-name').value = '';
    document.getElementById('ssh-host').value = '';
    document.getElementById('ssh-port').value = '22';
    document.getElementById('ssh-username').value = '';
    document.getElementById('ssh-auth-type').value = 'password';
    document.getElementById('ssh-password').value = '';
    document.getElementById('ssh-password').type = 'password';
    document.getElementById('ssh-key-path').value = '';
    document.getElementById('ssh-passphrase').value = '';
    document.getElementById('ssh-passphrase').type = 'password';
    document.getElementById('ssh-extra-args').value = '';
    this.sshKeyGroup.style.display = 'none';
    this.sshPassphraseGroup.style.display = 'none';
    this.sshPasswordGroup.style.display = 'block';
    this.btnSshDelete.classList.add('hidden');
    document.querySelectorAll('.profile-card').forEach((c) => c.classList.remove('active'));
  }

  fillSshForm(p) {
    document.getElementById('ssh-form-title').textContent = 'Editar Perfil: ' + p.name;
    document.getElementById('ssh-id').value = p.id;
    document.getElementById('ssh-name').value = p.name;
    document.getElementById('ssh-host').value = p.host;
    document.getElementById('ssh-port').value = p.port || 22;
    document.getElementById('ssh-username').value = p.username;
    document.getElementById('ssh-auth-type').value = p.authType || 'password';
    document.getElementById('ssh-password').value = p.password || '';
    document.getElementById('ssh-key-path').value = p.keyPath || '';
    document.getElementById('ssh-passphrase').value = p.passphrase || '';
    document.getElementById('ssh-extra-args').value = p.extraArgs || '';

    const isKey = (p.authType || 'password') === 'key';
    this.sshKeyGroup.style.display = isKey ? 'block' : 'none';
    this.sshPassphraseGroup.style.display = isKey ? 'block' : 'none';
    this.sshPasswordGroup.style.display = isKey ? 'none' : 'block';

    this.btnSshDelete.classList.remove('hidden');
  }

  getSelectedFormProfile() {
    const name = document.getElementById('ssh-name').value.trim();
    const host = document.getElementById('ssh-host').value.trim();
    const username = document.getElementById('ssh-username').value.trim();
    if (!name || !host || !username) return null;

    return {
      id: document.getElementById('ssh-id').value || 'ssh_' + Math.random().toString(36).substring(2, 9),
      name,
      host,
      port: parseInt(document.getElementById('ssh-port').value, 10) || 22,
      username,
      authType: document.getElementById('ssh-auth-type').value,
      password: document.getElementById('ssh-password').value,
      keyPath: document.getElementById('ssh-key-path').value.trim(),
      passphrase: document.getElementById('ssh-passphrase').value,
      extraArgs: document.getElementById('ssh-extra-args').value.trim()
    };
  }

  async handleSaveSshProfile() {
    const profile = this.getSelectedFormProfile();
    if (!profile) {
      alert('Por favor completa los campos requeridos (Nombre, Host, Usuario).');
      return;
    }

    const index = this.profiles.findIndex((p) => p.id === profile.id);
    if (index >= 0) {
      this.profiles[index] = profile;
    } else {
      this.profiles.push(profile);
    }

    await window.api.saveProfiles(this.profiles);
    this.renderSshProfilesList();
    this.fillSshForm(profile);
  }

  async handleDeleteSshProfile() {
    const id = document.getElementById('ssh-id').value;
    if (!id) return;
    if (!confirm('¿Seguro que deseas eliminar este perfil SSH?')) return;

    this.profiles = this.profiles.filter((p) => p.id !== id);
    await window.api.saveProfiles(this.profiles);
    this.renderSshProfilesList();
    this.clearSshForm();
  }

  // ================= GENERAL SESSIONS =================
  async openSessionModal() {
    await this.renderSessionsList();
    this.modalSession.classList.remove('hidden');
  }

  async renderSessionsList() {
    const container = document.getElementById('saved-sessions-list');
    container.innerHTML = '<div class="empty-msg">Cargando sesiones...</div>';

    const sessions = await window.api.getSessions();
    const sessionKeys = Object.keys(sessions);

    if (sessionKeys.length === 0) {
      container.innerHTML = '<div class="empty-msg">No hay sesiones guardadas todavía.</div>';
      return;
    }

    container.innerHTML = '';
    sessionKeys.forEach((key) => {
      const sess = sessions[key];
      const row = document.createElement('div');
      row.className = 'saved-item-row';

      const info = document.createElement('div');
      const dateStr = sess.savedAt ? new Date(sess.savedAt).toLocaleString() : '';
      info.innerHTML = `
        <div class="saved-item-title">${sess.name}</div>
        <div class="saved-item-meta">${sess.tabs ? sess.tabs.length : 0} pestañas • Guardado: ${dateStr}</div>
      `;

      const actions = document.createElement('div');
      actions.className = 'saved-item-actions';

      const btnRestore = document.createElement('button');
      btnRestore.className = 'btn btn-sm btn-primary';
      btnRestore.textContent = 'Restaurar';
      btnRestore.addEventListener('click', () => {
        this.restoreSession(sess);
        this.modalSession.classList.add('hidden');
      });

      const btnDelete = document.createElement('button');
      btnDelete.className = 'btn btn-sm btn-danger';
      btnDelete.textContent = '✕';
      btnDelete.title = 'Eliminar sesión guardada';
      btnDelete.addEventListener('click', async () => {
        if (confirm(`¿Eliminar la sesión guardada "${sess.name}"?`)) {
          await window.api.deleteSession(sess.name);
          this.renderSessionsList();
        }
      });

      actions.appendChild(btnRestore);
      actions.appendChild(btnDelete);
      row.appendChild(info);
      row.appendChild(actions);

      container.appendChild(row);
    });
  }

  cleanTreeForSerialization(node) {
    if (node.type === 'terminal') {
      const inst = this.terminals.get(node.id);
      return {
        type: 'terminal',
        title: inst ? inst.title : node.title,
        shellPath: inst ? inst.shellPath : null
      };
    }
    return {
      type: 'split',
      orientation: node.orientation,
      ratio: node.ratio || 0.5,
      first: this.cleanTreeForSerialization(node.first),
      second: this.cleanTreeForSerialization(node.second)
    };
  }

  async handleSaveSession() {
    const input = document.getElementById('new-session-name');
    const name = input.value.trim();
    if (!name) {
      alert('Ingresa un nombre para la sesión.');
      return;
    }

    const sessionData = {
      activeTabTitle: this.tabs.find((t) => t.id === this.activeTabId)?.title,
      tabs: this.tabs.map((tab) => ({
        title: tab.title,
        tree: this.cleanTreeForSerialization(tab.tree)
      }))
    };

    await window.api.saveSession(name, sessionData);
    input.value = '';
    await this.renderSessionsList();
  }

  restoreSession(sess) {
    if (!sess.tabs || sess.tabs.length === 0) return;

    this.tabs.forEach((tab) => {
      this.destroySubtreeTerminals(tab.tree);
      const view = document.getElementById(`view-${tab.id}`);
      if (view) view.remove();
    });
    this.tabs = [];
    this.terminals.clear();

    const assignIds = (node) => {
      const id = (node.type === 'terminal' ? 'term_' : 'split_') + Math.random().toString(36).substring(2, 9);
      if (node.type === 'terminal') {
        return {
          id,
          type: 'terminal',
          title: node.title || 'Terminal',
          shellPath: node.shellPath || null
        };
      }
      return {
        id,
        type: 'split',
        orientation: node.orientation,
        ratio: node.ratio || 0.5,
        first: assignIds(node.first),
        second: assignIds(node.second)
      };
    };

    sess.tabs.forEach((tabDef, idx) => {
      const freshTree = assignIds(tabDef.tree);
      this.createTab(tabDef.title || `Pestaña ${idx + 1}`, freshTree);
    });
  }

  // ================= TAB LAYOUT TEMPLATES =================
  async openTabLayoutModal() {
    await this.renderTabTemplatesList();
    this.modalTabLayout.classList.remove('hidden');
  }

  async renderTabTemplatesList() {
    const container = document.getElementById('tab-templates-list');
    container.innerHTML = '<div class="empty-msg">Cargando plantillas...</div>';

    const templates = await window.api.getTabTemplates();
    const templateKeys = Object.keys(templates);

    if (templateKeys.length === 0) {
      container.innerHTML = '<div class="empty-msg">No hay plantillas guardadas.</div>';
      return;
    }

    container.innerHTML = '';
    templateKeys.forEach((key) => {
      const tmpl = templates[key];
      const row = document.createElement('div');
      row.className = 'saved-item-row';

      const info = document.createElement('div');
      info.innerHTML = `
        <div class="saved-item-title">${tmpl.name}</div>
        <div class="saved-item-meta">Disposición de splits para pestaña</div>
      `;

      const actions = document.createElement('div');
      actions.className = 'saved-item-actions';

      const btnApply = document.createElement('button');
      btnApply.className = 'btn btn-sm btn-primary';
      btnApply.textContent = 'Aplicar a Pestaña';
      btnApply.addEventListener('click', () => {
        this.applyTemplateToCurrentTab(tmpl.layout);
        this.modalTabLayout.classList.add('hidden');
      });

      actions.appendChild(btnApply);

      if (!['Single Terminal', '2 Terminals Vertical', '2 Terminals Horizontal', '4 Terminals (2x2 Grid)'].includes(tmpl.name)) {
        const btnDelete = document.createElement('button');
        btnDelete.className = 'btn btn-sm btn-danger';
        btnDelete.textContent = '✕';
        btnDelete.addEventListener('click', async () => {
          if (confirm(`¿Eliminar la plantilla "${tmpl.name}"?`)) {
            await window.api.deleteTabTemplate(tmpl.name);
            this.renderTabTemplatesList();
          }
        });
        actions.appendChild(btnDelete);
      }

      row.appendChild(info);
      row.appendChild(actions);
      container.appendChild(row);
    });
  }

  async handleSaveTabTemplate() {
    const input = document.getElementById('new-tab-template-name');
    const name = input.value.trim();
    if (!name) {
      alert('Ingresa un nombre para la plantilla.');
      return;
    }

    const tab = this.tabs.find((t) => t.id === this.activeTabId);
    if (!tab) return;

    const templateData = {
      layout: this.cleanTreeForSerialization(tab.tree)
    };

    await window.api.saveTabTemplate(name, templateData);
    input.value = '';
    await this.renderTabTemplatesList();
  }

  applyTemplateToCurrentTab(templateLayout) {
    const tab = this.tabs.find((t) => t.id === this.activeTabId);
    if (!tab) return;

    this.destroySubtreeTerminals(tab.tree);

    const assignIds = (node) => {
      const id = (node.type === 'terminal' ? 'term_' : 'split_') + Math.random().toString(36).substring(2, 9);
      if (node.type === 'terminal') {
        return {
          id,
          type: 'terminal',
          title: node.title || 'Terminal'
        };
      }
      return {
        id,
        type: 'split',
        orientation: node.orientation,
        ratio: node.ratio || 0.5,
        first: assignIds(node.first),
        second: assignIds(node.second)
      };
    };

    tab.tree = assignIds(templateLayout);
    this.renderTabWorkspace(this.activeTabId);

    const leaves = this.getLeafTerminals(tab.tree);
    if (leaves.length > 0) {
      this.setActiveTerminal(leaves[0].id);
    }
  }

  // ================= STATUS BAR =================
  updateStatusBar() {
    const tab = this.tabs.find((t) => t.id === this.activeTabId);
    if (tab) {
      const leaves = this.getLeafTerminals(tab.tree);
      this.statusBarActiveTab.textContent = `${tab.title} (${leaves.length} terminal${leaves.length > 1 ? 'es' : ''})`;
    }

    if (this.activeTerminalId) {
      const inst = this.terminals.get(this.activeTerminalId);
      this.statusBarActiveTerm.textContent = `Terminal activa: ${inst ? inst.title : this.activeTerminalId}`;
    } else {
      this.statusBarActiveTerm.textContent = 'Terminal activa: Ninguna';
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.appInstance = new TuxTerminalApp();
});
