/**
 * app.js
 * Controller principal: inicializa tudo, vincula eventos, faz o boot
 */

// ===== REFERÊNCIAS DOM =====
const el = {
    loadingScreen:    document.getElementById('loadingScreen'),
    loadingBar:       document.getElementById('loadingBar'),
    loadingStatus:    document.getElementById('loadingStatus'),
    loadingError:     document.getElementById('loadingError'),
    app:              document.getElementById('app'),
    loginModal:       document.getElementById('loginModal'),
    loginInput:       document.getElementById('loginInput'),
    pinSection:       document.getElementById('pinSection'),
    pinInput:         document.getElementById('pinInput'),
    pinHint:          document.getElementById('pinHint'),
    loginSubtitle:    document.getElementById('loginSubtitle'),
    btnLogin:         document.getElementById('btnLogin'),
    loginStatus:      document.getElementById('loginStatus'),
    userName:         document.getElementById('userName'),
    btnChangeUser:    document.getElementById('btnChangeUser'),
    apiStatusBadge:   document.getElementById('apiStatusBadge'),
    backupBadge:      document.getElementById('backupBadge'),
    syncBadge:        document.getElementById('syncBadge'),
    recipeSearch:     document.getElementById('recipeSearch'),
    categoryFilter:   document.getElementById('categoryFilter'),
    progressFilter:   document.getElementById('progressFilter'),
    recipesGrid:      document.getElementById('recipesGrid'),
    recipesStats:     document.getElementById('recipesStats'),
    inventorySearch:  document.getElementById('inventorySearch'),
    inventoryList:    document.getElementById('inventoryList'),
    inventoryStats:   document.getElementById('inventoryStats'),
    btnAddItem:       document.getElementById('btnAddItem'),
    addItemModal:     document.getElementById('addItemModal'),
    addItemSearch:    document.getElementById('addItemSearch'),
    addItemList:      document.getElementById('addItemList'),
    recipeDetailModal:document.getElementById('recipeDetailModal'),
    recipeDetailTitle:document.getElementById('recipeDetailTitle'),
    recipeDetailBody: document.getElementById('recipeDetailBody'),
    btnImportExport:  document.getElementById('btnImportExport'),
    importExportModal:document.getElementById('importExportModal'),
    exportData:       document.getElementById('exportData'),
    importData:       document.getElementById('importData'),
    btnCopyExport:    document.getElementById('btnCopyExport'),
    btnImport:        document.getElementById('btnImport'),
    btnRefreshApi:    document.getElementById('btnRefreshApi'),
    btnForceSync:     document.getElementById('btnForceSync'),
    backupInfoSection:document.getElementById('backupInfoSection'),
    backupSlots:      document.getElementById('backupSlots'),
    toast:            document.getElementById('toast'),
};

// ===== INSTÂNCIA GLOBAL DO INVENTÁRIO =====
const inv = new InventoryManager();

// ===== TOAST =====
let toastTimeout = null;
function showToast(message, type = 'success') {
    el.toast.textContent = message;
    el.toast.className = `toast ${type}`;
    el.toast.classList.remove('hidden');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => el.toast.classList.add('hidden'), 2500);
}

// ===== UTILITÁRIOS =====
function normalize(str) {
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function setProgress(percent, status) {
    el.loadingBar.style.width = percent + '%';
    el.loadingStatus.textContent = status;
}

function timeAgo(ts) {
    if (!ts) return 'Nunca';
    const d = Date.now() - ts;
    if (d < 60000)   return 'Agora';
    if (d < 3600000) return `${Math.floor(d / 60000)}min atrás`;
    if (d < 86400000)return `${Math.floor(d / 3600000)}h atrás`;
    return new Date(ts).toLocaleString('pt-BR');
}

function renderAll() {
    renderRecipes();
    renderRecipeStats();
    renderInventory();
    renderInventoryStats();
    updateBackupBadge();
}

function updateBackupBadge() {
    const ls = inv.getLastSave();
    el.backupBadge.textContent = ls ? '💾 SALVO' : '⚠️';
    el.backupBadge.title = ls ? `Save: ${timeAgo(ls)}` : 'Sem dados';
}

function updateApiStatus() {
    if (!API_LOADED) { el.apiStatusBadge.className = 'api-status offline'; el.apiStatusBadge.textContent = 'ERRO'; return; }
    el.apiStatusBadge.className = API_SOURCE === 'cache-expired' ? 'api-status offline' : 'api-status online';
    el.apiStatusBadge.textContent = API_SOURCE === 'cache-expired' ? 'OFFLINE' : API_SOURCE === 'cache' ? 'CACHE ✓' : 'API ✓';
    el.apiStatusBadge.title = `${RECIPES.length} receitas | ${ALL_COMPONENTS.length} comp | ${API_SOURCE}`;
}

function populateCategories() {
    const cats = WarframeAPI.getCategories(RECIPES);
    el.categoryFilter.innerHTML = '<option value="all">Todas Categorias</option>';
    cats.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; el.categoryFilter.appendChild(o); });
}

// ===== LOGIN COM SUPABASE =====
let loginCheckTimeout = null;

el.loginInput.addEventListener('input', () => {
    clearTimeout(loginCheckTimeout);
    const username = el.loginInput.value.trim();
    if (username.length < 2) { el.pinSection.style.display = 'none'; return; }

    loginCheckTimeout = setTimeout(async () => {
        // Verifica se usuário já existe
        try {
            const { data } = await supabaseClient
                .from('profiles')
                .select('id, pin_hash')
                .eq('username', username.toLowerCase().trim())
                .maybeSingle();

            if (data) {
                // Usuário existente
                el.loginSubtitle.textContent = `Bem-vindo de volta, ${username}!`;
                if (data.pin_hash) {
                    el.pinSection.style.display = 'block';
                    el.pinHint.textContent = 'Digite seu PIN para entrar';
                    el.pinInput.placeholder = 'PIN (4 dígitos)';
                } else {
                    el.pinSection.style.display = 'none';
                }
            } else {
                // Novo usuário
                el.loginSubtitle.textContent = `Criar conta para "${username}"`;
                el.pinSection.style.display = 'block';
                el.pinHint.textContent = 'Crie um PIN de 4 dígitos (opcional, mas recomendado)';
                el.pinInput.placeholder = 'PIN novo (opcional)';
            }
        } catch (e) {
            // Sem conexão — login offline
            el.loginSubtitle.textContent = 'Modo offline — PIN não necessário';
            el.pinSection.style.display = 'none';
        }
    }, 500);
});

async function handleLogin() {
    const username = el.loginInput.value.trim();
    if (!username) return;

    const pin = el.pinInput ? el.pinInput.value.trim() : '';

    el.btnLogin.disabled = true;
    el.loginStatus.className = 'login-status loading';
    el.loginStatus.textContent = 'Conectando...';

    // Carrega inventário local primeiro (resposta imediata)
    inv.loadUser(username);
    el.userName.textContent = username.toUpperCase();

    // Tenta sincronizar com o banco
    if (navigator.onLine) {
        const result = await cloudSync.loginOrCreate(username, pin);

        if (!result.success) {
            el.loginStatus.className = 'login-status error';
            el.loginStatus.textContent = result.error || 'Erro ao conectar';
            el.btnLogin.disabled = false;
            return;
        }

        el.loginStatus.className = 'login-status success';
        el.loginStatus.textContent = result.isNew ? '✅ Conta criada! Dados sincronizados.' : '✅ Logado! Dados sincronizados.';
    } else {
        // Modo offline
        el.loginStatus.className = 'login-status loading';
        el.loginStatus.textContent = '📴 Modo offline — dados locais carregados';
        setSyncStatus('offline', '📴 OFFLINE');
    }

    setTimeout(() => {
        el.loginModal.classList.add('hidden');
        el.btnLogin.disabled = false;
        renderAll();
    }, 800);
}

// ===== EVENTOS =====
function setupEvents() {
    el.btnLogin.addEventListener('click', handleLogin);
    el.loginInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
    el.pinInput && el.pinInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });

    el.btnChangeUser.addEventListener('click', () => {
        if (inv.currentUser) { inv.save(); inv.createBackup(); cloudSync.push(); }
        cloudSync.logout();
        el.loginModal.classList.remove('hidden');
        el.loginInput.value = '';
        el.pinInput && (el.pinInput.value = '');
        el.pinSection.style.display = 'none';
        el.loginStatus.textContent = '';
        el.loginSubtitle.textContent = 'Digite seu nome para entrar ou criar sua conta';
        setTimeout(() => el.loginInput.focus(), 100);
    });

    // Tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`${tab.dataset.tab}Tab`).classList.add('active');
        });
    });

    // Filtros de receitas
    el.recipeSearch.addEventListener('input', renderRecipes);
    el.categoryFilter.addEventListener('change', renderRecipes);
    el.progressFilter.addEventListener('change', renderRecipes);
    el.inventorySearch.addEventListener('input', renderInventory);

    // Adicionar item
    el.btnAddItem.addEventListener('click', () => {
        el.addItemModal.classList.remove('hidden');
        el.addItemSearch.value = '';
        renderAddItemList();
        setTimeout(() => el.addItemSearch.focus(), 100);
    });
    el.addItemSearch.addEventListener('input', renderAddItemList);

    // Import/Export
    el.btnImportExport.addEventListener('click', () => {
        el.exportData.value = inv.exportData();
        el.importData.value = '';
        renderBackupInfo();
        el.importExportModal.classList.remove('hidden');
    });

    el.btnCopyExport.addEventListener('click', () => {
        el.exportData.select();
        navigator.clipboard.writeText(el.exportData.value)
            .then(() => showToast('Copiado!'))
            .catch(() => { document.execCommand('copy'); showToast('Copiado!'); });
    });

    el.btnImport.addEventListener('click', () => {
        const data = el.importData.value.trim();
        if (!data) { showToast('Cole seus dados', 'error'); return; }
        if (inv.importData(data)) { showToast('Importado e sincronizado!'); el.importExportModal.classList.add('hidden'); renderAll(); }
        else showToast('Formato inválido', 'error');
    });

    // Atualizar API de receitas
    el.btnRefreshApi.addEventListener('click', async () => {
        showToast('Atualizando receitas...');
        el.loadingScreen.classList.remove('hidden');
        el.loadingScreen.style.opacity = '1';
        const ok = await loadAPI(true);
        if (ok) { populateCategories(); renderAll(); updateApiStatus(); showToast(`${RECIPES.length} receitas!`); }
        else showToast('Falha', 'error');
        el.loadingScreen.classList.add('hidden');
    });

    // Forçar sync manual
    el.btnForceSync.addEventListener('click', async () => {
        showToast('Sincronizando...');
        await cloudSync.push();
        showToast('Sincronizado!');
    });

    // Modal close handlers
    setupModalCloseHandlers();

    // Auto-backup local a cada 60s
    setInterval(() => {
        if (inv.currentUser && inv.isDirty()) { inv.createBackup(); updateBackupBadge(); }
    }, 60000);

    // Salva antes de fechar a página
    window.addEventListener('beforeunload', () => {
        if (inv.currentUser) { inv.save(); inv.createBackup(); cloudSync.push(); }
    });
}

// ===== BOOT =====
async function boot() {
    setProgress(0, 'Inicializando...');

    const apiOk = await loadAPI();
    if (!apiOk) {
        el.loadingError.style.display = 'block';
        el.loadingError.innerHTML = `<p>⚠️ Sem dados disponíveis.</p><button onclick="location.reload()">TENTAR NOVAMENTE</button>`;
        return;
    }

    populateCategories();
    updateApiStatus();
    setupEvents();

    // Verifica sessão salva
    const savedCloudId = InventoryManager.getSavedCloudUserId();
    const lastUser = InventoryManager.getLastUser();

    if (savedCloudId && lastUser) {
        // Carrega local imediatamente
        inv.loadUser(lastUser);
        el.userName.textContent = lastUser.toUpperCase();

        setTimeout(() => {
            el.loadingScreen.classList.add('hidden');
            el.app.style.display = 'block';
            renderAll();
        }, 500);

        // Tenta retomar sessão na nuvem em background
        cloudSync.resumeSession(savedCloudId).then(ok => {
            if (ok) { renderAll(); showToast('Dados sincronizados da nuvem!'); }
        });

    } else if (lastUser) {
        // Tem usuário local mas sem ID de nuvem — abre login
        inv.loadUser(lastUser);
        el.userName.textContent = lastUser.toUpperCase();
        el.loginInput.value = lastUser;

        setTimeout(() => {
            el.loadingScreen.classList.add('hidden');
            el.app.style.display = 'block';
            el.loginModal.classList.remove('hidden');
            renderAll();
        }, 500);
    } else {
        // Primeiro acesso
        setTimeout(() => {
            el.loadingScreen.classList.add('hidden');
            el.app.style.display = 'block';
            el.loginModal.classList.remove('hidden');
        }, 500);
    }
}

boot();