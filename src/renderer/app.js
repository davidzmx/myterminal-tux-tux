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

const PRESET_GROUP_ICONS = [
  '⚡', '💻', '🌿', '🐳', '☸️', '🚀', '📦', '🔧', '⚙️', 
  '📜', '🐍', '☕', '🦀', '🌐', '📊', '🧪', '🔥', '🛡️', 
  '💾', '🤖', '🐧', '📋', '📁', '⭐', '🎯', '🔌', '📡'
];

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

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  initElements() {
    this.tabsListEl = document.getElementById('tabs-list');
    this.workspaceEl = document.getElementById('workspace');
    this.btnNewTab = document.getElementById('btn-new-tab');
    this.statusBarActiveTab = document.getElementById('active-tab-info');
    this.statusBarActiveTerm = document.getElementById('active-term-info');
    this.contextMenu = document.getElementById('context-menu');
    this.ctxSshSubmenu = document.getElementById('ctx-ssh-submenu');
    this.tabContextMenu = document.getElementById('tab-context-menu');
    this.contextTargetTabId = null;

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
    this.btnSshClone = document.getElementById('btn-ssh-clone');
    this.btnSshConnectActive = document.getElementById('btn-ssh-connect-active');
    this.btnSshTest = document.getElementById('btn-ssh-test');
    this.sshTestResult = document.getElementById('ssh-test-result');

    // Button Groups & Actions elements
    this.modalEditButtonGroup = document.getElementById('modal-edit-button-group');
    this.editButtonGroupForm = document.getElementById('edit-button-group-form');
    this.editGroupIdInput = document.getElementById('edit-group-id');
    this.editGroupNameInput = document.getElementById('edit-group-name');
    this.editGroupIconInput = document.getElementById('edit-group-icon');
    this.iconPickerPalette = document.getElementById('icon-picker-palette');
    this.editGroupModalTitle = document.getElementById('edit-group-modal-title');
    this.cfgButtonGroupSelect = document.getElementById('cfg-button-group-select');
    this.btnAddGroup = document.getElementById('btn-add-group');
    this.btnEditGroup = document.getElementById('btn-edit-group');
    this.btnDeleteGroup = document.getElementById('btn-delete-group');
    this.cfgGroupActionsTitle = document.getElementById('cfg-group-actions-title');

    // Git Form
    this.gitUserForm = document.getElementById('git-user-form');

    // State for SSH Search & Cloud Syncing
    this.sshSearchQuery = '';
    this.isSyncing = false;
  }

  async loadInitialData() {
    try {
      this.config = await window.api.getConfig();
      if (!this.config.buttonGroups || !Array.isArray(this.config.buttonGroups) || this.config.buttonGroups.length === 0) {
        this.config.buttonGroups = await window.api.resetButtonGroups();
      }
      if (this.config.gitActions) {
        this.config.gitActions = this.config.gitActions.filter(a => a.action !== 'user-git' && a.label !== 'user Git');
      }
      if (!this.config.defaultNonGitGroup) {
        this.config.defaultNonGitGroup = 'group-system';
      }
      if (this.config.autoSwitchGitGroup === undefined) {
        this.config.autoSwitchGitGroup = true;
      }
    } catch (e) {
      console.error('Error loading config:', e);
      this.config = { theme: 'dark', defaultDir: 'cwd', buttonGroups: [], defaultNonGitGroup: 'group-system', autoSwitchGitGroup: true };
    }
    this.selectedConfigGroupId = this.config.activeButtonGroup || this.config.buttonGroups?.[0]?.id || 'group-git';

    try {
      this.availableShells = await window.api.getAvailableShells();
    } catch (e) {
      console.error('Error fetching shells:', e);
      this.availableShells = [{ name: 'Bash', path: '/bin/bash' }];
    }

    try {
      this.systemInfo = await window.api.getSystemInfo();
      this.homeDir = this.systemInfo?.homedir || null;
    } catch (e) {
      console.error('Error fetching system info:', e);
    }

    if (!this.config.favorites || !Array.isArray(this.config.favorites)) {
      this.config.favorites = [
        { id: 'fav-home', name: 'Inicio (~)', path: this.homeDir || '~' }
      ];
    }

    this.applyTheme(this.config.theme || 'dark');
    this.applySshHeaderColor();

    try {
      this.profiles = await window.api.getProfiles();
      this.renderSshProfilesList();
    } catch (e) {
      console.error('Error loading SSH profiles:', e);
      this.profiles = [];
    }

    // Create first default tab
    this.createTab('Principal');

    // Initialize cloud sync status in top bar & status bar
    this.refreshGDriveUI();

    // Auto pull from Google Drive if there are newer changes from another machine
    setTimeout(() => {
      this.autoSyncPullIfAvailable(false);
    }, 1500);

    // Periodic check for cloud updates (every 90s)
    setInterval(() => {
      this.autoSyncPullIfAvailable(true);
    }, 90000);

    // Check for updates when app window regains focus
    window.addEventListener('focus', () => {
      const now = Date.now();
      if (!this.lastFocusSyncCheck || (now - this.lastFocusSyncCheck) > 35000) {
        this.lastFocusSyncCheck = now;
        this.autoSyncPullIfAvailable(true);
      }
    });

    // Polling git info every 2.5s for terminals
    setInterval(() => {
      this.updateAllGitInfo();
    }, 2500);

    // Polling SSH status to automatically restore normal header if disconnected
    setInterval(async () => {
      for (const [termId, inst] of this.terminals.entries()) {
        if (inst && inst.sshSession) {
          try {
            const status = await window.api.getTerminalSshStatus(termId);
            if (!status || !status.connected) {
              inst.sshSession = null;
              inst.pendingSshSession = null;
              inst.sshShowGit = false;
              inst.title = 'Terminal';
              this.updateToolbarSshStatus(termId);
              this.updateStatusBar();
            }
          } catch (e) {}
        }
      }
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

  applySshHeaderColor() {
    const color = this.config?.sshHeaderColor || '#b91c1c';
    document.documentElement.style.setProperty('--ssh-active-color', color);
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

    const btnAbout = document.getElementById('btn-about');
    if (btnAbout) {
      btnAbout.addEventListener('click', () => {
        this.openSettingsModal('tab-about-opts');
      });
    }

    const brandEl = document.querySelector('.app-brand');
    if (brandEl) {
      brandEl.addEventListener('click', () => {
        this.openSettingsModal('tab-about-opts');
      });
    }

    const repoUrl = 'https://github.com/davidzmx/myterminal-tux-tux';
    const btnOpenRepo = document.getElementById('btn-open-repo');
    if (btnOpenRepo) {
      btnOpenRepo.addEventListener('click', () => {
        if (window.api && window.api.openExternal) {
          window.api.openExternal(repoUrl);
        } else {
          window.open(repoUrl, '_blank');
        }
      });
    }

    const repoLinkEl = document.getElementById('about-repo-link');
    if (repoLinkEl) {
      repoLinkEl.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.api && window.api.openExternal) {
          window.api.openExternal(repoUrl);
        } else {
          window.open(repoUrl, '_blank');
        }
      });
    }

    const btnCopyRepo = document.getElementById('btn-copy-repo');
    if (btnCopyRepo) {
      btnCopyRepo.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(repoUrl);
          const feedback = document.getElementById('about-copy-feedback');
          if (feedback) {
            feedback.classList.remove('hidden');
            setTimeout(() => {
              feedback.classList.add('hidden');
            }, 3000);
          }
        } catch (err) {
          console.error('Error al copiar repositorio:', err);
        }
      });
    }

    this.initGDriveEvents();

    const btnCloud = document.getElementById('btn-cloud-status');
    if (btnCloud) {
      btnCloud.addEventListener('click', () => {
        this.openSettingsModal('tab-gdrive-opts');
      });
    }

    const btnCloudSyncNow = document.getElementById('btn-cloud-sync-now');
    if (btnCloudSyncNow) {
      btnCloudSyncNow.addEventListener('click', (e) => {
        e.stopPropagation();
        this.triggerSyncNow();
      });
    }

    const statusCloud = document.getElementById('status-cloud-indicator');
    if (statusCloud) {
      statusCloud.addEventListener('click', () => {
        this.triggerSyncNow();
      });
    }

    const btnSshSyncNow = document.getElementById('btn-ssh-sync-now');
    if (btnSshSyncNow) {
      btnSshSyncNow.addEventListener('click', () => {
        this.triggerSyncNow();
      });
    }

    const btnGdriveSyncNow = document.getElementById('btn-gdrive-sync-now');
    if (btnGdriveSyncNow) {
      btnGdriveSyncNow.addEventListener('click', () => {
        this.triggerSyncNow();
      });
    }

    // SSH Profiles Search
    const sshSearchInput = document.getElementById('ssh-search-input');
    const sshSearchClear = document.getElementById('btn-ssh-search-clear');
    if (sshSearchInput) {
      sshSearchInput.addEventListener('input', (e) => {
        this.sshSearchQuery = e.target.value.trim().toLowerCase();
        if (sshSearchClear) {
          if (this.sshSearchQuery) sshSearchClear.classList.remove('hidden');
          else sshSearchClear.classList.add('hidden');
        }
        this.renderSshProfilesList();
      });
    }
    if (sshSearchClear) {
      sshSearchClear.addEventListener('click', () => {
        if (sshSearchInput) {
          sshSearchInput.value = '';
          this.sshSearchQuery = '';
          sshSearchClear.classList.add('hidden');
          sshSearchInput.focus();
          this.renderSshProfilesList();
        }
      });
    }

    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close-modal');
        this.closeModal(modalId);
      });
    });

    document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
      backdrop.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        if (modal) this.closeModal(modal);
      });
    });

    this.initModalFocusObserver();

    // Re-focus terminal when Electron window regains focus (e.g. returning from OS file dialog)
    window.addEventListener('focus', () => {
      if (!this.hasOpenModal()) {
        this.refocusActiveTerminal();
      }
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
      await this.resetDefaultGitActions();
    });

    document.getElementById('btn-save-git-actions').addEventListener('click', async () => {
      await this.saveGitActionsConfig();
    });

    // Group select in settings changed
    if (this.cfgButtonGroupSelect) {
      this.cfgButtonGroupSelect.addEventListener('change', (e) => {
        this.selectedConfigGroupId = e.target.value;
        this.renderGitActionsConfig();
      });
    }

    if (this.btnAddGroup) {
      this.btnAddGroup.addEventListener('click', () => {
        this.openCreateGroupModal();
      });
    }

    if (this.btnEditGroup) {
      this.btnEditGroup.addEventListener('click', () => {
        this.openEditGroupModal();
      });
    }

    if (this.btnDeleteGroup) {
      this.btnDeleteGroup.addEventListener('click', () => {
        this.deleteSelectedGroup();
      });
    }

    const btnGroupUp = document.getElementById('btn-group-move-up');
    if (btnGroupUp) {
      btnGroupUp.addEventListener('click', () => {
        this.moveSelectedGroup(-1);
      });
    }

    const btnGroupDown = document.getElementById('btn-group-move-down');
    if (btnGroupDown) {
      btnGroupDown.addEventListener('click', () => {
        this.moveSelectedGroup(1);
      });
    }

    const btnAddFavSetting = document.getElementById('btn-add-favorite-setting');
    if (btnAddFavSetting) {
      btnAddFavSetting.addEventListener('click', () => {
        this.openAddFavoriteModal();
      });
    }

    const formAddFav = document.getElementById('form-add-favorite');
    if (formAddFav) {
      formAddFav.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSaveFavoriteSubmit();
      });
    }

    const btnSaveFavs = document.getElementById('btn-save-favorites-config');
    if (btnSaveFavs) {
      btnSaveFavs.addEventListener('click', async () => {
        await this.saveFavoritesConfig();
      });
    }

    const btnExportBackup = document.getElementById('btn-export-backup');
    if (btnExportBackup) {
      btnExportBackup.addEventListener('click', async () => {
        await this.handleExportBackup();
      });
    }

    const btnImportBackup = document.getElementById('btn-import-backup');
    if (btnImportBackup) {
      btnImportBackup.addEventListener('click', async () => {
        await this.handleImportBackup();
      });
    }

    if (this.editButtonGroupForm) {
      this.editButtonGroupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSaveGroupSubmit();
      });
    }

    this.initIconPicker();

    // Single Action form submit
    this.editGitActionForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const actionId = this.editGitActionIdInput.value;
      const newLabel = this.editGitActionLabelInput.value.trim();
      const newCmd = this.editGitActionCmdInput.value.trim();

      if (!newLabel) {
        alert('Por favor ingresa un nombre para el botón.');
        return;
      }

      const group = this.getSelectedConfigGroup();
      if (!group) return;

      if (!group.actions) group.actions = [];

      if (actionId) {
        // Edit existing
        const action = group.actions.find((a) => a.id === actionId);
        if (action) {
          action.label = newLabel;
          if (action.action !== 'user-git') {
            action.cmd = newCmd;
          }
        }
      } else {
        // Create new
        group.actions.push({
          id: 'act_' + Math.random().toString(36).substring(2, 8),
          label: newLabel,
          cmd: newCmd,
          enabled: true
        });
      }

      if (group.isGit || group.id === 'group-git') {
        this.config.gitActions = group.actions;
      }

      await window.api.saveConfig(this.config);
      this.renderGitActionsConfig();
      this.refreshAllGitToolbars();
      this.closeModal(this.modalEditGitAction);
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

    if (this.btnSshTest) {
      this.btnSshTest.addEventListener('click', () => {
        this.handleTestSshConnection();
      });
    }

    this.btnSshConnectActive.addEventListener('click', () => {
      const profile = this.getSelectedFormProfile();
      if (profile && this.activeTerminalId) {
        this.closeModal(this.modalSsh);
        this.handleSshProfileSelection(this.activeTerminalId, profile);
        setTimeout(() => {
          const inst = this.terminals.get(this.activeTerminalId);
          if (inst && inst.term) this.focusTerminal(inst);
        }, 120);
      } else if (!this.activeTerminalId) {
        alert('Selecciona o haz clic en una terminal primero.');
      }
    });

    this.modalSshSwitch = document.getElementById('modal-ssh-switch');

    document.getElementById('btn-ssh-switch-replace').addEventListener('click', () => {
      this.closeModal(this.modalSshSwitch);
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
      this.closeModal(this.modalSshSwitch);
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
      this.closeModal(this.modalSshSwitch);
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

    if (this.btnSshClone) {
      this.btnSshClone.addEventListener('click', () => {
        this.cloneSshProfile();
      });
    }

    document.getElementById('btn-save-current-session').addEventListener('click', () => {
      this.handleSaveSession();
    });

    document.getElementById('btn-save-tab-template').addEventListener('click', () => {
      this.handleSaveTabTemplate();
    });

    // Git Commit Modal setup
    this.modalGitCommit = document.getElementById('modal-git-commit');
    const commitMsgInput = document.getElementById('git-commit-msg');
    const commitForm = document.getElementById('git-commit-form');
    const chkCommitAll = document.getElementById('git-commit-opt-all');
    const chkCommitAmend = document.getElementById('git-commit-opt-amend');
    const btnCommitSelectAll = document.getElementById('git-commit-select-all');
    const btnCommitDeselectAll = document.getElementById('git-commit-deselect-all');

    if (commitMsgInput) {
      commitMsgInput.addEventListener('input', () => this.updateGitCommitPreview());
      commitMsgInput.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          this.executeGitCommit();
        }
      });
    }

    if (chkCommitAll) {
      chkCommitAll.addEventListener('change', () => this.updateGitCommitPreview());
    }
    if (chkCommitAmend) {
      chkCommitAmend.addEventListener('change', () => this.updateGitCommitPreview());
    }
    if (btnCommitSelectAll) {
      btnCommitSelectAll.addEventListener('click', () => {
        document.querySelectorAll('.git-commit-file-chk').forEach(c => (c.checked = true));
        this.updateGitCommitPreview();
      });
    }
    if (btnCommitDeselectAll) {
      btnCommitDeselectAll.addEventListener('click', () => {
        document.querySelectorAll('.git-commit-file-chk').forEach(c => (c.checked = false));
        this.updateGitCommitPreview();
      });
    }

    if (commitForm) {
      commitForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.executeGitCommit();
      });
    }

    // Git Add Modal setup
    this.modalGitAdd = document.getElementById('modal-git-add');
    const addForm = document.getElementById('git-add-form');
    const chkAddAll = document.getElementById('git-add-opt-all');
    const btnAddSelectAll = document.getElementById('git-add-select-all');
    const btnAddDeselectAll = document.getElementById('git-add-deselect-all');

    if (chkAddAll) {
      chkAddAll.addEventListener('change', () => this.updateGitAddPreview());
    }
    if (btnAddSelectAll) {
      btnAddSelectAll.addEventListener('click', () => {
        document.querySelectorAll('.git-add-file-chk').forEach(c => (c.checked = true));
        this.updateGitAddPreview();
      });
    }
    if (btnAddDeselectAll) {
      btnAddDeselectAll.addEventListener('click', () => {
        document.querySelectorAll('.git-add-file-chk').forEach(c => (c.checked = false));
        this.updateGitAddPreview();
      });
    }
    if (addForm) {
      addForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.executeGitAdd();
      });
    }

    // Git Unstage Modal setup
    this.modalGitUnstage = document.getElementById('modal-git-unstage');
    const unstageForm = document.getElementById('git-unstage-form');
    const chkUnstageAll = document.getElementById('git-unstage-opt-all');
    const btnUnstageSelectAll = document.getElementById('git-unstage-select-all');
    const btnUnstageDeselectAll = document.getElementById('git-unstage-deselect-all');

    if (chkUnstageAll) {
      chkUnstageAll.addEventListener('change', () => this.updateGitUnstagePreview());
    }
    if (btnUnstageSelectAll) {
      btnUnstageSelectAll.addEventListener('click', () => {
        document.querySelectorAll('.git-unstage-file-chk').forEach(c => (c.checked = true));
        this.updateGitUnstagePreview();
      });
    }
    if (btnUnstageDeselectAll) {
      btnUnstageDeselectAll.addEventListener('click', () => {
        document.querySelectorAll('.git-unstage-file-chk').forEach(c => (c.checked = false));
        this.updateGitUnstagePreview();
      });
    }
    if (unstageForm) {
      unstageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.executeGitUnstage();
      });
    }

    const cfgSshColor = document.getElementById('cfg-ssh-color');
    if (cfgSshColor) {
      cfgSshColor.addEventListener('input', (e) => {
        const span = document.getElementById('cfg-ssh-color-code');
        if (span) span.textContent = `${e.target.value}`;
      });
    }

    this.gitUserForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const termId = this.gitTargetTermId || this.activeTerminalId;
      if (!termId) return;

      const name = document.getElementById('git-user-name').value.trim();
      const email = document.getElementById('git-user-email').value.trim();

      await window.api.setGitUser(termId, name, email);
      this.closeModal(this.modalGitUser);
      this.refreshGitInfo(termId);
    });

    document.addEventListener('click', (e) => {
      if (!this.contextMenu.contains(e.target)) {
        this.hideContextMenu();
      }
      if (this.tabContextMenu && !this.tabContextMenu.contains(e.target)) {
        this.hideTabContextMenu();
      }
      if (!e.target.closest('.ssh-select-wrapper')) {
        document.querySelectorAll('.ssh-dropdown-menu.show').forEach((m) => m.classList.remove('show'));
      }
      if (!e.target.closest('.tb-group-select-wrapper')) {
        document.querySelectorAll('.tb-group-dropdown.show').forEach((m) => m.classList.remove('show'));
      }
      if (!e.target.closest('.tb-git-branch-wrapper')) {
        document.querySelectorAll('.tb-git-dropdown.show').forEach((m) => m.classList.remove('show'));
      }
      if (!e.target.closest('.tb-git-overflow-wrapper')) {
        document.querySelectorAll('.tb-git-overflow-menu.show').forEach((m) => m.classList.remove('show'));
      }
      if (!e.target.closest('.fav-select-wrapper')) {
        document.querySelectorAll('.fav-dropdown-menu.show').forEach((m) => m.classList.remove('show'));
      }
    });

    if (this.tabContextMenu) {
      this.tabContextMenu.addEventListener('click', (e) => {
        const item = e.target.closest('.menu-item');
        if (!item) return;

        const action = item.getAttribute('data-tab-action');
        const tabId = this.contextTargetTabId || this.activeTabId;

        this.hideTabContextMenu();

        switch (action) {
          case 'rename':
            if (tabId) this.startRenamingTab(tabId);
            break;
          case 'save-tab':
            if (tabId) this.saveTabState(tabId);
            break;
          case 'load-tab':
            this.openTabLayoutModal();
            break;
          case 'new-tab':
            this.createTab();
            break;
          case 'close-tab':
            if (tabId) this.closeTab(tabId);
            break;
        }
      });
    }

    const topBar = document.getElementById('top-bar');
    if (topBar) {
      topBar.addEventListener('contextmenu', (e) => {
        if (e.target.closest('.app-brand') || e.target.closest('#top-actions') || e.target.closest('.tab-item')) return;
        e.preventDefault();
        e.stopPropagation();
        this.showTabContextMenu(e.clientX, e.clientY, null);
      });
    }

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
        } else if (e.key === 'Q' || e.key === 'q') {
          e.preventDefault();
          this.requestExitApp();
        } else if (e.key === 'V' || e.key === 'v') {
          e.preventDefault();
          if (this.activeTerminalId) this.pasteToTerminal(this.activeTerminalId);
        } else if (e.key === 'C' || e.key === 'c') {
          e.preventDefault();
          if (this.activeTerminalId) this.copyTerminalSelection(this.activeTerminalId);
        }
      }

      if (e.key === 'Escape') {
        const openModals = Array.from(document.querySelectorAll('.modal:not(.hidden)'));
        if (openModals.length > 0) {
          e.preventDefault();
          this.closeModal(openModals[openModals.length - 1]);
        }
      }
    });

    // Ensure active terminal retains focus on paste
    document.addEventListener('paste', () => {
      const activeEl = document.activeElement;
      const isInput = activeEl && (
        activeEl.tagName === 'INPUT' || 
        (activeEl.tagName === 'TEXTAREA' && !activeEl.classList.contains('xterm-helper-textarea'))
      );
      if (!isInput && this.activeTerminalId) {
        const inst = this.terminals.get(this.activeTerminalId);
        if (inst) {
          this.focusTerminal(inst);
        }
      }
    });

    // Listen for close/exit requests from main process (window close, OS quit)
    if (window.api?.onRequestClose) {
      window.api.onRequestClose(() => {
        this.requestExitApp();
      });
    }

    const btnConfirmExit = document.getElementById('btn-confirm-exit');
    if (btnConfirmExit) {
      btnConfirmExit.addEventListener('click', async () => {
        await this.handleConfirmExit();
      });
    }

    const btnConfirmCloseTerm = document.getElementById('btn-confirm-close-terminal');
    if (btnConfirmCloseTerm) {
      btnConfirmCloseTerm.addEventListener('click', () => {
        const modal = document.getElementById('modal-confirm-close-terminal');
        if (modal) this.closeModal(modal);
        if (this.pendingCloseTermId) {
          const tId = this.pendingCloseTermId;
          this.pendingCloseTermId = null;
          this.executeCloseTerminal(tId);
        }
      });
    }
  }

  // ================= MODAL MANAGER =================
  openModal(modal) {
    if (!modal) return;
    this.modalZIndexCounter = Math.max(this.modalZIndexCounter || 1000, 1000) + 10;
    modal.style.zIndex = this.modalZIndexCounter;
    modal.classList.remove('hidden');
  }

  closeModal(modal) {
    if (!modal) return;
    const modalEl = typeof modal === 'string' ? document.getElementById(modal) : modal;
    if (!modalEl) return;
    modalEl.classList.add('hidden');
    if (!this.hasOpenModal()) {
      this.refocusActiveTerminal();
    }
  }

  hasOpenModal() {
    const openModals = document.querySelectorAll('.modal:not(.hidden)');
    return openModals.length > 0;
  }

  refocusActiveTerminal() {
    let targetId = this.activeTerminalId;
    if (!targetId) {
      const currentTab = this.tabs.find((t) => t.id === this.activeTabId);
      if (currentTab) {
        const leaves = this.getLeafTerminals(currentTab.tree);
        if (leaves.length > 0) {
          targetId = leaves[0].id;
          this.activeTerminalId = targetId;
        }
      }
    }

    if (targetId) {
      const inst = this.terminals.get(targetId);
      if (inst && inst.term) {
        document.querySelectorAll('.terminal-pane').forEach((p) => {
          p.classList.toggle('active-pane', p.getAttribute('data-term-id') === targetId);
        });
        this.focusTerminal(inst);
      }
    }
  }

  initModalFocusObserver() {
    const modals = document.querySelectorAll('.modal');
    if (modals.length === 0) return;

    const observer = new MutationObserver((mutations) => {
      let modalClosed = false;
      for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === 'class') {
          const target = m.target;
          if (target && target.classList && target.classList.contains('hidden')) {
            modalClosed = true;
          }
        }
      }

      if (modalClosed && !this.hasOpenModal()) {
        this.refocusActiveTerminal();
      }
    });

    modals.forEach((modal) => {
      observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
    });
  }

  // ================= APPLICATION EXIT CONFIRMATION =================
  getTabForTerminal(termId) {
    for (const tab of this.tabs) {
      const leaves = this.getLeafTerminals(tab.tree);
      if (leaves.some((leaf) => leaf.id === termId)) {
        return tab;
      }
    }
    return null;
  }

  getActiveSshSessions() {
    const list = [];
    for (const [termId, inst] of this.terminals.entries()) {
      if (inst && inst.sshSession) {
        const tab = this.getTabForTerminal(termId);
        list.push({
          termId,
          name: inst.sshSession.name,
          host: inst.sshSession.host,
          username: inst.sshSession.username,
          port: inst.sshSession.port || 22,
          tabTitle: tab ? tab.title : 'Principal'
        });
      }
    }
    return list;
  }

  requestExitApp() {
    const activeSsh = this.getActiveSshSessions();
    const modalExit = document.getElementById('modal-confirm-exit');
    const normalMsg = document.getElementById('exit-normal-msg');
    const sshWarning = document.getElementById('exit-ssh-warning');
    const sshList = document.getElementById('exit-ssh-list');
    const btnConfirm = document.getElementById('btn-confirm-exit');

    if (!modalExit) return;

    if (activeSsh.length > 0) {
      if (normalMsg) normalMsg.classList.add('hidden');
      if (sshWarning) sshWarning.classList.remove('hidden');
      if (sshList) {
        sshList.innerHTML = '';
        activeSsh.forEach((s) => {
          const li = document.createElement('li');
          li.style.cssText = 'display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; gap:12px;';
          const portStr = (s.port && Number(s.port) !== 22) ? `:${s.port}` : '';
          li.innerHTML = `
            <div>
              <b>${this.escapeHtml(s.name)}</b>
              <span style="font-family:monospace; color:var(--text-dim); font-size:11px;">(${this.escapeHtml(s.username)}@${this.escapeHtml(s.host)}${portStr})</span>
            </div>
            <span class="ssh-exit-tab-badge">📑 ${this.escapeHtml(s.tabTitle)}</span>
          `;
          sshList.appendChild(li);
        });
      }
      if (btnConfirm) {
        btnConfirm.className = 'btn btn-danger';
        btnConfirm.textContent = '🚪 Desconectar y Salir';
        btnConfirm.disabled = false;
      }
    } else {
      if (normalMsg) normalMsg.classList.remove('hidden');
      if (sshWarning) sshWarning.classList.add('hidden');
      if (btnConfirm) {
        btnConfirm.className = 'btn btn-primary';
        btnConfirm.textContent = '🚪 Salir del programa';
        btnConfirm.disabled = false;
      }
    }

    this.openModal(modalExit);
  }

  async handleConfirmExit() {
    const btnConfirm = document.getElementById('btn-confirm-exit');
    if (btnConfirm) {
      btnConfirm.disabled = true;
      btnConfirm.textContent = 'Desconectando...';
    }

    // Gracefully send exit to all active SSH sessions
    for (const [termId, inst] of this.terminals.entries()) {
      if (inst && (inst.sshSession || inst.pendingSshSession)) {
        try {
          window.api.writeTerminal(termId, 'exit\r');
        } catch (e) {}
      }
    }

    // Allow a brief moment for SSH process teardown and socket closure
    await new Promise((r) => setTimeout(r, 160));
    try {
      await this.triggerAutoCloudSync('exit');
    } catch (e) {}
    await window.api.exitApp();
  }

  // ================= CONFIG BACKUP & MIGRATION =================
  async handleExportBackup() {
    const statusEl = document.getElementById('backup-status-msg');
    const btnExport = document.getElementById('btn-export-backup');
    if (statusEl) {
      statusEl.className = 'hidden';
      statusEl.textContent = '';
    }

    if (btnExport) btnExport.disabled = true;

    try {
      const res = await window.api.exportAllConfig();
      if (res && res.canceled) {
        return;
      }
      if (res && res.success) {
        if (statusEl) {
          statusEl.className = 'ssh-test-result-box success';
          statusEl.innerHTML = `<span>✅ Configuración exportada exitosamente a:<br><code style="font-size:11px;">${this.escapeHtml(res.filePath)}</code></span>`;
        }
      } else {
        if (statusEl) {
          statusEl.className = 'ssh-test-result-box error';
          statusEl.textContent = `❌ Error al exportar: ${res?.error || 'Desconocido'}`;
        }
      }
    } catch (err) {
      if (statusEl) {
        statusEl.className = 'ssh-test-result-box error';
        statusEl.textContent = `❌ Error: ${err.message}`;
      }
    } finally {
      if (btnExport) btnExport.disabled = false;
    }
  }

  async handleImportBackup() {
    const statusEl = document.getElementById('backup-status-msg');
    const btnImport = document.getElementById('btn-import-backup');
    if (statusEl) {
      statusEl.className = 'hidden';
      statusEl.textContent = '';
    }

    if (btnImport) btnImport.disabled = true;

    try {
      const res = await window.api.importAllConfig();
      if (res && res.canceled) {
        return;
      }
      if (res && res.success && res.importedData) {
        // Apply imported config in memory
        if (res.importedData.config) {
          this.config = res.importedData.config;
          this.applyTheme(this.config.theme || 'dark');
          this.applySshHeaderColor();
        }
        if (res.importedData.profiles) {
          this.profiles = res.importedData.profiles;
          this.renderSshProfilesList();
        }

        this.refreshAllGitToolbars();
        this.updateAllGitInfo();

        if (statusEl) {
          statusEl.className = 'ssh-test-result-box success';
          statusEl.innerHTML = `<span>✅ Configuración importada con éxito desde:<br><code style="font-size:11px;">${this.escapeHtml(res.filePath)}</code><br>Todos los grupos, comandos, perfiles y preferencias se han actualizado.</span>`;
        }
      } else {
        if (statusEl) {
          statusEl.className = 'ssh-test-result-box error';
          statusEl.textContent = `❌ Error al importar: ${res?.error || 'Formato no reconocido'}`;
        }
      }
    } catch (err) {
      if (statusEl) {
        statusEl.className = 'ssh-test-result-box error';
        statusEl.textContent = `❌ Error al importar archivo: ${err.message}`;
      }
    } finally {
      if (btnImport) btnImport.disabled = false;
    }
  }

  // ================= SETTINGS MODAL =================
  openSettingsModal(tabName = 'tab-general-opts') {
    this.cfgThemeSelect.value = this.config.theme || 'dark';
    this.cfgDefaultDirSelect.value = this.config.defaultDir || 'cwd';
    this.cfgFontSizeInput.value = this.config.fontSize || 13;
    this.cfgFontFamilyInput.value = this.config.fontFamily || "Consolas, 'Fira Code', monospace";
    this.cfgScrollbackInput.value = this.config.scrollback || 5000;

    const sshColor = this.config.sshHeaderColor || '#b91c1c';
    const colorInput = document.getElementById('cfg-ssh-color');
    if (colorInput) colorInput.value = sshColor;
    const colorCode = document.getElementById('cfg-ssh-color-code');
    if (colorCode) colorCode.textContent = sshColor;

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

    const nonGitSelect = document.getElementById('cfg-default-non-git-group');
    if (nonGitSelect) {
      nonGitSelect.innerHTML = '';
      const groups = this.config.buttonGroups || [];
      const currentNonGit = this.config.defaultNonGitGroup || 'group-system';
      groups.forEach((g) => {
        const opt = document.createElement('option');
        opt.value = g.id;
        opt.textContent = `${g.icon || '⚡'} ${g.name}`;
        if (g.id === currentNonGit) opt.selected = true;
        nonGitSelect.appendChild(opt);
      });
      nonGitSelect.onchange = async () => {
        this.config.defaultNonGitGroup = nonGitSelect.value;
        await window.api.saveConfig(this.config);
        this.updateAllGitInfo();
      };
    }

    const autoSwitchChk = document.getElementById('cfg-auto-switch-git');
    if (autoSwitchChk) {
      autoSwitchChk.checked = this.config.autoSwitchGitGroup !== false;
      autoSwitchChk.onchange = async () => {
        this.config.autoSwitchGitGroup = autoSwitchChk.checked;
        await window.api.saveConfig(this.config);
        this.updateAllGitInfo();
      };
    }

    const backupFolderEl = document.getElementById('backup-folder-path');
    if (backupFolderEl && this.homeDir) {
      backupFolderEl.textContent = `${this.homeDir}/.config/myterminal-tux-tux/`;
    }

    const statusEl = document.getElementById('backup-status-msg');
    if (statusEl) {
      statusEl.className = 'hidden';
      statusEl.textContent = '';
    }

    this.renderGitActionsConfig();
    this.renderFavoritesConfig();
    this.renderAboutInfo();
    this.refreshGDriveUI();

    if (tabName) {
      document.querySelectorAll('.settings-nav-btn').forEach((b) => {
        b.classList.toggle('active', b.getAttribute('data-settings-tab') === tabName);
      });
      document.querySelectorAll('.settings-tab-pane').forEach((p) => {
        p.classList.toggle('active', p.id === tabName);
      });
    }

    this.openModal(this.modalSettings);
  }

  async renderAboutInfo() {
    try {
      if (!window.api || !window.api.getSystemInfo) return;
      const info = await window.api.getSystemInfo();
      if (!info) return;

      const appVer = info.version || '1.1.0';
      const versionBadge = document.getElementById('about-version-badge');
      if (versionBadge) versionBadge.textContent = `v${appVer}`;

      const specVer = document.getElementById('about-spec-version');
      if (specVer) specVer.textContent = appVer;

      const specPlatform = document.getElementById('about-spec-platform');
      if (specPlatform) specPlatform.textContent = info.platform || '-';

      const specArch = document.getElementById('about-spec-arch');
      if (specArch) specArch.textContent = info.arch || '-';

      const specElectron = document.getElementById('about-spec-electron');
      if (specElectron) specElectron.textContent = info.electronVersion || '-';

      const specNode = document.getElementById('about-spec-node');
      if (specNode) specNode.textContent = info.nodeVersion || '-';

      const specChrome = document.getElementById('about-spec-chrome');
      if (specChrome) specChrome.textContent = info.chromeVersion || '-';

      const repoLink = document.getElementById('about-repo-link');
      if (repoLink && info.repository) {
        repoLink.textContent = info.repository;
        repoLink.setAttribute('href', info.repository);
      }
    } catch (err) {
      console.warn('No se pudo cargar información del sistema para Acerca de:', err);
    }
  }

  // ================= GOOGLE DRIVE CLOUD SYNC =================
  initGDriveEvents() {
    const importCreds = async () => {
      try {
        const res = await window.api.gdrive.importCredentials();
        if (res.canceled) return;
        if (res.success) {
          this.showGDriveFeedback(`✓ Credenciales importadas exitosamente (Proyecto: ${res.projectId})`, 'success', 'auth');
          await this.refreshGDriveUI();
        } else {
          this.showGDriveFeedback(`❌ Error al importar: ${res.error}`, 'error', 'auth');
        }
      } catch (err) {
        this.showGDriveFeedback(`❌ Error: ${err.message}`, 'error', 'auth');
      }
    };

    document.getElementById('btn-gdrive-import-creds')?.addEventListener('click', importCreds);
    document.getElementById('btn-gdrive-reimport-creds')?.addEventListener('click', importCreds);

    document.getElementById('btn-gdrive-login')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-gdrive-login');
      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span> Esperando autorización en el navegador...';
      this.showGDriveFeedback('Se abrió tu navegador para autorizar la conexión con Google...', 'info', 'auth');

      try {
        const res = await window.api.gdrive.login();
        if (res.success) {
          this.showGDriveFeedback(`✓ ¡Conectado exitosamente como ${res.userEmail}!`, 'success', 'auth');
          await this.refreshGDriveUI();
        } else {
          this.showGDriveFeedback(`❌ ${res.error}`, 'error', 'auth');
        }
      } catch (err) {
        this.showGDriveFeedback(`❌ Error en inicio de sesión: ${err.message}`, 'error', 'auth');
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    });

    document.getElementById('btn-gdrive-logout')?.addEventListener('click', async () => {
      try {
        await window.api.gdrive.logout();
        this.showGDriveFeedback('Sesión de Google Drive desconectada.', 'info', 'auth');
        await this.refreshGDriveUI();
      } catch (err) {
        this.showGDriveFeedback(`❌ Error: ${err.message}`, 'error', 'auth');
      }
    });

    document.getElementById('btn-gdrive-toggle-pass')?.addEventListener('click', () => {
      const input = document.getElementById('gdrive-master-password');
      if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
      }
    });

    document.getElementById('btn-gdrive-clear-pass')?.addEventListener('click', async () => {
      if (confirm('¿Olvidar la contraseña maestra guardada en este equipo?\nTendrás que ingresarla de nuevo para sincronizar en segundo plano.')) {
        await window.api.gdrive.clearMasterPassword();
        const pwdInput = document.getElementById('gdrive-master-password');
        if (pwdInput) {
          pwdInput.value = '';
          pwdInput.placeholder = 'Ingresa tu contraseña de cifrado...';
        }
        await this.refreshGDriveUI();
        this.showGDriveFeedback('Contraseña maestra eliminada de este equipo.', 'info', 'sync');
      }
    });

    document.getElementById('btn-gdrive-upload')?.addEventListener('click', async () => {
      const inputVal = document.getElementById('gdrive-master-password')?.value;
      const status = await window.api.gdrive.getStatus();
      const pass = (inputVal && inputVal.trim()) || '';

      if (!pass && !status?.hasMasterPassword) {
        this.showGDriveFeedback('⚠️ Debes ingresar una Contraseña Maestra para cifrar los datos antes de subir.', 'error', 'sync');
        document.getElementById('gdrive-master-password')?.focus();
        return;
      }

      const btn = document.getElementById('btn-gdrive-upload');
      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span> Cifrando y subiendo a Drive...';

      try {
        const res = await window.api.gdrive.uploadSync(pass);
        if (res.success) {
          this.showGDriveFeedback(
            `✓ ¡Sincronizado con éxito en Google Drive! (${res.stats.profilesCount} perfiles SSH, ${res.stats.sessionsCount} sesiones empaquetadas y cifradas con AES-256).`,
            'success',
            'sync'
          );
          await this.refreshGDriveUI();
        } else {
          this.showGDriveFeedback(`❌ Error al subir: ${res.error}`, 'error', 'sync');
        }
      } catch (err) {
        this.showGDriveFeedback(`❌ Error al subir: ${err.message}`, 'error', 'sync');
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    });

    document.getElementById('btn-gdrive-download')?.addEventListener('click', async () => {
      const inputVal = document.getElementById('gdrive-master-password')?.value;
      const status = await window.api.gdrive.getStatus();
      const pass = (inputVal && inputVal.trim()) || '';

      if (!pass && !status?.hasMasterPassword) {
        this.showGDriveFeedback('⚠️ Debes ingresar la Contraseña Maestra para descifrar los datos descargados.', 'error', 'sync');
        document.getElementById('gdrive-master-password')?.focus();
        return;
      }

      const btn = document.getElementById('btn-gdrive-download');
      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span> Descargando y descifrando...';

      try {
        const res = await window.api.gdrive.downloadSync(pass);
        if (res.success) {
          if (res.data) {
            if (res.data.config) {
              this.config = res.data.config;
              this.applyTheme(this.config.theme || 'dark');
              this.applySshHeaderColor();
            }
            if (Array.isArray(res.data.profiles)) {
              this.profiles = res.data.profiles;
              this.renderSshProfilesList();
            }
          } else {
            this.config = await window.api.getConfig();
            this.profiles = await window.api.getProfiles();
            this.renderSshProfilesList();
            this.applyTheme(this.config?.theme || 'dark');
            this.applySshHeaderColor();
          }

          this.populateConfigGroupSelect();
          this.renderGitActionsConfig();
          this.renderFavoritesConfig();
          this.refreshAllGitToolbars();
          this.updateAllGitInfo();
          await this.refreshGDriveUI();

          this.showGDriveFeedback(
            `✓ ¡Descarga completada y aplicada! Restaurados ${res.stats.profilesCount} perfiles SSH, ${res.stats.sessionsCount} sesiones y ajustes.`,
            'success',
            'sync'
          );
        } else {
          this.showGDriveFeedback(`❌ Error: ${res.error}`, 'error', 'sync');
        }
      } catch (err) {
        this.showGDriveFeedback(`❌ Error al descargar: ${err.message}`, 'error', 'sync');
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    });

    document.getElementById('btn-gdrive-check-remote')?.addEventListener('click', async () => {
      const remoteInfoEl = document.getElementById('gdrive-remote-sync-info');
      if (remoteInfoEl) remoteInfoEl.textContent = 'Verificando en Drive...';
      try {
        const res = await window.api.gdrive.checkRemote();
        if (res.success && res.remoteFile) {
          const mod = new Date(res.remoteFile.modifiedTime).toLocaleString();
          const sizeKb = (res.remoteFile.size / 1024).toFixed(1);
          if (remoteInfoEl) remoteInfoEl.textContent = `${mod} (${sizeKb} KB)`;
          this.showGDriveFeedback(`Copia encontrada en Google Drive: modificada el ${mod} (${sizeKb} KB).`, 'info', 'sync');
        } else if (res.success && !res.remoteFile) {
          if (remoteInfoEl) remoteInfoEl.textContent = 'No hay archivo en Drive';
          this.showGDriveFeedback('No se encontró ninguna copia en la nube todavía. Haz clic en "Subir y Guardar en Drive".', 'info', 'sync');
        } else {
          if (remoteInfoEl) remoteInfoEl.textContent = 'Error al comprobar';
          this.showGDriveFeedback(`❌ ${res.error}`, 'error', 'sync');
        }
      } catch (err) {
        if (remoteInfoEl) remoteInfoEl.textContent = 'Error';
        this.showGDriveFeedback(`❌ Error: ${err.message}`, 'error', 'sync');
      }
    });

    const chkExit = document.getElementById('chk-gdrive-auto-sync-exit');
    const chkSsh = document.getElementById('chk-gdrive-auto-sync-ssh');

    chkExit?.addEventListener('change', async () => {
      await window.api.gdrive.saveOptions({ autoSyncOnExit: chkExit.checked });
    });

    chkSsh?.addEventListener('change', async () => {
      await window.api.gdrive.saveOptions({ autoSyncOnSshSave: chkSsh.checked });
    });
  }

  showGDriveFeedback(message, type = 'info', section = 'sync') {
    const elId = section === 'auth' ? 'gdrive-auth-feedback-msg' : 'gdrive-feedback-msg';
    const el = document.getElementById(elId);
    if (!el) return;
    el.className = '';
    el.classList.remove('hidden');

    if (type === 'success') {
      el.style.background = 'rgba(34, 197, 94, 0.15)';
      el.style.border = '1px solid rgba(34, 197, 94, 0.4)';
      el.style.color = '#4ade80';
    } else if (type === 'error') {
      el.style.background = 'rgba(239, 68, 68, 0.15)';
      el.style.border = '1px solid rgba(239, 68, 68, 0.4)';
      el.style.color = '#f87171';
    } else {
      el.style.background = 'rgba(6, 182, 212, 0.12)';
      el.style.border = '1px solid rgba(6, 182, 212, 0.3)';
      el.style.color = '#38bdf8';
    }

    el.textContent = message;
  }

  async refreshGDriveUI() {
    try {
      if (!window.api || !window.api.gdrive) return;
      const status = await window.api.gdrive.getStatus();
      if (!status) return;

      const noClientBox = document.getElementById('gdrive-no-client-box');
      const hasClientBox = document.getElementById('gdrive-has-client-box');
      const notLoggedBox = document.getElementById('gdrive-not-logged-box');
      const loggedBox = document.getElementById('gdrive-logged-box');
      const clientSummary = document.getElementById('gdrive-client-summary');
      const projectSummary = document.getElementById('gdrive-project-summary');
      const userEmailEl = document.getElementById('gdrive-user-email');
      const lastSyncLocalEl = document.getElementById('gdrive-last-sync-local');

      if (status.hasClientConfig) {
        noClientBox?.classList.add('hidden');
        hasClientBox?.classList.remove('hidden');
        if (clientSummary && status.clientInfo) {
          clientSummary.textContent = `Credenciales cargadas (${status.clientInfo.clientId})`;
          projectSummary.textContent = `Proyecto: ${status.clientInfo.projectId}`;
        }
      } else {
        noClientBox?.classList.remove('hidden');
        hasClientBox?.classList.add('hidden');
      }

      const cloudStatusGroup = document.getElementById('cloud-status-group');
      const btnCloudStatus = document.getElementById('btn-cloud-status');
      const cloudStatusText = document.getElementById('cloud-status-text');
      const statusCloudIndicator = document.getElementById('status-cloud-indicator');
      const statusCloudText = document.getElementById('status-cloud-text');

      if (status.isAuthenticated) {
        notLoggedBox?.classList.add('hidden');
        loggedBox?.classList.remove('hidden');
        if (userEmailEl) userEmailEl.textContent = status.userEmail || 'Usuario conectado';

        // Update Top Bar Cloud Status Button
        if (cloudStatusGroup) cloudStatusGroup.classList.remove('hidden');
        if (btnCloudStatus) {
          const shortUser = status.userEmail ? status.userEmail.split('@')[0] : 'Drive';
          if (!this.isSyncing && cloudStatusText) cloudStatusText.textContent = `Drive: ${shortUser}`;
          btnCloudStatus.title = `Google Drive: Conectado (${status.userEmail}). Clic para ver opciones.`;
        }

        // Update Footer Status Bar
        if (statusCloudIndicator) {
          statusCloudIndicator.classList.remove('hidden');
          if (!this.isSyncing && statusCloudText) {
            statusCloudText.textContent = `☁️ Drive: ${status.userEmail || 'Conectado'}`;
          }
          statusCloudIndicator.title = `Google Drive: Conectado (${status.userEmail}). Clic para sincronizar ahora.`;
        }
      } else {
        notLoggedBox?.classList.remove('hidden');
        loggedBox?.classList.add('hidden');

        if (cloudStatusGroup) cloudStatusGroup.classList.add('hidden');
        if (statusCloudIndicator) statusCloudIndicator.classList.add('hidden');
      }

      if (lastSyncLocalEl) {
        if (status.cloudSyncConfig && status.cloudSyncConfig.lastSync) {
          lastSyncLocalEl.textContent = new Date(status.cloudSyncConfig.lastSync).toLocaleString();
        } else {
          lastSyncLocalEl.textContent = 'Nunca';
        }
      }

      const chkExit = document.getElementById('chk-gdrive-auto-sync-exit');
      const chkSsh = document.getElementById('chk-gdrive-auto-sync-ssh');
      if (chkExit) {
        chkExit.checked = status.cloudSyncConfig?.autoSyncOnExit !== false;
      }
      if (chkSsh) {
        chkSsh.checked = status.cloudSyncConfig?.autoSyncOnSshSave !== false;
      }

      // Indicator for stored master password on this machine
      const masterSavedPill = document.getElementById('gdrive-master-saved-pill');
      const passInput = document.getElementById('gdrive-master-password');
      if (status.hasMasterPassword) {
        masterSavedPill?.classList.remove('hidden');
        if (passInput && !passInput.value) {
          passInput.placeholder = '•••••••• (Contraseña guardada en este equipo)';
        }
      } else {
        masterSavedPill?.classList.add('hidden');
        if (passInput && passInput.placeholder.includes('guardada')) {
          passInput.placeholder = 'Ingresa tu contraseña de cifrado...';
        }
      }

      if (status.isAuthenticated) {
        window.api.gdrive.checkRemote().then((res) => {
          const remoteInfoEl = document.getElementById('gdrive-remote-sync-info');
          if (remoteInfoEl) {
            if (res && res.success && res.remoteFile) {
              const mod = new Date(res.remoteFile.modifiedTime).toLocaleString();
              const sizeKb = (res.remoteFile.size / 1024).toFixed(1);
              remoteInfoEl.textContent = `${mod} (${sizeKb} KB)`;
            } else if (res && res.success) {
              remoteInfoEl.textContent = 'Sin archivo en Drive';
            }
          }
        }).catch(() => {});
      }
    } catch (err) {
      console.warn('Error al actualizar interfaz de Google Drive:', err);
    }
  }

  setSyncingState(isSyncing, success = true) {
    this.isSyncing = isSyncing;
    const btnCloudStatus = document.getElementById('btn-cloud-status');
    const cloudStatusText = document.getElementById('cloud-status-text');
    const statusCloudText = document.getElementById('status-cloud-text');
    const topSyncIcon = document.getElementById('top-sync-icon');
    const leds = document.querySelectorAll('.cloud-status-led');
    const btnGdriveSync = document.getElementById('btn-gdrive-sync-now');
    const btnSshSync = document.getElementById('btn-ssh-sync-now');

    if (isSyncing) {
      if (btnCloudStatus) btnCloudStatus.classList.add('is-syncing');
      if (cloudStatusText) cloudStatusText.textContent = 'Sincronizando...';
      if (statusCloudText) statusCloudText.textContent = '☁️ Sincronizando...';
      if (topSyncIcon) topSyncIcon.classList.add('spin');
      leds.forEach((led) => led.classList.add('syncing'));
      if (btnGdriveSync) {
        btnGdriveSync.disabled = true;
        btnGdriveSync.textContent = '⏳ Sincronizando...';
      }
      if (btnSshSync) {
        btnSshSync.disabled = true;
        btnSshSync.textContent = '⏳ Sincronizando...';
      }
    } else {
      if (btnCloudStatus) btnCloudStatus.classList.remove('is-syncing');
      if (topSyncIcon) topSyncIcon.classList.remove('spin');
      leds.forEach((led) => led.classList.remove('syncing'));
      if (btnGdriveSync) {
        btnGdriveSync.disabled = false;
        btnGdriveSync.textContent = '🔄 Sincronizar Ahora';
      }
      if (btnSshSync) {
        btnSshSync.disabled = false;
        btnSshSync.textContent = '🔄 Sincronizar';
      }

      if (success) {
        if (cloudStatusText) cloudStatusText.textContent = '✓ Sincronizado';
        if (statusCloudText) statusCloudText.textContent = '☁️ Sincronizado';
        setTimeout(() => {
          this.refreshGDriveUI();
        }, 2200);
      } else {
        this.refreshGDriveUI();
      }
    }
  }

  async triggerSyncNow() {
    if (this.isSyncing) return;
    try {
      const status = await window.api.gdrive.getStatus();
      if (!status || !status.isAuthenticated) {
        this.showCloudToast('⚠️ Inicia sesión en Google Drive en Ajustes para sincronizar.');
        this.openSettingsModal('tab-gdrive-opts');
        return;
      }

      const masterPassInput = document.getElementById('gdrive-master-password')?.value;
      const masterPass = (masterPassInput && masterPassInput.trim()) || '';

      if (!masterPass && !status.hasMasterPassword) {
        this.showCloudToast('⚠️ Ingresa tu contraseña maestra en Ajustes > Google Drive para sincronizar.');
        this.openSettingsModal('tab-gdrive-opts');
        document.getElementById('gdrive-master-password')?.focus();
        return;
      }

      this.setSyncingState(true);
      const res = await window.api.gdrive.syncNow(masterPass);

      if (res && res.success) {
        if (Array.isArray(res.profiles)) {
          this.profiles = res.profiles;
          this.renderSshProfilesList();
        }
        this.setSyncingState(false, true);
        this.showCloudToast(`✓ Sincronizado con Google Drive (${res.stats?.profilesCount || 0} perfiles al día)`);
        await this.refreshGDriveUI();
      } else {
        this.setSyncingState(false, false);
        this.showCloudToast(`❌ Error al sincronizar: ${res?.error || 'Desconocido'}`);
      }
    } catch (err) {
      this.setSyncingState(false, false);
      this.showCloudToast(`❌ Error al sincronizar: ${err.message}`);
    }
  }

  async triggerAutoCloudSync(reason) {
    try {
      if (!window.api || !window.api.gdrive) return;
      const status = await window.api.gdrive.getStatus();
      if (!status || !status.isAuthenticated) return;
      if (!status.cloudSyncConfig) return;

      if (reason === 'ssh' && !status.cloudSyncConfig.autoSyncOnSshSave) return;
      if (reason === 'exit' && !status.cloudSyncConfig.autoSyncOnExit) return;

      const masterPassInput = document.getElementById('gdrive-master-password')?.value;
      const masterPass = (masterPassInput && masterPassInput.trim()) || '';

      if (!masterPass && !status.hasMasterPassword) {
        console.warn('Auto-sync omitido: no hay contraseña maestra disponible.');
        return;
      }

      this.setSyncingState(true);
      const res = await window.api.gdrive.uploadSync(masterPass);
      if (res && res.success) {
        console.log(`Sincronización automática con Google Drive (${reason}) completada.`);
        this.setSyncingState(false, true);
        await this.refreshGDriveUI();
      } else if (res && !res.success) {
        this.setSyncingState(false, false);
        console.warn('Auto-sync a Google Drive no completado:', res.error);
      }
    } catch (e) {
      this.setSyncingState(false, false);
      console.warn('Auto-sync a Google Drive omitido:', e.message);
    }
  }

  async autoSyncPullIfAvailable(silent = false) {
    try {
      if (!window.api || !window.api.gdrive || !window.api.gdrive.autoPull) return;
      const res = await window.api.gdrive.autoPull();
      if (res && res.updated && Array.isArray(res.profiles)) {
        this.setSyncingState(true);
        this.profiles = res.profiles;
        this.renderSshProfilesList();
        this.updateStatusBar();
        this.setSyncingState(false, true);
        if (!silent) {
          this.showCloudToast('☁️ Perfiles SSH sincronizados desde Google Drive');
        }
        await this.refreshGDriveUI();
      }
    } catch (e) {
      console.warn('Auto-pull check omitido:', e.message);
    }
  }

  showCloudToast(message, duration = 3500) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>${this.escapeHtml(message)}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  async saveGeneralConfig() {
    this.config.theme = this.cfgThemeSelect.value;
    this.config.defaultShell = this.cfgDefaultShellSelect.value;
    this.config.defaultDir = this.cfgDefaultDirSelect.value;
    this.config.fontSize = parseInt(this.cfgFontSizeInput.value, 10) || 13;
    this.config.fontFamily = this.cfgFontFamilyInput.value.trim() || "Consolas, 'Fira Code', monospace";
    this.config.scrollback = parseInt(this.cfgScrollbackInput.value, 10) || 5000;

    const colorInput = document.getElementById('cfg-ssh-color');
    if (colorInput) {
      this.config.sshHeaderColor = colorInput.value || '#b91c1c';
    }
    this.applySshHeaderColor();

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
    this.closeModal(this.modalSettings);
  }

  populateConfigGroupSelect() {
    if (!this.cfgButtonGroupSelect) return;
    this.cfgButtonGroupSelect.innerHTML = '';
    const groups = this.config.buttonGroups || [];
    groups.forEach((g) => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = `${g.icon || '⚡'} ${g.name}`;
      if (g.id === this.selectedConfigGroupId) {
        opt.selected = true;
      }
      this.cfgButtonGroupSelect.appendChild(opt);
    });

    const curGroup = this.getSelectedConfigGroup();
    if (this.cfgGroupActionsTitle && curGroup) {
      this.cfgGroupActionsTitle.textContent = `Botones del grupo: ${curGroup.icon || ''} ${curGroup.name}`;
    }
  }

  getSelectedConfigGroup() {
    const groups = this.config.buttonGroups || [];
    let group = groups.find((g) => g.id === this.selectedConfigGroupId);
    if (!group && groups.length > 0) {
      group = groups[0];
      this.selectedConfigGroupId = group.id;
    }
    return group;
  }

  renderGitActionsConfig() {
    this.populateConfigGroupSelect();
    this.gitActionsListEl.innerHTML = '';
    const group = this.getSelectedConfigGroup();
    if (!group) return;

    const actions = group.actions || [];

    if (actions.length === 0) {
      this.gitActionsListEl.innerHTML = '<div style="padding:15px; text-align:center; color:var(--text-dim); font-size:12px;">Este grupo aún no tiene botones. Haz clic en <b>+ Nueva Acción</b> para agregar uno.</div>';
      return;
    }

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
      inputCmd.placeholder = 'Comando a ejecutar (ej. top, git status, docker ps)';
      if (act.action === 'user-git') {
        inputCmd.readOnly = true;
      }

      // Buttons container
      const btnsBox = document.createElement('div');
      btnsBox.className = 'git-action-row-btns col-ops';

      // Move Up button
      const btnUp = document.createElement('button');
      btnUp.type = 'button';
      btnUp.className = 'btn-row-order';
      btnUp.innerHTML = '⬆️';
      btnUp.title = 'Mover acción arriba';
      btnUp.disabled = index === 0;
      btnUp.addEventListener('click', async () => {
        const temp = group.actions[index];
        group.actions[index] = group.actions[index - 1];
        group.actions[index - 1] = temp;
        if (group.isGit || group.id === 'group-git') {
          this.config.gitActions = group.actions;
        }
        await window.api.saveConfig(this.config);
        this.renderGitActionsConfig();
        this.refreshAllGitToolbars();
      });

      // Move Down button
      const btnDown = document.createElement('button');
      btnDown.type = 'button';
      btnDown.className = 'btn-row-order';
      btnDown.innerHTML = '⬇️';
      btnDown.title = 'Mover acción abajo';
      btnDown.disabled = index === actions.length - 1;
      btnDown.addEventListener('click', async () => {
        const temp = group.actions[index];
        group.actions[index] = group.actions[index + 1];
        group.actions[index + 1] = temp;
        if (group.isGit || group.id === 'group-git') {
          this.config.gitActions = group.actions;
        }
        await window.api.saveConfig(this.config);
        this.renderGitActionsConfig();
        this.refreshAllGitToolbars();
      });

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
        group.actions.splice(index, 1);
        if (group.isGit || group.id === 'group-git') {
          this.config.gitActions = group.actions;
        }
        this.renderGitActionsConfig();
        this.refreshAllGitToolbars();
      });

      btnsBox.appendChild(btnUp);
      btnsBox.appendChild(btnDown);
      btnsBox.appendChild(btnEdit);
      btnsBox.appendChild(btnDel);

      row.appendChild(chk);
      row.appendChild(inputLabel);
      row.appendChild(inputCmd);
      row.appendChild(btnsBox);

      this.gitActionsListEl.appendChild(row);
    });
  }

  initIconPicker() {
    if (!this.iconPickerPalette) return;
    this.iconPickerPalette.innerHTML = '';
    PRESET_GROUP_ICONS.forEach((ic) => {
      const chip = document.createElement('div');
      chip.className = 'icon-picker-item';
      chip.textContent = ic;
      chip.title = `Seleccionar ${ic}`;
      chip.addEventListener('click', () => {
        if (this.editGroupIconInput) {
          this.editGroupIconInput.value = ic;
          this.updateIconPickerSelection(ic);
        }
      });
      this.iconPickerPalette.appendChild(chip);
    });

    if (this.editGroupIconInput) {
      this.editGroupIconInput.addEventListener('input', () => {
        this.updateIconPickerSelection(this.editGroupIconInput.value.trim());
      });
    }
  }

  updateIconPickerSelection(selectedIcon) {
    if (!this.iconPickerPalette) return;
    const items = this.iconPickerPalette.querySelectorAll('.icon-picker-item');
    items.forEach((item) => {
      if (item.textContent === selectedIcon) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  openCreateGroupModal() {
    this.editGroupModalTitle.textContent = 'Nuevo Grupo de Botones';
    this.editGroupIdInput.value = '';
    this.editGroupNameInput.value = '';
    this.editGroupIconInput.value = '⚡';
    this.updateIconPickerSelection('⚡');
    this.openModal(this.modalEditButtonGroup);
    this.editGroupNameInput.focus();
  }

  openEditGroupModal() {
    const group = this.getSelectedConfigGroup();
    if (!group) return;
    this.editGroupModalTitle.textContent = `Editar Grupo: ${group.name}`;
    this.editGroupIdInput.value = group.id;
    this.editGroupNameInput.value = group.name;
    const icon = group.icon || '⚡';
    this.editGroupIconInput.value = icon;
    this.updateIconPickerSelection(icon);
    this.openModal(this.modalEditButtonGroup);
    this.editGroupNameInput.focus();
  }

  async deleteSelectedGroup() {
    const group = this.getSelectedConfigGroup();
    if (!group) return;
    if (group.id === 'group-git') {
      alert('El grupo predeterminado de Git no se puede eliminar.');
      return;
    }
    if (confirm(`¿Eliminar el grupo "${group.name}" y todos sus comandos?`)) {
      this.config.buttonGroups = this.config.buttonGroups.filter((g) => g.id !== group.id);
      this.selectedConfigGroupId = this.config.buttonGroups[0]?.id || 'group-git';
      await window.api.saveConfig(this.config);
      this.populateConfigGroupSelect();
      this.renderGitActionsConfig();
      this.refreshAllGitToolbars();
    }
  }

  async moveSelectedGroup(direction) {
    if (!this.config.buttonGroups) return;
    const groups = this.config.buttonGroups;
    const idx = groups.findIndex((g) => g.id === this.selectedConfigGroupId);
    if (idx === -1) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= groups.length) return;

    const temp = groups[idx];
    groups[idx] = groups[targetIdx];
    groups[targetIdx] = temp;

    await window.api.saveConfig(this.config);
    this.populateConfigGroupSelect();
    this.renderGitActionsConfig();
    this.refreshAllGitToolbars();
  }

  async handleSaveGroupSubmit() {
    const groupId = this.editGroupIdInput.value;
    const name = this.editGroupNameInput.value.trim();
    const icon = this.editGroupIconInput.value.trim() || '⚡';

    if (!name) {
      alert('Ingresa un nombre para el grupo.');
      return;
    }

    if (!this.config.buttonGroups) this.config.buttonGroups = [];

    if (groupId) {
      const g = this.config.buttonGroups.find((x) => x.id === groupId);
      if (g) {
        g.name = name;
        g.icon = icon;
      }
    } else {
      const newGroup = {
        id: 'group_' + Math.random().toString(36).substring(2, 8),
        name: name,
        icon: icon,
        isGit: false,
        actions: []
      };
      this.config.buttonGroups.push(newGroup);
      this.selectedConfigGroupId = newGroup.id;
    }

    await window.api.saveConfig(this.config);
    this.closeModal(this.modalEditButtonGroup);
    this.renderGitActionsConfig();
    this.refreshAllGitToolbars();
  }

  openCreateGitActionModal() {
    const group = this.getSelectedConfigGroup();
    this.editGitModalIcon.textContent = '➕';
    this.editGitModalTitle.textContent = `Nueva Acción (${group?.name || 'Grupo'})`;
    this.editGitActionIdInput.value = '';
    this.editGitActionLabelInput.value = '';
    this.editGitActionCmdInput.value = group?.isGit ? 'git ' : '';
    this.editGitActionCmdInput.readOnly = false;
    this.openModal(this.modalEditGitAction);
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

    this.openModal(this.modalEditGitAction);
    this.editGitActionLabelInput.focus();
  }

  async resetDefaultGitActions() {
    if (confirm('¿Restaurar todos los grupos y botones predeterminados (Git, Sistema, Docker, Node)?')) {
      this.config.buttonGroups = await window.api.resetButtonGroups();
      const gitGroup = this.config.buttonGroups.find((g) => g.isGit || g.id === 'group-git');
      if (gitGroup) {
        this.config.gitActions = gitGroup.actions;
      }
      this.selectedConfigGroupId = this.config.buttonGroups[0]?.id || 'group-git';
      await window.api.saveConfig(this.config);
      this.renderGitActionsConfig();
      this.refreshAllGitToolbars();
    }
  }

  async saveGitActionsConfig() {
    const group = this.getSelectedConfigGroup();
    if (!group) return;

    const rows = this.gitActionsListEl.querySelectorAll('.git-action-config-row');
    const updated = [];

    rows.forEach((row, i) => {
      const orig = (group.actions && group.actions[i]) || {};
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

    group.actions = updated;
    if (group.isGit || group.id === 'group-git') {
      this.config.gitActions = updated;
    }

    const nonGitSelect = document.getElementById('cfg-default-non-git-group');
    if (nonGitSelect) this.config.defaultNonGitGroup = nonGitSelect.value;
    const autoSwitchChk = document.getElementById('cfg-auto-switch-git');
    if (autoSwitchChk) this.config.autoSwitchGitGroup = autoSwitchChk.checked;

    await window.api.saveConfig(this.config);
    this.refreshAllGitToolbars();
    this.updateAllGitInfo();
    this.closeModal(this.modalSettings);
  }

  refreshAllGitToolbars() {
    for (const termId of this.terminals.keys()) {
      this.updateTerminalActionButtons(termId);
    }
  }

  // ================= FAVORITES MANAGEMENT =================
  renderFavoritesConfig() {
    const listEl = document.getElementById('favorites-list-config');
    if (!listEl) return;
    listEl.innerHTML = '';

    const favs = this.config.favorites || [];
    if (favs.length === 0) {
      listEl.innerHTML = '<div class="fav-empty-msg" style="padding:16px; text-align:center;">No tienes carpetas favoritas guardadas. Haz clic en <b>+ Nueva Carpeta</b> para agregar una.</div>';
      return;
    }

    favs.forEach((fav, index) => {
      const row = document.createElement('div');
      row.className = 'fav-config-row';

      const inputName = document.createElement('input');
      inputName.type = 'text';
      inputName.className = 'fav-input-name';
      inputName.value = fav.name || '';
      inputName.placeholder = 'Nombre';

      const inputPath = document.createElement('input');
      inputPath.type = 'text';
      inputPath.className = 'fav-input-path';
      inputPath.value = fav.path || '';
      inputPath.placeholder = 'Ruta absoluta';

      const btnsBox = document.createElement('div');
      btnsBox.className = 'fav-row-btns col-fav-ops';

      // Move Up button
      const btnUp = document.createElement('button');
      btnUp.type = 'button';
      btnUp.className = 'btn-row-order';
      btnUp.innerHTML = '⬆️';
      btnUp.title = 'Mover favorito arriba';
      btnUp.disabled = index === 0;
      btnUp.addEventListener('click', async () => {
        const temp = this.config.favorites[index];
        this.config.favorites[index] = this.config.favorites[index - 1];
        this.config.favorites[index - 1] = temp;
        await window.api.saveConfig(this.config);
        this.renderFavoritesConfig();
      });

      // Move Down button
      const btnDown = document.createElement('button');
      btnDown.type = 'button';
      btnDown.className = 'btn-row-order';
      btnDown.innerHTML = '⬇️';
      btnDown.title = 'Mover favorito abajo';
      btnDown.disabled = index === favs.length - 1;
      btnDown.addEventListener('click', async () => {
        const temp = this.config.favorites[index];
        this.config.favorites[index] = this.config.favorites[index + 1];
        this.config.favorites[index + 1] = temp;
        await window.api.saveConfig(this.config);
        this.renderFavoritesConfig();
      });

      // Edit dialog button
      const btnEdit = document.createElement('button');
      btnEdit.type = 'button';
      btnEdit.className = 'btn btn-sm btn-primary';
      btnEdit.innerHTML = '✏️';
      btnEdit.title = 'Editar en ventana';
      btnEdit.addEventListener('click', () => {
        this.openAddFavoriteModal(null, fav);
      });

      // Delete button
      const btnDel = document.createElement('button');
      btnDel.type = 'button';
      btnDel.className = 'btn btn-sm btn-danger';
      btnDel.innerHTML = '🗑️';
      btnDel.title = 'Eliminar favorito';
      btnDel.addEventListener('click', async () => {
        if (confirm(`¿Eliminar la carpeta favorita "${fav.name}"?`)) {
          this.config.favorites.splice(index, 1);
          await window.api.saveConfig(this.config);
          this.renderFavoritesConfig();
        }
      });

      btnsBox.appendChild(btnUp);
      btnsBox.appendChild(btnDown);
      btnsBox.appendChild(btnEdit);
      btnsBox.appendChild(btnDel);

      row.appendChild(inputName);
      row.appendChild(inputPath);
      row.appendChild(btnsBox);

      listEl.appendChild(row);
    });
  }

  async saveFavoritesConfig() {
    const listEl = document.getElementById('favorites-list-config');
    if (!listEl) return;
    const rows = listEl.querySelectorAll('.fav-config-row');
    const updated = [];
    rows.forEach((row, i) => {
      const orig = this.config.favorites[i];
      const name = row.querySelector('.fav-input-name').value.trim() || orig?.name || 'Carpeta';
      const folderPath = row.querySelector('.fav-input-path').value.trim() || orig?.path || '';
      updated.push({
        id: orig?.id || 'fav_' + Math.random().toString(36).substring(2, 9),
        name,
        path: folderPath
      });
    });

    this.config.favorites = updated;
    await window.api.saveConfig(this.config);
    this.renderFavoritesConfig();
    this.closeModal(this.modalSettings);
  }

  async openAddFavoriteModal(termId = null, existingFav = null) {
    const modal = document.getElementById('modal-add-favorite');
    const titleEl = document.getElementById('fav-modal-title');
    const idInput = document.getElementById('fav-edit-id');
    const nameInput = document.getElementById('fav-folder-name');
    const pathInput = document.getElementById('fav-folder-path');

    if (!modal) return;

    if (existingFav) {
      if (titleEl) titleEl.textContent = 'Editar Carpeta Favorita';
      idInput.value = existingFav.id || '';
      nameInput.value = existingFav.name || '';
      pathInput.value = existingFav.path || '';
    } else {
      if (titleEl) titleEl.textContent = 'Agregar a Favoritos';
      idInput.value = '';
      let defaultPath = '';
      if (termId) {
        try {
          defaultPath = await window.api.getTerminalCwd(termId);
        } catch (e) {}
      }
      if (!defaultPath && this.homeDir) {
        defaultPath = this.homeDir;
      }
      pathInput.value = defaultPath || '';
      const parts = (defaultPath || '').split(/[\\/]/).filter(Boolean);
      nameInput.value = parts.length > 0 ? parts[parts.length - 1] : 'Mi Carpeta';
    }

    this.openModal(modal);
    nameInput.focus();
    nameInput.select();
  }

  async handleSaveFavoriteSubmit() {
    const idInput = document.getElementById('fav-edit-id');
    const nameInput = document.getElementById('fav-folder-name');
    const pathInput = document.getElementById('fav-folder-path');
    const modal = document.getElementById('modal-add-favorite');

    const id = idInput.value;
    const name = nameInput.value.trim();
    const folderPath = pathInput.value.trim();

    if (!name || !folderPath) {
      alert('Por favor ingresa un nombre y una ruta para la carpeta favorita.');
      return;
    }

    if (!this.config.favorites || !Array.isArray(this.config.favorites)) {
      this.config.favorites = [];
    }

    if (id) {
      const item = this.config.favorites.find((f) => f.id === id);
      if (item) {
        item.name = name;
        item.path = folderPath;
      }
    } else {
      this.config.favorites.push({
        id: 'fav_' + Math.random().toString(36).substring(2, 9),
        name: name,
        path: folderPath
      });
    }

    await window.api.saveConfig(this.config);
    if (modal) this.closeModal(modal);
    this.renderFavoritesConfig();
  }

  // ================= TABS MANAGEMENT =================
  createTab(title = 'Pestaña', layoutTree = null) {
    const tabId = 'tab_' + Math.random().toString(36).substring(2, 9);
    const newTermId = 'term_' + Math.random().toString(36).substring(2, 9);
    
    const initialTree = layoutTree || {
      id: newTermId,
      type: 'terminal',
      title: 'Terminal 1',
      cwd: this.homeDir || null
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

  updateTabSshIndicators() {
    this.tabs.forEach((tab) => {
      const tabEl = document.querySelector(`.tab-item[data-tab-id="${tab.id}"]`);
      if (tabEl) {
        const inSsh = this.isTabInSsh(tab.id);
        tabEl.classList.toggle('tab-ssh-active', inSsh);
        const ledEl = tabEl.querySelector('.tab-ssh-led');
        if (ledEl) {
          ledEl.classList.toggle('hidden', !inSsh);
        }
      }
    });
  }

  renderTabsNav() {
    this.tabsListEl.innerHTML = '';
    this.tabs.forEach((tab) => {
      const tabEl = document.createElement('div');
      tabEl.className = `tab-item ${tab.id === this.activeTabId ? 'active' : ''}`;
      tabEl.setAttribute('data-tab-id', tab.id);

      const sshLed = document.createElement('span');
      sshLed.className = `tab-ssh-led ${this.isTabInSsh(tab.id) ? '' : 'hidden'}`;
      sshLed.title = 'Conexión SSH activa en esta pestaña';

      const titleEl = document.createElement('span');
      titleEl.className = 'tab-title';
      titleEl.textContent = tab.title;
      titleEl.title = 'Doble click o click derecho para renombrar pestaña';

      titleEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.startRenamingTab(tab.id);
      });

      const closeBtn = document.createElement('button');
      closeBtn.className = 'tab-close-btn';
      closeBtn.innerHTML = '&times;';
      closeBtn.title = 'Cerrar pestaña';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeTab(tab.id);
      });

      tabEl.appendChild(sshLed);
      tabEl.appendChild(titleEl);
      tabEl.appendChild(closeBtn);

      tabEl.addEventListener('click', () => {
        this.switchTab(tab.id);
      });

      tabEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showTabContextMenu(e.clientX, e.clientY, tab.id);
      });

      this.tabsListEl.appendChild(tabEl);
    });
  }

  startRenamingTab(tabId) {
    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab) return;

    const tabEl = document.querySelector(`.tab-item[data-tab-id="${tabId}"]`);
    if (!tabEl) return;

    const titleEl = tabEl.querySelector('.tab-title');
    if (!titleEl) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tab-rename-input';
    input.value = tab.title;

    let finished = false;
    const finishRename = () => {
      if (finished) return;
      finished = true;
      const newName = input.value.trim();
      if (newName) {
        tab.title = newName;
      }
      this.renderTabsNav();
      this.updateStatusBar();
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        finishRename();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        finished = true;
        this.renderTabsNav();
      }
    });

    input.addEventListener('blur', () => {
      finishRename();
    });

    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('dblclick', (e) => e.stopPropagation());

    titleEl.replaceWith(input);
    input.focus();
    input.select();
  }

  showTabContextMenu(x, y, tabId) {
    this.contextTargetTabId = tabId;
    if (!this.tabContextMenu) return;

    const renameItem = this.tabContextMenu.querySelector('[data-tab-action="rename"]');
    const saveItem = this.tabContextMenu.querySelector('[data-tab-action="save-tab"]');
    const closeItem = this.tabContextMenu.querySelector('[data-tab-action="close-tab"]');
    const sep1 = document.getElementById('tab-menu-sep-1');
    const sep2 = document.getElementById('tab-menu-sep-2');

    if (renameItem) renameItem.classList.toggle('hidden', !tabId);
    if (saveItem) saveItem.classList.toggle('hidden', !tabId);
    if (closeItem) closeItem.classList.toggle('hidden', !tabId);
    if (sep1) sep1.classList.toggle('hidden', !tabId);
    if (sep2) sep2.classList.toggle('hidden', !tabId);

    this.tabContextMenu.style.left = `${Math.min(window.innerWidth - 180, x)}px`;
    this.tabContextMenu.style.top = `${Math.min(window.innerHeight - 200, y)}px`;
    this.tabContextMenu.classList.remove('hidden');
  }

  hideTabContextMenu() {
    if (this.tabContextMenu) {
      this.tabContextMenu.classList.add('hidden');
    }
    this.contextTargetTabId = null;
  }

  async saveTabState(tabId) {
    const tab = this.tabs.find((t) => t.id === (tabId || this.activeTabId));
    if (!tab) return;

    const defaultName = tab.title || 'Pestaña';
    const name = prompt('Nombre para guardar esta pestaña (con terminales, rutas y sesiones SSH):', defaultName);
    if (!name || !name.trim()) return;

    const cleanTree = await this.serializeTabTree(tab.tree);
    const templateData = {
      name: name.trim(),
      title: tab.title,
      layout: cleanTree,
      savedAt: new Date().toISOString()
    };

    await window.api.saveTabTemplate(name.trim(), templateData);
    alert(`Pestaña "${name.trim()}" guardada exitosamente.`);
    if (this.modalTabLayout && !this.modalTabLayout.classList.contains('hidden')) {
      await this.renderTabTemplatesList();
    }
  }

  async serializeTabTree(node) {
    if (node.type === 'terminal') {
      const inst = this.terminals.get(node.id);
      let cwd = null;
      try {
        cwd = await window.api.getTerminalCwd(node.id);
      } catch (e) {
        cwd = inst ? inst.cwd : null;
      }

      return {
        type: 'terminal',
        title: inst ? inst.title : (node.title || 'Terminal'),
        shellPath: inst ? inst.shellPath : null,
        cwd: cwd || null,
        sshSession: inst ? inst.sshSession : null
      };
    }

    return {
      type: 'split',
      orientation: node.orientation,
      ratio: node.ratio || 0.5,
      first: await this.serializeTabTree(node.first),
      second: await this.serializeTabTree(node.second)
    };
  }

  restoreSavedTab(templateData) {
    const layout = templateData.layout || templateData.tree;
    if (!layout) return;

    const assignFreshIds = (node) => {
      const id = (node.type === 'terminal' ? 'term_' : 'split_') + Math.random().toString(36).substring(2, 9);
      if (node.type === 'terminal') {
        return {
          id,
          type: 'terminal',
          title: node.title || 'Terminal',
          shellPath: node.shellPath || null,
          cwd: node.cwd || null,
          sshSession: node.sshSession || null
        };
      }
      return {
        id,
        type: 'split',
        orientation: node.orientation,
        ratio: node.ratio || 0.5,
        first: assignFreshIds(node.first),
        second: assignFreshIds(node.second)
      };
    };

    const freshTree = assignFreshIds(layout);
    const tabTitle = templateData.title || templateData.name || 'Pestaña';
    this.createTab(tabTitle, freshTree);
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

    shellSelect.addEventListener('pointerdown', (e) => e.stopPropagation());
    shellSelect.addEventListener('mousedown', (e) => e.stopPropagation());
    shellSelect.addEventListener('click', (e) => e.stopPropagation());

    shellSelect.addEventListener('change', async (e) => {
      const chosenPath = e.target.value;
      await this.handleSwitchShell(node.id, chosenPath);
    });

    // 2.3 Favorites Toolbar Button & Dropdown
    const favWrapper = document.createElement('div');
    favWrapper.className = 'fav-select-wrapper';
    favWrapper.id = `fav-wrapper-${node.id}`;

    const btnFav = document.createElement('button');
    btnFav.type = 'button';
    btnFav.className = 'fav-select-btn';
    btnFav.id = `fav-btn-${node.id}`;
    btnFav.title = 'Carpetas Favoritas';
    btnFav.innerHTML = `<svg class="fav-star-icon" width="13" height="13" viewBox="0 0 24 24" fill="#facc15" stroke="#ca8a04" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
    </svg><span class="arrow" style="font-size:9px; opacity:0.7;">▾</span>`;

    const favDropdown = document.createElement('div');
    favDropdown.className = 'fav-dropdown-menu';
    favDropdown.id = `fav-dropdown-${node.id}`;

    btnFav.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.fav-dropdown-menu.show').forEach((m) => {
        if (m !== favDropdown) m.classList.remove('show');
      });
      document.querySelectorAll('.ssh-dropdown-menu.show').forEach((m) => m.classList.remove('show'));
      document.querySelectorAll('.tb-group-dropdown.show').forEach((m) => m.classList.remove('show'));
      document.querySelectorAll('.tb-git-dropdown.show').forEach((m) => m.classList.remove('show'));
      document.querySelectorAll('.tb-git-overflow-menu.show').forEach((m) => m.classList.remove('show'));
      this.populateFavoritesDropdown(favDropdown, node.id);
      favDropdown.classList.toggle('show');
    });

    favWrapper.appendChild(btnFav);
    favWrapper.appendChild(favDropdown);

    // 2.5 SSH Active Badge (Shown when connected to an SSH profile)
    const sshBadge = document.createElement('div');
    sshBadge.className = 'tb-ssh-badge hidden';
    sshBadge.id = `ssh-badge-${node.id}`;
    sshBadge.innerHTML = `
      <span class="ssh-key-icon">🔑</span>
      <span class="ssh-active-led" title="Conexión SSH activa"></span>
      <span class="ssh-badge-name" id="ssh-badge-name-${node.id}"></span>
      <span class="ssh-badge-host" id="ssh-badge-host-${node.id}"></span>
      <button type="button" class="ssh-disconnect-btn" id="ssh-disconnect-${node.id}" title="Desconectar sesión SSH y volver a la terminal local">✕ Desconectar</button>
    `;

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

    // 4.5 Action Button Group Selector Dropdown
    const groupSelectWrapper = document.createElement('div');
    groupSelectWrapper.className = 'tb-group-select-wrapper';
    groupSelectWrapper.id = `group-select-wrapper-${node.id}`;

    const groups = this.config?.buttonGroups || [];
    const defaultNonGitId = this.config?.defaultNonGitGroup || 'group-system';
    const initialGroup = groups.find((g) => g.id === defaultNonGitId) || groups.find((g) => !g.isGit) || groups[0];

    const btnGroup = document.createElement('button');
    btnGroup.type = 'button';
    btnGroup.className = 'tb-group-btn';
    btnGroup.id = `group-btn-${node.id}`;
    btnGroup.title = 'Cambiar grupo de comandos (Git, Sistema, etc.)';
    btnGroup.innerHTML = `<span class="group-icon">${initialGroup?.icon || '⚡'}</span> <span class="group-name">${initialGroup?.name || 'Sistema'}</span> <span class="arrow" style="font-size:9px; opacity:0.7;">▾</span>`;

    const groupDropdown = document.createElement('div');
    groupDropdown.className = 'tb-group-dropdown';
    groupDropdown.id = `group-dropdown-${node.id}`;

    btnGroup.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.tb-group-dropdown.show').forEach((m) => {
        if (m !== groupDropdown) m.classList.remove('show');
      });
      this.populateGroupDropdown(groupDropdown, node.id);
      groupDropdown.classList.toggle('show');
    });

    groupSelectWrapper.appendChild(btnGroup);
    groupSelectWrapper.appendChild(groupDropdown);

    // 5. Configurable Action Buttons
    const gitActions = document.createElement('div');
    gitActions.className = 'tb-git-actions';
    gitActions.id = `git-actions-${node.id}`;
    this.renderTerminalGitActions(gitActions, node.id, initialGroup);

    // 5.5 Overflow Button & Dropdown Menu
    const gitOverflowWrapper = document.createElement('div');
    gitOverflowWrapper.className = 'tb-git-overflow-wrapper hidden';
    gitOverflowWrapper.id = `git-overflow-wrapper-${node.id}`;

    const btnOverflow = document.createElement('button');
    btnOverflow.type = 'button';
    btnOverflow.className = 'tb-git-overflow-btn';
    btnOverflow.id = `git-overflow-btn-${node.id}`;
    btnOverflow.innerHTML = '&raquo;';
    btnOverflow.title = 'Más acciones';

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
    leftGroup.appendChild(favWrapper);
    leftGroup.appendChild(sshBadge);
    leftGroup.appendChild(gitBranchWrapper);
    leftGroup.appendChild(gitUserBtn);
    leftGroup.appendChild(nonGitBadge);
    leftGroup.appendChild(groupSelectWrapper);
    leftGroup.appendChild(gitActions);
    leftGroup.appendChild(gitOverflowWrapper);

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

    header.addEventListener('pointerdown', (e) => {
      if (e.target.closest('select, button, input, textarea, a, .tb-git-overflow-menu, .ssh-dropdown-menu, .tb-git-dropdown')) {
        this.activeTerminalId = node.id;
        document.querySelectorAll('.terminal-pane').forEach((p) => {
          p.classList.toggle('active-pane', p.getAttribute('data-term-id') === node.id);
        });
        this.updateStatusBar();
        return;
      }
      this.setActiveTerminal(node.id);
    });

    body.addEventListener('pointerdown', () => {
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

  populateFavoritesDropdown(dropdownEl, termId) {
    dropdownEl.innerHTML = '';

    // Option 1: Add current folder
    const addItem = document.createElement('div');
    addItem.className = 'fav-dropdown-item fav-add-action';
    addItem.innerHTML = '⭐ <span>+ Agregar carpeta actual a favoritos...</span>';
    addItem.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownEl.classList.remove('show');
      this.openAddFavoriteModal(termId);
    });
    dropdownEl.appendChild(addItem);

    const divider1 = document.createElement('div');
    divider1.className = 'fav-dropdown-divider';
    dropdownEl.appendChild(divider1);

    const favs = this.config.favorites || [];
    if (favs.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'fav-empty-msg';
      empty.textContent = 'No hay carpetas favoritas';
      dropdownEl.appendChild(empty);
    } else {
      favs.forEach((fav) => {
        const item = document.createElement('div');
        item.className = 'fav-dropdown-item';
        item.title = fav.path;
        item.innerHTML = `<span class="fav-icon">📁</span> <span class="fav-item-name">${fav.name}</span> <span class="fav-item-path">${fav.path}</span>`;
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          dropdownEl.classList.remove('show');
          window.api.writeTerminal(termId, `cd "${fav.path.replace(/"/g, '\\"')}"\r`);
          setTimeout(() => this.refreshGitInfo(termId), 400);
        });
        dropdownEl.appendChild(item);
      });
    }

    const divider2 = document.createElement('div');
    divider2.className = 'fav-dropdown-divider';
    dropdownEl.appendChild(divider2);

    const manageItem = document.createElement('div');
    manageItem.className = 'fav-dropdown-item fav-manage-action';
    manageItem.innerHTML = '⚙️ <span>Gestionar favoritos...</span>';
    manageItem.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownEl.classList.remove('show');
      this.openSettingsModal('tab-fav-opts');
    });
    dropdownEl.appendChild(manageItem);
  }

  populateGroupDropdown(dropdownEl, termId) {
    dropdownEl.innerHTML = '';
    const inst = this.terminals.get(termId);
    const groups = this.config.buttonGroups || [];
    const currentGroupId = (inst && inst.activeGroupId) || this.config.activeButtonGroup || 'group-git';

    groups.forEach((g) => {
      const item = document.createElement('div');
      item.className = 'tb-group-dropdown-item';
      if (g.id === currentGroupId) item.classList.add('active');
      item.innerHTML = `<span>${g.icon || '⚡'}</span> <span>${g.name}</span>`;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownEl.classList.remove('show');
        if (inst) inst.activeGroupId = g.id;
        this.updateTerminalActionButtons(termId);
      });
      dropdownEl.appendChild(item);
    });

    const divider = document.createElement('div');
    divider.className = 'tb-group-dropdown-divider';
    dropdownEl.appendChild(divider);

    const manageItem = document.createElement('div');
    manageItem.className = 'tb-group-dropdown-item action';
    manageItem.innerHTML = '⚙️ Configurar grupos...';
    manageItem.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownEl.classList.remove('show');
      this.selectedConfigGroupId = currentGroupId;
      this.openSettingsModal('tab-git-opts');
    });
    dropdownEl.appendChild(manageItem);
  }

  getActiveGroupForTerminal(termId) {
    const inst = this.terminals.get(termId);
    const groups = this.config.buttonGroups || [];
    let currentGroupId = (inst && inst.activeGroupId) || this.config.activeButtonGroup || 'group-git';
    let group = groups.find((g) => g.id === currentGroupId);
    if (!group && groups.length > 0) {
      group = groups[0];
      if (inst) inst.activeGroupId = group.id;
    }
    return group;
  }

  updateTerminalActionButtons(termId) {
    const inst = this.terminals.get(termId);
    const group = this.getActiveGroupForTerminal(termId);
    if (!group) return;

    // Update group button label
    const btnGroup = document.getElementById(`group-btn-${termId}`);
    if (btnGroup) {
      btnGroup.innerHTML = `<span class="group-icon">${group.icon || '⚡'}</span> <span class="group-name">${group.name}</span> <span class="arrow" style="font-size:9px; opacity:0.7;">▾</span>`;
    }

    const branchWrapper = document.getElementById(`git-branch-wrapper-${termId}`);
    const userBtn = document.getElementById(`git-user-btn-${termId}`);
    const gitActions = document.getElementById(`git-actions-${termId}`);
    const nonGitBadge = document.getElementById(`non-git-${termId}`);

    if (gitActions) {
      this.renderTerminalGitActions(gitActions, termId, group);
      gitActions.classList.remove('hidden');
    }

    if (inst && inst.sshSession) {
      if (branchWrapper) branchWrapper.classList.add('hidden');
      if (userBtn) userBtn.classList.add('hidden');
      if (nonGitBadge) nonGitBadge.classList.add('hidden');
    } else {
      const isRepo = Boolean(inst && inst.gitInfo && inst.gitInfo.isRepo);
      // If it's a Git repo, ALWAYS show branch and user, even when button group is changed!
      if (branchWrapper) branchWrapper.classList.toggle('hidden', !isRepo);
      if (userBtn) userBtn.classList.toggle('hidden', !isRepo);
      if (nonGitBadge) nonGitBadge.classList.toggle('hidden', isRepo || !group.isGit);

      if (isRepo && inst.gitInfo) {
        const branchNameEl = branchWrapper?.querySelector('.branch-name');
        if (branchNameEl && inst.gitInfo.branch) {
          branchNameEl.textContent = inst.gitInfo.branch;
        }
        const userNameEl = userBtn?.querySelector('.user-name');
        if (userNameEl && inst.gitInfo.userName) {
          userNameEl.textContent = inst.gitInfo.userName;
        }
      }
    }

    setTimeout(() => this.updateGitButtonsOverflow(termId), 20);
  }

  renderTerminalGitActions(containerEl, termId, group) {
    containerEl.innerHTML = '';
    const inst = this.terminals.get(termId);
    const groups = this.config.buttonGroups || [];
    if (!group) {
      const currentGroupId = (inst && inst.activeGroupId) || this.config.activeButtonGroup || 'group-git';
      group = groups.find((g) => g.id === currentGroupId) || groups[0];
    }
    if (!group) return;

    const actions = group.actions || [];

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

        if (group.isGit) {
          if (act.action === 'user-git') {
            this.openGitUserModal(termId);
            return;
          }

          // Dedicated interactive modal for commit
          if (act.action === 'commit' || act.id === 'act-commit' || act.label.toLowerCase() === 'commit' || (act.cmd && act.cmd.trim().startsWith('git commit'))) {
            this.openGitCommitModal(termId);
            return;
          }

          // Dedicated interactive modal for add
          if (act.action === 'add' || act.id === 'act-add' || act.label.toLowerCase() === 'add' || (act.cmd && act.cmd.trim().startsWith('git add'))) {
            this.openGitAddModal(termId);
            return;
          }

          // Dedicated interactive modal for unstage
          if (act.action === 'unstage' || act.id === 'act-unstage' || act.label.toLowerCase() === 'unstage' || (act.cmd && (act.cmd.trim().startsWith('git reset') || act.cmd.trim().startsWith('git restore --staged')))) {
            this.openGitUnstageModal(termId);
            return;
          }
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
          if (group.isGit) {
            setTimeout(() => this.refreshGitInfo(termId), 500);
          }
        }
      });

      // Right Click: Edit this button's command directly!
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.selectedConfigGroupId = group.id;
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
  updateToolbarSshStatus(termId) {
    const inst = this.terminals.get(termId);
    const sshBadge = document.getElementById(`ssh-badge-${termId}`);
    const termLabel = document.getElementById(`tb-label-${termId}`);
    const shellSelect = document.getElementById(`shell-select-${termId}`);
    const favWrapper = document.getElementById(`fav-wrapper-${termId}`);
    const branchWrapper = document.getElementById(`git-branch-wrapper-${termId}`);
    const userBtn = document.getElementById(`git-user-btn-${termId}`);
    const gitActions = document.getElementById(`git-actions-${termId}`);
    const nonGitBadge = document.getElementById(`non-git-${termId}`);
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

      // Hide local shell select, label, and favorites while in remote SSH
      if (termLabel) termLabel.classList.add('hidden');
      if (shellSelect) shellSelect.classList.add('hidden');
      if (favWrapper) favWrapper.classList.add('hidden');

      // In remote SSH, hide local git branch and user config
      if (branchWrapper) branchWrapper.classList.add('hidden');
      if (userBtn) userBtn.classList.add('hidden');
      if (nonGitBadge) nonGitBadge.classList.add('hidden');

      // Keep button actions visible with current group
      if (gitActions) gitActions.classList.remove('hidden');
    } else {
      sshBadge.classList.add('hidden');
      if (headerEl) headerEl.classList.remove('header-ssh');

      // Restore local shell select, label, and favorites
      if (termLabel) termLabel.classList.remove('hidden');
      if (shellSelect) shellSelect.classList.remove('hidden');
      if (favWrapper) favWrapper.classList.remove('hidden');

      this.refreshGitInfo(termId);
    }

    this.updateTerminalActionButtons(termId);
    setTimeout(() => this.updateGitButtonsOverflow(termId), 20);
    this.updateTabSshIndicators();
    this.updateStatusBar();
  }

  disconnectSshSession(termId) {
    const inst = this.terminals.get(termId);
    if (inst) {
      if (inst.sshPollTimer) {
        clearInterval(inst.sshPollTimer);
        inst.sshPollTimer = null;
      }
      inst.sshSession = null;
      inst.pendingSshSession = null;
      inst.sshShowGit = false;
      inst.title = 'Terminal';
    }
    window.api.writeTerminal(termId, 'exit\r');
    this.updateToolbarSshStatus(termId);
  }

  // ================= GIT INFORMATION & BRANCHES =================
  async refreshGitInfo(termId) {
    try {
      const inst = this.terminals.get(termId);
      if (!inst || inst.sshSession) return;

      const gitInfo = await window.api.getGitInfo(termId);
      const prevInfo = inst.gitInfo;
      inst.gitInfo = gitInfo;

      const isRepo = Boolean(gitInfo && gitInfo.isRepo);
      const wasRepo = Boolean(prevInfo && prevInfo.isRepo);
      const branchChanged = !prevInfo || prevInfo.branch !== gitInfo.branch;
      const userChanged = !prevInfo || prevInfo.userName !== gitInfo.userName;

      const branchWrapper = document.getElementById(`git-branch-wrapper-${termId}`);
      const userBtn = document.getElementById(`git-user-btn-${termId}`);
      const nonGitBadge = document.getElementById(`non-git-${termId}`);

      if (isRepo !== wasRepo) {
        if (branchWrapper) branchWrapper.classList.toggle('hidden', !isRepo);
        if (userBtn) userBtn.classList.toggle('hidden', !isRepo);
        const group = this.getActiveGroupForTerminal ? this.getActiveGroupForTerminal(termId) : null;
        if (nonGitBadge) nonGitBadge.classList.toggle('hidden', isRepo || !group?.isGit);
        this.updateGitButtonsOverflow(termId);
      }

      // Automatic button group switching based on Git repository directory
      if (this.config.autoSwitchGitGroup !== false) {
        const groups = this.config.buttonGroups || [];
        const gitGroup = groups.find((g) => g.isGit || g.id === 'group-git') || groups[0];
        const nonGitGroupId = this.config.defaultNonGitGroup || 'group-system';
        const nonGitGroup = groups.find((g) => g.id === nonGitGroupId) || groups.find((g) => !g.isGit) || groups[0];

        if (isRepo) {
          if (gitGroup && inst.activeGroupId !== gitGroup.id) {
            inst.activeGroupId = gitGroup.id;
            this.updateTerminalActionButtons(termId);
          }
        } else {
          if (nonGitGroup && inst.activeGroupId !== nonGitGroup.id) {
            inst.activeGroupId = nonGitGroup.id;
            this.updateTerminalActionButtons(termId);
          }
        }
      }

      if (isRepo) {
        if (branchChanged) {
          const branchNameEl = branchWrapper?.querySelector('.branch-name');
          if (branchNameEl) branchNameEl.textContent = gitInfo.branch || '...';
        }
        if (userChanged) {
          const userNameEl = userBtn?.querySelector('.user-name');
          if (userNameEl) userNameEl.textContent = gitInfo.userName || 'Git';
        }
      }
    } catch (e) {}
  }

  updateAllGitInfo() {
    for (const termId of this.terminals.keys()) {
      this.refreshGitInfo(termId);
    }
  }

  // ================= GIT COMMIT MODAL =================
  async openGitCommitModal(termId) {
    this.gitCommitTargetTermId = termId;
    const msgInput = document.getElementById('git-commit-msg');
    const chkAll = document.getElementById('git-commit-opt-all');
    const chkAmend = document.getElementById('git-commit-opt-amend');
    const filesList = document.getElementById('git-commit-files-list');
    const stagedBanner = document.getElementById('git-commit-staged-banner');

    if (msgInput) msgInput.value = '';
    if (chkAll) chkAll.checked = false;
    if (chkAmend) chkAmend.checked = false;

    if (filesList) {
      filesList.innerHTML = '<div class="git-empty-files">Cargando lista de archivos...</div>';
    }
    if (stagedBanner) {
      stagedBanner.classList.add('hidden');
      stagedBanner.textContent = '';
    }

    if (this.modalGitCommit) {
      this.openModal(this.modalGitCommit);
    }
    if (msgInput) {
      setTimeout(() => msgInput.focus(), 100);
    }

    this.gitCommitFiles = [];
    try {
      const res = await window.api.getGitStatusFiles(termId);
      if (res && res.isRepo && Array.isArray(res.files)) {
        this.gitCommitFiles = res.files;
        this.renderGitCommitFilesList(res.files);
      } else {
        if (filesList) filesList.innerHTML = '<div class="git-empty-files">No se pudo consultar el repositorio Git.</div>';
      }
    } catch (e) {
      if (filesList) filesList.innerHTML = '<div class="git-empty-files">Error al consultar archivos Git.</div>';
    }

    this.updateGitCommitPreview();
  }

  createGitStatusBadge(code, isStaged = false) {
    const badge = document.createElement('span');
    badge.className = 'git-status-badge';
    const c = (code || '').trim();
    badge.textContent = c;

    if (c === '??') {
      badge.classList.add('badge-untracked');
      badge.title = '[??] Sin seguimiento (Untracked): Archivo nuevo aún no rastreado por Git';
    } else if (c === 'A') {
      badge.classList.add('badge-added');
      badge.title = '[A] Agregado (Added): Archivo nuevo preparado en el área de preparación (staged)';
    } else if (c === 'M') {
      badge.classList.add('badge-modified');
      badge.title = isStaged
        ? '[M] Modificado (Staged): Cambios preparados listos para confirmar'
        : '[M] Modificado (Modified): Archivo con cambios en el directorio de trabajo';
    } else if (c === 'D') {
      badge.classList.add('badge-deleted');
      badge.title = isStaged
        ? '[D] Eliminado (Staged): Archivo borrado preparado para confirmar'
        : '[D] Eliminado (Deleted): Archivo borrado en el directorio de trabajo';
    } else if (c === 'R') {
      badge.classList.add('badge-renamed');
      badge.title = '[R] Renombrado (Renamed): Archivo renombrado o movido';
    } else if (c === 'C') {
      badge.classList.add('badge-renamed');
      badge.title = '[C] Copiado (Copied): Archivo copiado';
    } else {
      badge.classList.add('badge-modified');
      badge.title = `[${c}] Estado Git: ${c}`;
    }

    if (isStaged) {
      badge.classList.add('badge-staged');
    }

    return badge;
  }

  renderGitCommitFilesList(files) {
    const filesList = document.getElementById('git-commit-files-list');
    const stagedBanner = document.getElementById('git-commit-staged-banner');
    if (!filesList) return;

    filesList.innerHTML = '';

    const stagedFiles = files.filter(f => f.isStaged);
    const pendingFiles = files.filter(f => f.isUnstaged || f.isUntracked);

    if (stagedBanner) {
      if (stagedFiles.length > 0) {
        stagedBanner.classList.remove('hidden');
        stagedBanner.innerHTML = `<span>ℹ️ <b>${stagedFiles.length}</b> archivo(s) ya preparado(s) (staged) listos para confirmar.</span>`;
      } else {
        stagedBanner.classList.add('hidden');
      }
    }

    if (pendingFiles.length === 0) {
      if (stagedFiles.length > 0) {
        filesList.innerHTML = '<div class="git-empty-files" style="padding:12px; color:var(--tb-git-text, #4ade80);">✓ Todos los cambios modificados ya están preparados (staged) para el commit.</div>';
      } else {
        filesList.innerHTML = '<div class="git-empty-files">El árbol de trabajo está limpio. No hay archivos pendientes.</div>';
      }
      return;
    }

    pendingFiles.forEach((file) => {
      const row = document.createElement('label');
      row.className = 'git-file-row';

      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.className = 'git-commit-file-chk';
      chk.value = file.path;
      // Default: checked if no files were already staged
      chk.checked = stagedFiles.length === 0;
      chk.addEventListener('change', () => this.updateGitCommitPreview());

      const badge = this.createGitStatusBadge(file.isUntracked ? '??' : (file.y || 'M'), false);

      const pathSpan = document.createElement('span');
      pathSpan.className = 'git-file-path';
      pathSpan.textContent = file.path;
      pathSpan.title = file.path;

      const statusSpan = document.createElement('span');
      statusSpan.className = 'git-file-status-text';
      statusSpan.textContent = file.unstagedLabel || (file.isUntracked ? 'Sin seguimiento' : 'Modificado');

      row.appendChild(chk);
      row.appendChild(badge);
      row.appendChild(pathSpan);
      row.appendChild(statusSpan);
      filesList.appendChild(row);
    });
  }

  updateGitCommitPreview() {
    const msgInput = document.getElementById('git-commit-msg');
    const chkAll = document.getElementById('git-commit-opt-all');
    const chkAmend = document.getElementById('git-commit-opt-amend');
    const previewEl = document.getElementById('git-commit-preview');

    const msg = msgInput ? msgInput.value : '';
    const optAll = chkAll ? chkAll.checked : false;
    const optAmend = chkAmend ? chkAmend.checked : false;

    const checkedBoxes = Array.from(document.querySelectorAll('.git-commit-file-chk:checked'));
    const totalBoxes = Array.from(document.querySelectorAll('.git-commit-file-chk'));
    const selectedFilePaths = checkedBoxes.map(c => c.value);

    let prefixCmd = '';
    if (!optAll && selectedFilePaths.length > 0) {
      if (totalBoxes.length > 0 && selectedFilePaths.length === totalBoxes.length) {
        prefixCmd = 'git add -A && ';
      } else {
        const quoted = selectedFilePaths.map(p => `"${p.replace(/"/g, '\\"')}"`).join(' ');
        prefixCmd = `git add ${quoted} && `;
      }
    }

    let cmd = 'git commit';
    if (optAll) cmd += ' -a';
    if (optAmend) cmd += ' --amend';

    const cleanMsg = msg ? msg.replace(/"/g, '\\"') : '...';
    cmd += ` -m "${cleanMsg}"`;

    if (previewEl) {
      previewEl.textContent = `${prefixCmd}${cmd}`;
    }
  }

  executeGitCommit() {
    const termId = this.gitCommitTargetTermId || this.activeTerminalId;
    if (!termId) return;

    const msgInput = document.getElementById('git-commit-msg');
    const chkAll = document.getElementById('git-commit-opt-all');
    const chkAmend = document.getElementById('git-commit-opt-amend');

    const msg = msgInput ? msgInput.value.trim() : '';
    const optAll = chkAll ? chkAll.checked : false;
    const optAmend = chkAmend ? chkAmend.checked : false;

    if (!msg && !optAmend) {
      alert('Por favor ingresa un mensaje para el commit.');
      return;
    }

    const checkedBoxes = Array.from(document.querySelectorAll('.git-commit-file-chk:checked'));
    const totalBoxes = Array.from(document.querySelectorAll('.git-commit-file-chk'));
    const selectedFilePaths = checkedBoxes.map(c => c.value);

    let prefixCmd = '';
    if (!optAll && selectedFilePaths.length > 0) {
      if (totalBoxes.length > 0 && selectedFilePaths.length === totalBoxes.length) {
        prefixCmd = 'git add -A && ';
      } else {
        const quoted = selectedFilePaths.map(p => `"${p.replace(/"/g, '\\"')}"`).join(' ');
        prefixCmd = `git add ${quoted} && `;
      }
    }

    let cmd = 'git commit';
    if (optAll) cmd += ' -a';
    if (optAmend) cmd += ' --amend';
    if (msg) {
      cmd += ` -m "${msg.replace(/"/g, '\\"')}"`;
    }

    const fullCmd = `${prefixCmd}${cmd}`;
    window.api.writeTerminal(termId, `${fullCmd}\r`);
    if (this.modalGitCommit) {
      this.closeModal(this.modalGitCommit);
    }
    setTimeout(() => this.refreshGitInfo(termId), 600);
  }

  // ================= GIT ADD MODAL =================
  async openGitAddModal(termId) {
    this.gitAddTargetTermId = termId;
    const filesList = document.getElementById('git-add-files-list');
    const chkAll = document.getElementById('git-add-opt-all');
    const btnSubmit = document.getElementById('btn-git-add-submit');

    if (chkAll) chkAll.checked = false;
    if (btnSubmit) btnSubmit.disabled = false;

    if (filesList) {
      filesList.innerHTML = '<div class="git-empty-files">Cargando archivos modificados y sin seguimiento...</div>';
    }

    if (this.modalGitAdd) {
      this.openModal(this.modalGitAdd);
    }

    this.gitAddFiles = [];
    try {
      const res = await window.api.getGitStatusFiles(termId);
      if (res && res.isRepo && Array.isArray(res.files)) {
        this.gitAddFiles = res.files.filter(f => f.isUnstaged || f.isUntracked);
        this.renderGitAddFilesList(this.gitAddFiles);
      } else {
        if (filesList) filesList.innerHTML = '<div class="git-empty-files">No se pudo consultar el repositorio Git.</div>';
        if (btnSubmit) btnSubmit.disabled = true;
      }
    } catch (e) {
      if (filesList) filesList.innerHTML = '<div class="git-empty-files">Error al obtener archivos Git.</div>';
      if (btnSubmit) btnSubmit.disabled = true;
    }

    this.updateGitAddPreview();
  }

  renderGitAddFilesList(files) {
    const filesList = document.getElementById('git-add-files-list');
    const btnSubmit = document.getElementById('btn-git-add-submit');
    if (!filesList) return;

    filesList.innerHTML = '';
    if (files.length === 0) {
      filesList.innerHTML = '<div class="git-empty-files">✓ No hay archivos pendientes para agregar (Árbol de trabajo limpio).</div>';
      if (btnSubmit) btnSubmit.disabled = true;
      return;
    }

    if (btnSubmit) btnSubmit.disabled = false;

    files.forEach((file) => {
      const row = document.createElement('label');
      row.className = 'git-file-row';

      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.className = 'git-add-file-chk';
      chk.value = file.path;
      chk.checked = true;
      chk.addEventListener('change', () => this.updateGitAddPreview());

      const badge = this.createGitStatusBadge(file.isUntracked ? '??' : (file.y || 'M'), false);

      const pathSpan = document.createElement('span');
      pathSpan.className = 'git-file-path';
      pathSpan.textContent = file.path;
      pathSpan.title = file.path;

      const statusSpan = document.createElement('span');
      statusSpan.className = 'git-file-status-text';
      statusSpan.textContent = file.unstagedLabel || (file.isUntracked ? 'Sin seguimiento' : 'Modificado');

      row.appendChild(chk);
      row.appendChild(badge);
      row.appendChild(pathSpan);
      row.appendChild(statusSpan);
      filesList.appendChild(row);
    });
  }

  updateGitAddPreview() {
    const chkAll = document.getElementById('git-add-opt-all');
    const previewEl = document.getElementById('git-add-preview');
    const btnSubmit = document.getElementById('btn-git-add-submit');

    const optAll = chkAll ? chkAll.checked : false;
    const checkedBoxes = Array.from(document.querySelectorAll('.git-add-file-chk:checked'));
    const totalBoxes = Array.from(document.querySelectorAll('.git-add-file-chk'));
    const selectedPaths = checkedBoxes.map(c => c.value);

    let cmd = '';
    if (optAll) {
      cmd = 'git add -A';
      if (btnSubmit) btnSubmit.disabled = false;
    } else if (selectedPaths.length === 0) {
      cmd = '(Selecciona al menos un archivo para agregar)';
      if (btnSubmit) btnSubmit.disabled = true;
    } else if (totalBoxes.length > 0 && selectedPaths.length === totalBoxes.length) {
      cmd = 'git add .';
      if (btnSubmit) btnSubmit.disabled = false;
    } else {
      const quoted = selectedPaths.map(p => `"${p.replace(/"/g, '\\"')}"`).join(' ');
      cmd = `git add ${quoted}`;
      if (btnSubmit) btnSubmit.disabled = false;
    }

    if (previewEl) {
      previewEl.textContent = cmd;
    }
  }

  executeGitAdd() {
    const termId = this.gitAddTargetTermId || this.activeTerminalId;
    if (!termId) return;

    const previewEl = document.getElementById('git-add-preview');
    const cmd = previewEl ? previewEl.textContent.trim() : '';
    if (!cmd || cmd.startsWith('(')) {
      return;
    }

    window.api.writeTerminal(termId, `${cmd}\r`);
    if (this.modalGitAdd) {
      this.closeModal(this.modalGitAdd);
    }
    setTimeout(() => this.refreshGitInfo(termId), 600);
  }

  // ================= GIT UNSTAGE MODAL =================
  async openGitUnstageModal(termId) {
    this.gitUnstageTargetTermId = termId;
    const filesList = document.getElementById('git-unstage-files-list');
    const chkAll = document.getElementById('git-unstage-opt-all');
    const btnSubmit = document.getElementById('btn-git-unstage-submit');

    if (chkAll) chkAll.checked = false;
    if (btnSubmit) btnSubmit.disabled = false;

    if (filesList) {
      filesList.innerHTML = '<div class="git-empty-files">Cargando archivos preparados (staged)...</div>';
    }

    if (this.modalGitUnstage) {
      this.openModal(this.modalGitUnstage);
    }

    this.gitUnstageFiles = [];
    try {
      const res = await window.api.getGitStatusFiles(termId);
      if (res && res.isRepo && Array.isArray(res.files)) {
        this.gitUnstageFiles = res.files.filter(f => f.isStaged);
        this.renderGitUnstageFilesList(this.gitUnstageFiles);
      } else {
        if (filesList) filesList.innerHTML = '<div class="git-empty-files">No se pudo consultar el repositorio Git.</div>';
        if (btnSubmit) btnSubmit.disabled = true;
      }
    } catch (e) {
      if (filesList) filesList.innerHTML = '<div class="git-empty-files">Error al obtener archivos Git.</div>';
      if (btnSubmit) btnSubmit.disabled = true;
    }

    this.updateGitUnstagePreview();
  }

  renderGitUnstageFilesList(files) {
    const filesList = document.getElementById('git-unstage-files-list');
    const btnSubmit = document.getElementById('btn-git-unstage-submit');
    if (!filesList) return;

    filesList.innerHTML = '';
    if (files.length === 0) {
      filesList.innerHTML = '<div class="git-empty-files">✓ No hay archivos en el área de preparación (staged) para quitar.</div>';
      if (btnSubmit) btnSubmit.disabled = true;
      return;
    }

    if (btnSubmit) btnSubmit.disabled = false;

    files.forEach((file) => {
      const row = document.createElement('label');
      row.className = 'git-file-row';

      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.className = 'git-unstage-file-chk';
      chk.value = file.path;
      chk.checked = true;
      chk.addEventListener('change', () => this.updateGitUnstagePreview());

      const badge = this.createGitStatusBadge(file.x || 'M', true);

      const pathSpan = document.createElement('span');
      pathSpan.className = 'git-file-path';
      pathSpan.textContent = file.path;
      pathSpan.title = file.path;

      const statusSpan = document.createElement('span');
      statusSpan.className = 'git-file-status-text';
      statusSpan.textContent = file.stagedLabel || 'Preparado';

      row.appendChild(chk);
      row.appendChild(badge);
      row.appendChild(pathSpan);
      row.appendChild(statusSpan);
      filesList.appendChild(row);
    });
  }

  updateGitUnstagePreview() {
    const chkAll = document.getElementById('git-unstage-opt-all');
    const previewEl = document.getElementById('git-unstage-preview');
    const btnSubmit = document.getElementById('btn-git-unstage-submit');

    const optAll = chkAll ? chkAll.checked : false;
    const checkedBoxes = Array.from(document.querySelectorAll('.git-unstage-file-chk:checked'));
    const totalBoxes = Array.from(document.querySelectorAll('.git-unstage-file-chk'));
    const selectedPaths = checkedBoxes.map(c => c.value);

    let cmd = '';
    if (optAll) {
      cmd = 'git restore --staged .';
      if (btnSubmit) btnSubmit.disabled = false;
    } else if (selectedPaths.length === 0) {
      cmd = '(Selecciona al menos un archivo para quitar)';
      if (btnSubmit) btnSubmit.disabled = true;
    } else if (totalBoxes.length > 0 && selectedPaths.length === totalBoxes.length) {
      cmd = 'git restore --staged .';
      if (btnSubmit) btnSubmit.disabled = false;
    } else {
      const quoted = selectedPaths.map(p => `"${p.replace(/"/g, '\\"')}"`).join(' ');
      cmd = `git restore --staged ${quoted}`;
      if (btnSubmit) btnSubmit.disabled = false;
    }

    if (previewEl) {
      previewEl.textContent = cmd;
    }
  }

  executeGitUnstage() {
    const termId = this.gitUnstageTargetTermId || this.activeTerminalId;
    if (!termId) return;

    const previewEl = document.getElementById('git-unstage-preview');
    const cmd = previewEl ? previewEl.textContent.trim() : '';
    if (!cmd || cmd.startsWith('(')) {
      return;
    }

    window.api.writeTerminal(termId, `${cmd}\r`);
    if (this.modalGitUnstage) {
      this.closeModal(this.modalGitUnstage);
    }
    setTimeout(() => this.refreshGitInfo(termId), 600);
  }

  // ================= GIT BUTTONS OVERFLOW MENU =================
  updateGitButtonsOverflow(termId) {
    const header = document.getElementById(`header-${termId}`);
    const gitActions = document.getElementById(`git-actions-${termId}`);
    const overflowWrapper = document.getElementById(`git-overflow-wrapper-${termId}`);
    const overflowMenu = document.getElementById(`git-overflow-menu-${termId}`);
    if (!header) return;

    const headerWidth = header.clientWidth;
    if (headerWidth === 0) return;

    const isNarrow = headerWidth < 490;
    const isVeryNarrow = headerWidth < 390;

    // Adapt compact mode for header items when width is constrained
    const termLabel = header.querySelector('.tb-label');
    if (termLabel) {
      termLabel.style.display = isNarrow ? 'none' : '';
    }

    const sshHost = header.querySelector('.ssh-badge-host');
    if (sshHost) {
      sshHost.style.display = isNarrow ? 'none' : '';
    }

    const groupBtn = document.getElementById(`group-btn-${termId}`);
    if (groupBtn) {
      const groupName = groupBtn.querySelector('.group-name');
      if (groupName) {
        groupName.style.display = isVeryNarrow ? 'none' : '';
      }
    }

    if (!gitActions || !overflowWrapper || !overflowMenu) return;

    if (gitActions.classList.contains('hidden')) {
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

    // Cache button natural width when it is measured
    for (let i = 0; i < actionButtons.length; i++) {
      const btn = actionButtons[i];
      if (btn.offsetWidth > 0 && !btn.style.display) {
        btn._btnNaturalWidth = btn.offsetWidth + 3;
      } else if (!btn._btnNaturalWidth) {
        btn._btnNaturalWidth = 65;
      }
    }

    const rightGroupLeft = rightGroup.getBoundingClientRect().left;
    const gitActionsLeft = gitActions.getBoundingClientRect().left;
    // Available width for buttons before needing the overflow toggle
    const availableWidth = rightGroupLeft - gitActionsLeft - 38;

    let accumulatedWidth = 0;
    let overflowStartIndex = -1;

    for (let i = 0; i < actionButtons.length; i++) {
      const btn = actionButtons[i];
      const btnWidth = btn._btnNaturalWidth || 65;
      if (accumulatedWidth + btnWidth > availableWidth) {
        overflowStartIndex = i;
        break;
      }
      accumulatedWidth += btnWidth;
    }

    if (overflowStartIndex !== -1) {
      overflowMenu.innerHTML = '';
      for (let i = 0; i < actionButtons.length; i++) {
        const btn = actionButtons[i];
        if (i < overflowStartIndex) {
          btn.style.display = '';
        } else {
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
      }
      // Only show overflow toggle button if there is enough room for it
      if (availableWidth >= 20 || overflowStartIndex > 0) {
        overflowWrapper.classList.remove('hidden');
      } else {
        overflowWrapper.classList.add('hidden');
      }
    } else {
      for (let i = 0; i < actionButtons.length; i++) {
        actionButtons[i].style.display = '';
      }
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
    this.openModal(this.modalGitUser);
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

    // Key event handler for standard terminal shortcuts (Ctrl+Shift+C / Ctrl+Shift+V / Shift+Insert)
    term.attachCustomKeyEventHandler((event) => {
      if (event.type === 'keydown') {
        if (event.ctrlKey && event.shiftKey && (event.key === 'C' || event.key === 'c')) {
          const sel = term.getSelection();
          if (sel) {
            navigator.clipboard.writeText(sel);
            return false;
          }
        }
        if (((event.ctrlKey && event.shiftKey && (event.key === 'V' || event.key === 'v')) ||
             (event.shiftKey && event.key === 'Insert'))) {
          this.pasteToTerminal(node.id);
          return false;
        }
      }
      return true;
    });

    bodyEl.addEventListener('paste', () => {
      const inst = this.terminals.get(node.id);
      if (inst) {
        this.focusTerminal(inst);
      }
    });

    bodyEl.addEventListener('auxclick', (e) => {
      if (e.button === 1) { // Middle click paste in Linux
        e.preventDefault();
        this.setActiveTerminal(node.id);
        this.pasteToTerminal(node.id);
      }
    });

    const cols = term.cols || 80;
    const rows = term.rows || 24;
    const chosenShell = node.shellPath || this.config?.defaultShell || null;

    try {
      const ptyResult = await window.api.createTerminal({
        id: node.id,
        cols,
        rows,
        cwd: node.cwd || null,
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
        if (curInst && (curInst.sshSession || curInst.pendingSshSession)) {
          if (/(Connection to [^\r\n]+ closed|Cerrada la conexi[oó]n a|Connection closed by|logout\r?\n|Killed by signal|Connection timed out|Connection refused|Could not resolve hostname|Name or service not known|Permission denied \(publickey|Host key verification failed|No route to host|Operation timed out)/i.test(data)) {
            if (curInst.sshPollTimer) {
              clearInterval(curInst.sshPollTimer);
              curInst.sshPollTimer = null;
            }
            curInst.sshSession = null;
            curInst.pendingSshSession = null;
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
        pendingSshSession: null,
        sshPollTimer: null,
        sshShowGit: false,
        activeGroupId: this.config.defaultNonGitGroup || 'group-system',
        sshPwdListener: null
      };

      this.terminals.set(node.id, termInfo);
      this.updateTerminalActionButtons(node.id);

      if (node.sshSession) {
        setTimeout(() => {
          this.connectSshProfile(node.id, node.sshSession);
        }, 350);
      }

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

  focusTerminal(inst) {
    if (!inst || !inst.term) return;
    const term = inst.term;
    const doFocus = () => {
      try {
        term.focus();
        if (term.textarea) {
          term.textarea.focus({ preventScroll: true });
        }
      } catch (e) {}
    };

    doFocus();
    requestAnimationFrame(doFocus);
    setTimeout(doFocus, 30);
    setTimeout(doFocus, 100);
    setTimeout(doFocus, 250);
  }

  setActiveTerminal(termId) {
    this.activeTerminalId = termId;

    document.querySelectorAll('.terminal-pane').forEach((p) => {
      p.classList.toggle('active-pane', p.getAttribute('data-term-id') === termId);
    });

    const activeEl = document.activeElement;
    const isXtermTextarea = activeEl && activeEl.classList && activeEl.classList.contains('xterm-helper-textarea');
    const isControlActive = activeEl && !isXtermTextarea && (
      activeEl.tagName === 'SELECT' || 
      activeEl.tagName === 'INPUT' || 
      activeEl.tagName === 'TEXTAREA' || 
      (activeEl.closest && activeEl.closest('.terminal-header'))
    );

    if (!isControlActive) {
      const termObj = this.terminals.get(termId);
      if (termObj && termObj.term) {
        this.focusTerminal(termObj);
      }
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
  async splitTerminal(targetTermId, orientation) {
    const tab = this.tabs.find((t) => t.id === this.activeTabId);
    if (!tab) return;

    let targetCwd = null;
    try {
      targetCwd = await window.api.getTerminalCwd(targetTermId);
    } catch (e) {
      console.warn('Could not query target CWD for split:', e);
    }

    const newTermId = 'term_' + Math.random().toString(36).substring(2, 9);
    const newTermNode = {
      id: newTermId,
      type: 'terminal',
      title: `Terminal ${this.terminals.size + 1}`,
      cwd: targetCwd || null
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
    const inst = this.terminals.get(termId);
    if (inst && (inst.sshSession || inst.pendingSshSession)) {
      const session = inst.sshSession || inst.pendingSshSession;
      this.pendingCloseTermId = termId;
      const modal = document.getElementById('modal-confirm-close-terminal');
      const infoEl = document.getElementById('close-term-ssh-info');
      if (modal && infoEl) {
        const portStr = (session.port && Number(session.port) !== 22) ? `:${session.port}` : '';
        infoEl.innerHTML = `Sesión activa: <b>${this.escapeHtml(session.name || 'SSH')}</b> <span style="font-family:monospace; color:var(--text-dim); font-size:11px;">(${this.escapeHtml(session.username || '')}@${this.escapeHtml(session.host || '')}${portStr})</span>`;
        this.openModal(modal);
        return;
      }
    }

    this.executeCloseTerminal(termId);
  }

  executeCloseTerminal(termId) {
    const inst = this.terminals.get(termId);
    if (inst && (inst.sshSession || inst.pendingSshSession)) {
      try {
        window.api.writeTerminal(termId, 'exit\r');
      } catch (e) {}
    }

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
      if (inst.sshPollTimer) {
        clearInterval(inst.sshPollTimer);
        inst.sshPollTimer = null;
      }
      if (inst.unsubData) inst.unsubData();
      if (inst.unsubExit) inst.unsubExit();
      if (inst.sshPwdListener) inst.sshPwdListener();
      window.api.killTerminal(termId);
      if (inst.term) inst.term.dispose();
      this.terminals.delete(termId);
      this.updateTabSshIndicators();
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
    const targetId = termId || this.activeTerminalId;
    if (!targetId) return;
    const inst = this.terminals.get(targetId);
    if (inst && inst.term) {
      const selection = inst.term.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection);
      }
      this.focusTerminal(inst);
    }
  }

  async pasteToTerminal(termId) {
    const targetId = termId || this.activeTerminalId;
    if (!targetId) return;
    const inst = this.terminals.get(targetId);
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        window.api.writeTerminal(targetId, text);
      }
    } catch (err) {
      console.error('Clipboard paste failed:', err);
    } finally {
      if (inst && inst.term) {
        this.activeTerminalId = targetId;
        document.querySelectorAll('.terminal-pane').forEach((p) => {
          p.classList.toggle('active-pane', p.getAttribute('data-term-id') === targetId);
        });
        this.focusTerminal(inst);
      }
    }
  }

  clearTerminal(termId) {
    const targetId = termId || this.activeTerminalId;
    if (!targetId) return;
    window.api.writeTerminal(targetId, 'clear\r');
    const inst = this.terminals.get(targetId);
    if (inst && inst.term) {
      this.focusTerminal(inst);
    }
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
          setTimeout(() => {
            const currentInst = this.terminals.get(termId);
            if (currentInst && currentInst.term) currentInst.term.focus();
          }, 150);
        }, 120);
      }
    });

    inst.sshPwdListener = () => {
      unsub();
    };
  }

  connectSshProfile(termId, profile) {
    this.setActiveTerminal(termId);
    const inst = this.terminals.get(termId);
    if (inst && inst.term) {
      inst.term.focus();
    }
    setTimeout(() => {
      const currentInst = this.terminals.get(termId);
      if (currentInst && currentInst.term) currentInst.term.focus();
    }, 120);
    setTimeout(() => {
      const currentInst = this.terminals.get(termId);
      if (currentInst && currentInst.term) currentInst.term.focus();
    }, 350);

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

    if (inst) {
      if (inst.sshPollTimer) {
        clearInterval(inst.sshPollTimer);
        inst.sshPollTimer = null;
      }
      inst.pendingSshSession = profile;
      inst.sshSession = null;
      inst.sshShowGit = false;
    }

    // Do NOT set header red or show IP yet (only if connection actually succeeds)
    this.updateToolbarSshStatus(termId);
    this.updateStatusBar();

    window.api.writeTerminal(termId, `${sshCmd}\r`);

    if (inst) {
      let attempts = 0;
      const maxAttempts = 60; // 30 seconds
      inst.sshPollTimer = setInterval(async () => {
        attempts++;
        if (!inst.pendingSshSession) {
          clearInterval(inst.sshPollTimer);
          inst.sshPollTimer = null;
          return;
        }

        try {
          const status = await window.api.getTerminalSshStatus(termId);
          if (status && status.connected) {
            // SSH CONNECTION ESTABLISHED SUCCESSFULLY!
            clearInterval(inst.sshPollTimer);
            inst.sshPollTimer = null;
            inst.sshSession = inst.pendingSshSession;
            inst.pendingSshSession = null;
            inst.title = `SSH: ${profile.name} (${profile.host})`;
            this.updateToolbarSshStatus(termId);
            this.updateStatusBar();
            setTimeout(() => {
              if (inst && inst.term) inst.term.focus();
            }, 60);
            return;
          }

          // If child ssh process ended/failed/cancelled
          if (attempts > 3 && status && !status.hasSsh) {
            clearInterval(inst.sshPollTimer);
            inst.sshPollTimer = null;
            inst.pendingSshSession = null;
            inst.sshSession = null;
            this.updateToolbarSshStatus(termId);
            this.updateStatusBar();
            return;
          }
        } catch (e) {}

        if (attempts >= maxAttempts) {
          clearInterval(inst.sshPollTimer);
          inst.sshPollTimer = null;
          inst.pendingSshSession = null;
          inst.sshSession = null;
          this.updateToolbarSshStatus(termId);
          this.updateStatusBar();
        }
      }, 500);
    }
  }

  populateSshDropdown(menuEl, targetTermId) {
    menuEl.innerHTML = '';
    if (this.profiles.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'ssh-dropdown-item empty';
      empty.textContent = 'Sin perfiles guardados';
      menuEl.appendChild(empty);
    } else {
      this.profiles.forEach((p) => {
        const item = document.createElement('div');
        item.className = 'ssh-dropdown-item';
        const portStr = (p.port && Number(p.port) !== 22) ? `:${p.port}` : '';
        item.innerHTML = `<span class="ssh-item-name" title="${this.escapeHtml(p.name)}">${this.escapeHtml(p.name)}</span><span class="ssh-item-host">${this.escapeHtml(p.username)}@${this.escapeHtml(p.host)}${portStr}</span>`;
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
    this.setActiveTerminal(termId);

    if (inst.sshSession) {
      if (inst.sshSession.id === profile.id || (inst.sshSession.host === profile.host && inst.sshSession.username === profile.username)) {
        alert(`Esta terminal ya se encuentra conectada al perfil "${profile.name}" (${profile.host}).`);
        if (inst.term) inst.term.focus();
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

    this.openModal(this.modalSshSwitch);
  }

  openSshModal() {
    this.sshSearchQuery = '';
    const searchInput = document.getElementById('ssh-search-input');
    if (searchInput) searchInput.value = '';
    const searchClear = document.getElementById('btn-ssh-search-clear');
    if (searchClear) searchClear.classList.add('hidden');

    this.renderSshProfilesList();
    this.clearSshForm();
    this.openModal(this.modalSsh);
    this.autoSyncPullIfAvailable(true);
  }

  renderSshProfilesList() {
    this.sshProfilesListEl.innerHTML = '';
    const currentActiveId = document.getElementById('ssh-id')?.value;
    const q = (this.sshSearchQuery || '').trim().toLowerCase();

    const list = q
      ? this.profiles.filter((p) => {
          const n = (p.name || '').toLowerCase();
          const u = (p.username || '').toLowerCase();
          const h = (p.host || '').toLowerCase();
          return n.includes(q) || u.includes(q) || h.includes(q);
        })
      : this.profiles;

    if (q && list.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.style.cssText = 'padding: 20px 10px; text-align: center; color: var(--text-dim); font-size: 11px;';
      emptyDiv.innerHTML = `No se encontraron perfiles que coincidan con "<b>${this.escapeHtml(q)}</b>"`;
      this.sshProfilesListEl.appendChild(emptyDiv);
      return;
    }

    list.forEach((p, idx) => {
      const card = document.createElement('div');
      card.className = 'profile-card' + (currentActiveId === p.id ? ' active' : '');
      card.setAttribute('draggable', 'true');
      card.setAttribute('data-id', p.id);

      const hasPwd = Boolean(p.password || p.passphrase);
      const isFirst = idx === 0;
      const isLast = idx === list.length - 1;

      const portStr = (p.port && Number(p.port) !== 22) ? `:${p.port}` : '';
      const fullConn = `${p.username}@${p.host}${portStr}`;

      card.innerHTML = `
        <div class="profile-drag-handle" title="Arrastra para reordenar">⋮⋮</div>
        <div class="profile-card-content">
          <div class="profile-card-name" title="${this.escapeHtml(p.name)}">${this.escapeHtml(p.name)} ${hasPwd ? '🔒' : ''}</div>
          <div class="profile-card-details" title="${this.escapeHtml(fullConn)}">${this.escapeHtml(fullConn)}</div>
        </div>
        <div class="profile-card-actions">
          <button type="button" class="btn-card-action btn-card-up" title="Mover arriba" ${isFirst ? 'disabled' : ''}>▲</button>
          <button type="button" class="btn-card-action btn-card-down" title="Mover abajo" ${isLast ? 'disabled' : ''}>▼</button>
          <button type="button" class="btn-card-action btn-card-clone" title="Clonar perfil">📋</button>
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.closest('.profile-card-actions') || e.target.closest('.profile-drag-handle')) return;
        document.querySelectorAll('.profile-card').forEach((c) => c.classList.remove('active'));
        card.classList.add('active');
        this.fillSshForm(p);
      });

      const cloneBtn = card.querySelector('.btn-card-clone');
      if (cloneBtn) {
        cloneBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await this.cloneSshProfile(p);
        });
      }

      const upBtn = card.querySelector('.btn-card-up');
      if (upBtn) {
        upBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await this.moveProfile(p.id, -1);
        });
      }

      const downBtn = card.querySelector('.btn-card-down');
      if (downBtn) {
        downBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await this.moveProfile(p.id, 1);
        });
      }

      // Drag and drop events for reordering
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', p.id);
        e.dataTransfer.effectAllowed = 'move';
        card.classList.add('is-dragging');
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('is-dragging');
        document.querySelectorAll('.profile-card').forEach((c) => c.classList.remove('drag-over-above', 'drag-over-below'));
      });

      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const rect = card.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (e.clientY < midY) {
          card.classList.add('drag-over-above');
          card.classList.remove('drag-over-below');
        } else {
          card.classList.add('drag-over-below');
          card.classList.remove('drag-over-above');
        }
      });

      card.addEventListener('dragleave', () => {
        card.classList.remove('drag-over-above', 'drag-over-below');
      });

      card.addEventListener('drop', async (e) => {
        e.preventDefault();
        card.classList.remove('drag-over-above', 'drag-over-below');
        const draggedId = e.dataTransfer.getData('text/plain');
        if (!draggedId || draggedId === p.id) return;

        const fromIndex = this.profiles.findIndex((pr) => pr.id === draggedId);
        let toIndex = this.profiles.findIndex((pr) => pr.id === p.id);
        if (fromIndex === -1 || toIndex === -1) return;

        const rect = card.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (e.clientY >= midY && toIndex < this.profiles.length - 1 && fromIndex < toIndex) {
          toIndex++;
        }

        const [moved] = this.profiles.splice(fromIndex, 1);
        this.profiles.splice(toIndex, 0, moved);

        await window.api.saveProfiles(this.profiles);
        this.renderSshProfilesList();
        this.triggerAutoCloudSync('ssh');
      });

      this.sshProfilesListEl.appendChild(card);
    });
  }

  async moveProfile(profileId, direction) {
    const idx = this.profiles.findIndex((p) => p.id === profileId);
    if (idx === -1) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= this.profiles.length) return;

    const [moved] = this.profiles.splice(idx, 1);
    this.profiles.splice(targetIdx, 0, moved);

    await window.api.saveProfiles(this.profiles);
    this.renderSshProfilesList();
    this.triggerAutoCloudSync('ssh');
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
    if (this.btnSshClone) this.btnSshClone.classList.add('hidden');
    document.querySelectorAll('.profile-card').forEach((c) => c.classList.remove('active'));
    if (this.sshTestResult) {
      this.sshTestResult.className = 'ssh-test-result-box hidden';
      this.sshTestResult.textContent = '';
    }
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
    if (this.btnSshClone) this.btnSshClone.classList.remove('hidden');
    if (this.sshTestResult) {
      this.sshTestResult.className = 'ssh-test-result-box hidden';
      this.sshTestResult.textContent = '';
    }

    document.querySelectorAll('.profile-card').forEach((c) => {
      if (c.getAttribute('data-id') === p.id) {
        c.classList.add('active');
        c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        c.classList.remove('active');
      }
    });
  }

  async cloneSshProfile(sourceProfile) {
    const src = sourceProfile || this.getSelectedFormProfile();
    if (!src || !src.name) return;

    const cloned = {
      ...JSON.parse(JSON.stringify(src)),
      id: 'ssh_' + Math.random().toString(36).substring(2, 9),
      name: `${src.name} (Copia)`
    };

    this.profiles.push(cloned);
    await window.api.saveProfiles(this.profiles);
    const sshIdInput = document.getElementById('ssh-id');
    if (sshIdInput) sshIdInput.value = cloned.id;
    this.renderSshProfilesList();
    this.fillSshForm(cloned);

    const nameInput = document.getElementById('ssh-name');
    if (nameInput) {
      nameInput.focus();
      nameInput.select();
    }

    this.showCloudToast(`📋 Perfil clonado: ${cloned.name}`);
    this.triggerAutoCloudSync('ssh');
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

  async handleTestSshConnection() {
    if (!this.btnSshTest || !this.sshTestResult) return;
    const host = document.getElementById('ssh-host').value.trim();
    const username = document.getElementById('ssh-username').value.trim();
    const port = parseInt(document.getElementById('ssh-port').value, 10) || 22;
    const authType = document.getElementById('ssh-auth-type').value;
    const password = document.getElementById('ssh-password').value;
    const keyPath = document.getElementById('ssh-key-path').value.trim();
    const passphrase = document.getElementById('ssh-passphrase').value;
    const extraArgs = document.getElementById('ssh-extra-args').value.trim();

    if (!host) {
      this.sshTestResult.className = 'ssh-test-result-box error';
      this.sshTestResult.textContent = '❌ Por favor ingresa el Host / Dirección IP.';
      return;
    }
    if (!username) {
      this.sshTestResult.className = 'ssh-test-result-box error';
      this.sshTestResult.textContent = '❌ Por favor ingresa el Usuario SSH.';
      return;
    }

    this.btnSshTest.disabled = true;
    const originalText = this.btnSshTest.innerHTML;
    this.btnSshTest.innerHTML = '⏳ Probando...';

    this.sshTestResult.className = 'ssh-test-result-box testing';
    this.sshTestResult.innerHTML = `<span>⏳ Conectando con <b>${this.escapeHtml(host)}:${port}</b>...</span>`;

    try {
      const res = await window.api.testSshConnection({
        host,
        port,
        username,
        authType,
        password,
        keyPath,
        passphrase,
        extraArgs
      });

      if (res && res.success) {
        if (res.warning) {
          this.sshTestResult.className = 'ssh-test-result-box warning';
          this.sshTestResult.innerHTML = `<span>⚠️ ${this.escapeHtml(res.message || 'Servidor alcanzable')}</span>`;
        } else {
          this.sshTestResult.className = 'ssh-test-result-box success';
          this.sshTestResult.innerHTML = `<span>✅ ${this.escapeHtml(res.message || 'Conexión exitosa')}</span>`;
        }
      } else {
        this.sshTestResult.className = 'ssh-test-result-box error';
        this.sshTestResult.innerHTML = `<span>❌ ${this.escapeHtml(res?.error || 'Falló la conexión SSH')}</span>`;
      }
    } catch (err) {
      this.sshTestResult.className = 'ssh-test-result-box error';
      this.sshTestResult.innerHTML = `<span>❌ Error inesperado: ${this.escapeHtml(err.message)}</span>`;
    } finally {
      this.btnSshTest.disabled = false;
      this.btnSshTest.innerHTML = originalText;
    }
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
    this.triggerAutoCloudSync('ssh');
  }

  async handleDeleteSshProfile() {
    const id = document.getElementById('ssh-id').value;
    if (!id) return;
    const profile = this.profiles.find((p) => p.id === id);
    const profileName = profile?.name || document.getElementById('ssh-name')?.value.trim() || 'este perfil';
    if (!confirm(`¿Seguro que deseas eliminar el perfil SSH "${profileName}"? Esta acción no se puede deshacer.`)) return;

    this.profiles = this.profiles.filter((p) => p.id !== id);
    await window.api.saveProfiles(this.profiles);
    this.renderSshProfilesList();
    this.clearSshForm();
    this.triggerAutoCloudSync('ssh');
    this.showCloudToast(`🗑️ Perfil "${profileName}" eliminado`);
  }

  // ================= GENERAL SESSIONS =================
  async openSessionModal() {
    await this.renderSessionsList();
    this.openModal(this.modalSession);
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
        this.closeModal(this.modalSession);
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

    const savedTabs = [];
    for (const tab of this.tabs) {
      savedTabs.push({
        title: tab.title,
        tree: await this.serializeTabTree(tab.tree)
      });
    }

    const sessionData = {
      activeTabTitle: this.tabs.find((t) => t.id === this.activeTabId)?.title,
      tabs: savedTabs
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
          shellPath: node.shellPath || null,
          cwd: node.cwd || null,
          sshSession: node.sshSession || null
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

  // ================= TAB LAYOUT TEMPLATES & SAVED TABS =================
  async openTabLayoutModal() {
    const tab = this.tabs.find((t) => t.id === this.activeTabId);
    const input = document.getElementById('new-tab-template-name');
    if (input && tab) {
      input.value = tab.title || '';
    }
    await this.renderTabTemplatesList();
    this.openModal(this.modalTabLayout);
  }

  async renderTabTemplatesList() {
    const container = document.getElementById('tab-templates-list');
    container.innerHTML = '<div class="empty-msg">Cargando pestañas guardadas...</div>';

    const templates = await window.api.getTabTemplates();
    const templateKeys = Object.keys(templates || {});

    if (templateKeys.length === 0) {
      container.innerHTML = '<div class="empty-msg">No hay pestañas guardadas todavía. Haz clic derecho en una pestaña y selecciona "Guardar pestaña".</div>';
      return;
    }

    container.innerHTML = '';
    templateKeys.forEach((key) => {
      const tmpl = templates[key];
      const row = document.createElement('div');
      row.className = 'saved-item-row';

      // Count terminals & SSH
      const countTerminals = (node) => {
        if (!node) return { count: 0, ssh: 0 };
        if (node.type === 'terminal') {
          return { count: 1, ssh: node.sshSession ? 1 : 0 };
        }
        const f = countTerminals(node.first);
        const s = countTerminals(node.second);
        return { count: f.count + s.count, ssh: f.ssh + s.ssh };
      };

      const stats = countTerminals(tmpl.layout);
      const sshText = stats.ssh > 0 ? ` • 🔑 ${stats.ssh} sesión(es) SSH` : '';
      const dateText = tmpl.savedAt ? new Date(tmpl.savedAt).toLocaleDateString() : '';

      const info = document.createElement('div');
      info.innerHTML = `
        <div class="saved-item-title" style="font-weight:600; color:var(--text-main);">${tmpl.name || tmpl.title}</div>
        <div class="saved-item-meta" style="font-size:11px; color:var(--text-muted);">${stats.count} terminal(es)${sshText} ${dateText ? '• Guardada el ' + dateText : ''}</div>
      `;

      const actions = document.createElement('div');
      actions.className = 'saved-item-actions';
      actions.style.display = 'flex';
      actions.style.gap = '6px';

      const btnOpen = document.createElement('button');
      btnOpen.className = 'btn btn-sm btn-primary';
      btnOpen.innerHTML = '📂 Abrir Pestaña';
      btnOpen.title = 'Abrir como una nueva pestaña con sus terminales, rutas y sesiones SSH';
      btnOpen.addEventListener('click', () => {
        this.restoreSavedTab(tmpl);
        this.closeModal(this.modalTabLayout);
      });

      actions.appendChild(btnOpen);

      if (!['Single Terminal', '2 Terminals Vertical', '2 Terminals Horizontal', '4 Terminals (2x2 Grid)'].includes(tmpl.name)) {
        const btnDelete = document.createElement('button');
        btnDelete.className = 'btn btn-sm btn-danger';
        btnDelete.textContent = '✕';
        btnDelete.title = 'Eliminar pestaña guardada';
        btnDelete.addEventListener('click', async () => {
          if (confirm(`¿Eliminar la pestaña guardada "${tmpl.name || tmpl.title}"?`)) {
            await window.api.deleteTabTemplate(tmpl.name || tmpl.title);
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
      alert('Ingresa un nombre para guardar la pestaña.');
      return;
    }

    const tab = this.tabs.find((t) => t.id === this.activeTabId);
    if (!tab) return;

    const cleanTree = await this.serializeTabTree(tab.tree);
    const templateData = {
      name: name,
      title: tab.title || name,
      layout: cleanTree,
      savedAt: new Date().toISOString()
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
