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
    this.tabs = [];
    this.activeTabId = null;
    this.activeTerminalId = null;
    this.terminals = new Map(); // id -> { term, fitAddon, ptyId, container, headerEl, title }
    this.profiles = [];
    this.contextTargetTermId = null;

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

    // Modals
    this.modalSsh = document.getElementById('modal-ssh');
    this.modalSession = document.getElementById('modal-session');
    this.modalTabLayout = document.getElementById('modal-tab-layout');

    // SSH Form elements
    this.sshForm = document.getElementById('ssh-profile-form');
    this.sshProfilesListEl = document.getElementById('ssh-profiles-list');
    this.sshAuthTypeSelect = document.getElementById('ssh-auth-type');
    this.sshKeyGroup = document.getElementById('group-ssh-key');
    this.btnSshDelete = document.getElementById('btn-ssh-delete');
    this.btnSshConnectActive = document.getElementById('btn-ssh-connect-active');
  }

  async loadInitialData() {
    // Load SSH profiles
    try {
      this.profiles = await window.api.getProfiles();
      this.renderSshProfilesList();
    } catch (e) {
      console.error('Error loading SSH profiles:', e);
      this.profiles = [];
    }

    // Create first default tab
    this.createTab('Principal');

    // Listen to window resizing to auto-fit all active xterm instances
    window.addEventListener('resize', () => {
      this.fitAllTerminals();
    });
  }

  bindGlobalEvents() {
    // New tab button
    this.btnNewTab.addEventListener('click', () => {
      this.createTab(`Pestaña ${this.tabs.length + 1}`);
    });

    // Top action buttons
    document.getElementById('btn-ssh-manager').addEventListener('click', () => {
      this.openSshModal();
    });

    document.getElementById('btn-global-sessions').addEventListener('click', () => {
      this.openSessionModal();
    });

    document.getElementById('btn-tab-layouts').addEventListener('click', () => {
      this.openTabLayoutModal();
    });

    // Close buttons on modals
    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close-modal');
        document.getElementById(modalId).classList.add('hidden');
      });
    });

    // Close modals on backdrop click
    document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
      backdrop.addEventListener('click', (e) => {
        e.target.closest('.modal').classList.add('hidden');
      });
    });

    // SSH form auth type toggle
    this.sshAuthTypeSelect.addEventListener('change', (e) => {
      this.sshKeyGroup.style.display = e.target.value === 'key' ? 'block' : 'none';
    });

    // SSH form submit
    this.sshForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSaveSshProfile();
    });

    // Delete SSH profile
    this.btnSshDelete.addEventListener('click', () => {
      this.handleDeleteSshProfile();
    });

    // SSH Connect in active terminal
    this.btnSshConnectActive.addEventListener('click', () => {
      const profile = this.getSelectedFormProfile();
      if (profile && this.activeTerminalId) {
        this.connectSshProfile(this.activeTerminalId, profile);
        this.modalSsh.classList.add('hidden');
      } else if (!this.activeTerminalId) {
        alert('Selecciona o haz clic en una terminal primero.');
      }
    });

    // SSH Add new profile button
    document.getElementById('btn-ssh-add-new').addEventListener('click', () => {
      this.clearSshForm();
    });

    // Save current overall session
    document.getElementById('btn-save-current-session').addEventListener('click', () => {
      this.handleSaveSession();
    });

    // Save current tab template
    document.getElementById('btn-save-tab-template').addEventListener('click', () => {
      this.handleSaveTabTemplate();
    });

    // Hide context menu on global click
    document.addEventListener('click', (e) => {
      if (!this.contextMenu.contains(e.target)) {
        this.hideContextMenu();
      }
      // Hide open SSH dropdowns
      if (!e.target.closest('.ssh-select-wrapper')) {
        document.querySelectorAll('.ssh-dropdown-menu.show').forEach((m) => m.classList.remove('show'));
      }
    });

    // Context menu actions
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
          // Terminator standard: Ctrl+Shift+O = Split Horizontal
          e.preventDefault();
          if (this.activeTerminalId) this.splitTerminal(this.activeTerminalId, 'horizontal');
        } else if (e.key === 'E' || e.key === 'e') {
          // Terminator standard: Ctrl+Shift+E = Split Vertical
          e.preventDefault();
          if (this.activeTerminalId) this.splitTerminal(this.activeTerminalId, 'vertical');
        } else if (e.key === 'W' || e.key === 'w') {
          e.preventDefault();
          if (this.activeTerminalId) this.closeTerminal(this.activeTerminalId);
        }
      }
    });
  }

  // ================= TABS MANAGEMENT =================
  createTab(title = 'Pestaña', layoutTree = null) {
    const tabId = 'tab_' + Math.random().toString(36).substring(2, 9);
    
    // Default initial tree is a single terminal
    const initialTree = layoutTree || {
      id: 'term_' + Math.random().toString(36).substring(2, 9),
      type: 'terminal',
      title: 'Terminal 1'
    };

    const tab = {
      id: tabId,
      title: title,
      tree: initialTree,
      terminalsCount: 0
    };

    this.tabs.push(tab);

    // Create DOM view container for this tab
    const tabView = document.createElement('div');
    tabView.id = `view-${tabId}`;
    tabView.className = 'tab-view';
    this.workspaceEl.appendChild(tabView);

    this.renderTabsNav();
    this.switchTab(tabId);
    this.renderTabWorkspace(tabId);

    return tab;
  }

  switchTab(tabId) {
    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab) return;

    this.activeTabId = tabId;

    // Update Tab UI classes
    document.querySelectorAll('.tab-item').forEach((el) => {
      el.classList.toggle('active', el.getAttribute('data-tab-id') === tabId);
    });

    // Update Tab Views
    document.querySelectorAll('.tab-view').forEach((el) => {
      el.classList.toggle('active', el.id === `view-${tabId}`);
    });

    this.updateStatusBar();
    this.fitAllTerminals();
  }

  closeTab(tabId) {
    if (this.tabs.length <= 1) {
      alert('No puedes cerrar la última pestaña abierta.');
      return;
    }

    const tabIndex = this.tabs.findIndex((t) => t.id === tabId);
    if (tabIndex === -1) return;

    // Cleanup all terminals inside this tab
    const tab = this.tabs[tabIndex];
    this.destroySubtreeTerminals(tab.tree);

    // Remove DOM view
    const viewEl = document.getElementById(`view-${tabId}`);
    if (viewEl) viewEl.remove();

    this.tabs.splice(tabIndex, 1);

    // Switch to another tab
    const nextTab = this.tabs[Math.max(0, tabIndex - 1)];
    this.renderTabsNav();
    this.switchTab(nextTab.id);
  }

  renderTabsNav() {
    this.tabsListEl.innerHTML = '';
    this.tabs.forEach((tab) => {
      const tabEl = document.createElement('div');
      tabEl.className = `tab-item ${tab.id === this.activeTabId ? 'active' : ''}`;
      tabEl.setAttribute('data-tab-id', tab.id);

      const titleEl = document.createElement('span');
      titleEl.className = 'tab-title';
      titleEl.textContent = tab.title;

      // Double click to rename tab
      titleEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const newName = prompt('Renombrar pestaña:', tab.title);
        if (newName && newName.trim()) {
          tab.title = newName.trim();
          titleEl.textContent = tab.title;
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

    // After DOM inserted, instantiate terminals that need rendering
    this.initUnmountedTerminals(tab.tree);
    this.fitAllTerminals();
  }

  buildSplitDom(node, tabId) {
    if (node.type === 'terminal') {
      return this.createTerminalPaneDom(node, tabId);
    }

    // Split container
    const container = document.createElement('div');
    container.className = `split-box ${node.orientation}`;
    container.setAttribute('data-node-id', node.id);

    // First child
    const firstWrapper = document.createElement('div');
    firstWrapper.className = 'split-child first-child';
    const firstRatio = (node.ratio || 0.5) * 100;
    firstWrapper.style.flex = `0 0 calc(${firstRatio}% - 2px)`;
    firstWrapper.appendChild(this.buildSplitDom(node.first, tabId));

    // Splitter
    const splitter = document.createElement('div');
    splitter.className = 'splitter';
    this.bindSplitterDrag(splitter, node, firstWrapper, container);

    // Second child
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

    const onPointerDown = (e) => {
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

      // Constrain ratio between 10% and 90%
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

  createTerminalPaneDom(node, tabId) {
    const pane = document.createElement('div');
    pane.className = `terminal-pane ${this.activeTerminalId === node.id ? 'active-pane' : ''}`;
    pane.id = `pane-${node.id}`;
    pane.setAttribute('data-term-id', node.id);

    // Terminal Header / Toolbar
    const header = document.createElement('div');
    header.className = 'terminal-header';

    // Left info
    const titleArea = document.createElement('div');
    titleArea.className = 'terminal-title-area';
    
    const badge = document.createElement('span');
    badge.className = 'terminal-badge';
    badge.textContent = 'LOCAL';
    badge.id = `badge-${node.id}`;

    const titleText = document.createElement('span');
    titleText.className = 'terminal-title-text';
    titleText.textContent = node.title || 'Terminal';
    titleText.id = `title-${node.id}`;

    titleArea.appendChild(badge);
    titleArea.appendChild(titleText);

    // Right toolbar buttons
    const tools = document.createElement('div');
    tools.className = 'terminal-tools';

    // Split Vertical button
    const btnSplitV = document.createElement('button');
    btnSplitV.className = 'term-tool-btn';
    btnSplitV.innerHTML = '⬌ V';
    btnSplitV.title = 'Dividir Verticalmente (Ctrl+Shift+E)';
    btnSplitV.addEventListener('click', (e) => {
      e.stopPropagation();
      this.splitTerminal(node.id, 'vertical');
    });

    // Split Horizontal button
    const btnSplitH = document.createElement('button');
    btnSplitH.className = 'term-tool-btn';
    btnSplitH.innerHTML = '⬍ H';
    btnSplitH.title = 'Dividir Horizontalmente (Ctrl+Shift+O)';
    btnSplitH.addEventListener('click', (e) => {
      e.stopPropagation();
      this.splitTerminal(node.id, 'horizontal');
    });

    // SSH Dropdown Menu
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
      // Close other dropdowns
      document.querySelectorAll('.ssh-dropdown-menu.show').forEach((m) => {
        if (m !== sshDropdown) m.classList.remove('show');
      });
      this.populateSshDropdown(sshDropdown, node.id);
      sshDropdown.classList.toggle('show');
    });

    sshWrapper.appendChild(btnSsh);
    sshWrapper.appendChild(sshDropdown);

    // Close terminal button
    const btnClose = document.createElement('button');
    btnClose.className = 'term-tool-btn danger';
    btnClose.innerHTML = '✕';
    btnClose.title = 'Cerrar esta terminal (Ctrl+Shift+W)';
    btnClose.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeTerminal(node.id);
    });

    tools.appendChild(btnSplitV);
    tools.appendChild(btnSplitH);
    tools.appendChild(sshWrapper);
    tools.appendChild(btnClose);

    header.appendChild(titleArea);
    header.appendChild(tools);

    // Terminal Body Container for xterm
    const body = document.createElement('div');
    body.className = 'terminal-body';
    body.id = `body-${node.id}`;

    pane.appendChild(header);
    pane.appendChild(body);

    // Click inside pane activates it
    pane.addEventListener('pointerdown', () => {
      this.setActiveTerminal(node.id);
    });

    // Right-click context menu
    pane.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showContextMenu(e.clientX, e.clientY, node.id);
    });

    return pane;
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
          this.connectSshProfile(targetTermId, p);
        });
        menuEl.appendChild(item);
      });
    }

    // Link to open manager
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

  // ================= TERMINAL INSTANCES =================
  initUnmountedTerminals(node) {
    if (node.type === 'terminal') {
      if (!this.terminals.has(node.id)) {
        this.mountTerminal(node);
      } else {
        // If already exists, re-attach to the new DOM node if needed
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

    // Create xterm instance
    const term = new TerminalClass({
      theme: {
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
      },
      fontFamily: 'Consolas, "Fira Code", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 5000,
      allowTransparency: true
    });

    const fitAddon = FitAddonClass ? new FitAddonClass() : null;
    const webLinksAddon = WebLinksAddonClass ? new WebLinksAddonClass() : null;

    if (fitAddon) term.loadAddon(fitAddon);
    if (webLinksAddon) term.loadAddon(webLinksAddon);

    term.open(bodyEl);
    fitAddon.fit();

    // Create backend PTY
    const cols = term.cols || 80;
    const rows = term.rows || 24;

    try {
      const ptyResult = await window.api.createTerminal({
        id: node.id,
        cols,
        rows,
        initialCommand: node.initialCommand || null
      });

      // Bind data sending
      term.onData((data) => {
        window.api.writeTerminal(node.id, data);
      });

      // Bind data receiving from pty
      const unsubData = window.api.onTerminalData(node.id, (data) => {
        term.write(data);
      });

      // Bind exit listener
      const unsubExit = window.api.onTerminalExit(node.id, ({ exitCode }) => {
        term.write(`\r\n\x1b[33m[Proceso finalizado con código ${exitCode}]\x1b[0m\r\n`);
      });

      // On terminal focus
      term.onSelectionChange(() => {
        // selection changed
      });

      const termInfo = {
        term,
        fitAddon,
        ptyId: node.id,
        unsubData,
        unsubExit,
        title: node.title || 'Terminal'
      };

      this.terminals.set(node.id, termInfo);

      // Auto-set as active if none is active
      if (!this.activeTerminalId) {
        this.setActiveTerminal(node.id);
      }

      setTimeout(() => {
        fitAddon.fit();
      }, 50);
    } catch (err) {
      console.error('Failed to create terminal backend:', err);
      term.write(`\r\n\x1b[31mError al iniciar la consola: ${err.message}\x1b[0m\r\n`);
    }
  }

  setActiveTerminal(termId) {
    this.activeTerminalId = termId;

    // Highlight pane in DOM
    document.querySelectorAll('.terminal-pane').forEach((p) => {
      p.classList.toggle('active-pane', p.getAttribute('data-term-id') === termId);
    });

    const termObj = this.terminals.get(termId);
    if (termObj && termObj.term) {
      termObj.term.focus();
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
          orientation: orientation, // 'horizontal' or 'vertical'
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
    this.renderTabWorkspace(this.activeTabId);
    this.setActiveTerminal(newTermId);
  }

  closeTerminal(termId) {
    const tab = this.tabs.find((t) => t.id === this.activeTabId);
    if (!tab) return;

    // If it's the root and only terminal of the tab:
    if (tab.tree.id === termId && tab.tree.type === 'terminal') {
      if (this.tabs.length > 1) {
        this.closeTab(tab.id);
      } else {
        // Can't close last terminal in last tab, restart clean
        this.destroyTerminalInstance(termId);
        const newId = 'term_' + Math.random().toString(36).substring(2, 9);
        tab.tree = { id: newId, type: 'terminal', title: 'Terminal 1' };
        this.renderTabWorkspace(tab.id);
        this.setActiveTerminal(newId);
      }
      return;
    }

    // Find parent in split tree and replace with the other sibling
    const removeFromTree = (node) => {
      if (node.type !== 'split') return node;

      if (node.first.id === termId) {
        return node.second;
      }
      if (node.second.id === termId) {
        return node.first;
      }

      node.first = removeFromTree(node.first);
      node.second = removeFromTree(node.second);
      return node;
    };

    this.destroyTerminalInstance(termId);
    tab.tree = removeFromTree(tab.tree);

    // Pick another terminal to activate
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

    // Build SSH submenu in context menu
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

  // ================= SSH PROFILES =================
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

    // Send command to the active terminal
    window.api.writeTerminal(termId, `${sshCmd}\r`);

    // Update UI title and badge
    const badgeEl = document.getElementById(`badge-${termId}`);
    const titleEl = document.getElementById(`title-${termId}`);
    if (badgeEl) {
      badgeEl.textContent = 'SSH';
      badgeEl.style.backgroundColor = 'rgba(0, 173, 181, 0.25)';
    }
    if (titleEl) {
      titleEl.textContent = `${profile.name} (${profile.host})`;
    }

    const inst = this.terminals.get(termId);
    if (inst) {
      inst.title = `SSH: ${profile.name}`;
    }
    this.updateStatusBar();
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
      card.innerHTML = `
        <div class="profile-card-name">${p.name}</div>
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
    document.getElementById('ssh-key-path').value = '';
    document.getElementById('ssh-extra-args').value = '';
    this.sshKeyGroup.style.display = 'none';
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
    document.getElementById('ssh-key-path').value = p.keyPath || '';
    document.getElementById('ssh-extra-args').value = p.extraArgs || '';
    this.sshKeyGroup.style.display = p.authType === 'key' ? 'block' : 'none';
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
      keyPath: document.getElementById('ssh-key-path').value.trim(),
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

  // ================= GENERAL SESSIONS (PERSISTENCE) =================
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
        title: inst ? inst.title : node.title
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

    // Destroy all current terminals and tabs
    this.tabs.forEach((tab) => {
      this.destroySubtreeTerminals(tab.tree);
      const view = document.getElementById(`view-${tab.id}`);
      if (view) view.remove();
    });
    this.tabs = [];
    this.terminals.clear();

    // Rebuild tree assigning fresh runtime IDs
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

      // Only allow deleting user-created templates
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

    // Destroy existing terminals in this tab
    this.destroySubtreeTerminals(tab.tree);

    // Assign fresh IDs to template tree
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

// Bootstrap application once DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  window.appInstance = new TuxTerminalApp();
});
