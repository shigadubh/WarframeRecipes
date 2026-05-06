/**
 * app.js - Controller Principal
 * Inicializa o app, gerencia login, eventos e boot
 */

// ============================================
// REFERÊNCIAS DOM
// ============================================
const el = {
    loadingScreen:         document.getElementById('loadingScreen'),
    loadingBar:            document.getElementById('loadingBar'),
    loadingStatus:         document.getElementById('loadingStatus'),
    loadingError:          document.getElementById('loadingError'),
    app:                   document.getElementById('app'),

    loginModal:            document.getElementById('loginModal'),
    loginInput:            document.getElementById('loginInput'),
    pinSection:            document.getElementById('pinSection'),
    pinInput:              document.getElementById('pinInput'),
    pinHint:               document.getElementById('pinHint'),
    loginSubtitle:         document.getElementById('loginSubtitle'),
    btnLogin:              document.getElementById('btnLogin'),
    loginStatus:           document.getElementById('loginStatus'),

    userName:              document.getElementById('userName'),
    btnChangeUser:         document.getElementById('btnChangeUser'),
    apiStatusBadge:        document.getElementById('apiStatusBadge'),
    backupBadge:           document.getElementById('backupBadge'),
    syncBadge:             document.getElementById('syncBadge'),

    recipeSearch:          document.getElementById('recipeSearch'),
    categoryFilter:        document.getElementById('categoryFilter'),
    progressFilter:        document.getElementById('progressFilter'),
    recipesGrid:           document.getElementById('recipesGrid'),
    recipesStats:          document.getElementById('recipesStats'),

    inventorySearch:       document.getElementById('inventorySearch'),
    inventoryList:         document.getElementById('inventoryList'),
    inventoryStats:        document.getElementById('inventoryStats'),

    btnAddItem:            document.getElementById('btnAddItem'),
    addItemModal:          document.getElementById('addItemModal'),
    addItemSearch:         document.getElementById('addItemSearch'),
    addItemList:           document.getElementById('addItemList'),

    recipeDetailModal:     document.getElementById('recipeDetailModal'),
    recipeDetailTitle:     document.getElementById('recipeDetailTitle'),
    recipeDetailBody:      document.getElementById('recipeDetailBody'),

    btnImportExport:       document.getElementById('btnImportExport'),
    importExportModal:     document.getElementById('importExportModal'),
    exportData:            document.getElementById('exportData'),
    importData:            document.getElementById('importData'),
    btnCopyExport:         document.getElementById('btnCopyExport'),
    btnImport:             document.getElementById('btnImport'),

    btnRefreshApi:         document.getElementById('btnRefreshApi'),
    btnForceSync:          document.getElementById('btnForceSync'),

    backupInfoSection:     document.getElementById('backupInfoSection'),
    backupSlots:           document.getElementById('backupSlots'),

    craftedSearch:         document.getElementById('craftedSearch'),
    craftedCategoryFilter: document.getElementById('craftedCategoryFilter'),
    craftedGrid:           document.getElementById('craftedGrid'),
    craftedStats:          document.getElementById('craftedStats'),

    toast:                 document.getElementById('toast'),
};

// ============================================
// INSTÂNCIA DO INVENTÁRIO
// ============================================
const inv = new InventoryManager();

// ============================================
// TOAST
// ============================================
let toastTimeout = null;

function showToast(message, type = 'success') {
    el.toast.textContent = message;
    el.toast.className = `toast ${type}`;
    el.toast.classList.remove('hidden');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => el.toast.classList.add('hidden'), 2500);
}

// ============================================
// UTILITÁRIOS GLOBAIS
// ============================================
function normalize(str) {
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function setProgress(percent, status) {
    if (el.loadingBar) el.loadingBar.style.width = percent + '%';
    if (el.loadingStatus) el.loadingStatus.textContent = status;
}

function timeAgo(ts) {
    if (!ts) return 'Nunca';
    const d = Date.now() - ts;
    if (d < 60000)    return 'Agora';
    if (d < 3600000)  return `${Math.floor(d / 60000)}min`;
    if (d < 86400000) return `${Math.floor(d / 3600000)}h`;
    return new Date(ts).toLocaleString('pt-BR');
}

// ============================================
// RENDER ALL
// ============================================
function renderAll() {
    try { invalidateProgressCache(); } catch (e) { console.warn('Cache invalidate:', e); }
    try { renderRecipes(); } catch (e) { console.error('renderRecipes:', e); }
    try { renderRecipeStats(); } catch (e) { console.error('renderRecipeStats:', e); }
    try { renderInventory(); } catch (e) { console.error('renderInventory:', e); }
    try { renderInventoryStats(); } catch (e) { console.error('renderInventoryStats:', e); }
    try { renderCrafted(); } catch (e) { console.error('renderCrafted:', e); }
    try { updateBackupBadge(); } catch (e) { console.error('updateBackupBadge:', e); }
}

// ============================================
// BADGES
// ============================================
function updateBackupBadge() {
    const ls = inv.getLastSave();
    el.backupBadge.className = 'backup-indicator ok';
    el.backupBadge.textContent = ls ? '💾 SALVO' : '⚠️';
    el.backupBadge.title = ls ? `Save local: ${timeAgo(ls)}` : 'Sem dados salvos';
}

function updateApiStatus() {
    if (!API_LOADED) {
        el.apiStatusBadge.className = 'api-status offline';
        el.apiStatusBadge.textContent = 'ERRO';
        return;
    }
    if (API_SOURCE === 'cache-expired') {
        el.apiStatusBadge.className = 'api-status offline';
        el.apiStatusBadge.textContent = 'OFFLINE';
    } else if (API_SOURCE === 'local') {
        el.apiStatusBadge.className = 'api-status online';
        el.apiStatusBadge.textContent = 'LOCAL ✓';
    } else {
        el.apiStatusBadge.className = 'api-status online';
        el.apiStatusBadge.textContent = API_SOURCE === 'cache' ? 'CACHE ✓' : 'API ✓';
    }
    el.apiStatusBadge.title = `${RECIPES.length} receitas | ${ALL_COMPONENTS.length} componentes | via ${API_SOURCE}`;
}

function populateCategories() {
    const cats = WarframeAPI.getCategories(RECIPES);
    el.categoryFilter.innerHTML = '<option value="all">Todas Categorias</option>';
    cats.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        el.categoryFilter.appendChild(opt);
    });
}

// ============================================
// LOGIN COM SUPABASE
// ============================================
let loginCheckTimeout = null;

function setupLoginCheck() {
    el.loginInput.addEventListener('input', () => {
        clearTimeout(loginCheckTimeout);
        const username = el.loginInput.value.trim();

        if (username.length < 2) {
            el.pinSection.style.display = 'none';
            el.loginSubtitle.textContent = 'Digite seu nome para entrar ou criar sua conta';
            return;
        }

        loginCheckTimeout = setTimeout(async () => {
            try {
                if (typeof supabaseClient === 'undefined') {
                    el.loginSubtitle.textContent = 'Modo local — sem PIN necessário';
                    el.pinSection.style.display = 'none';
                    return;
                }

                const { data } = await supabaseClient
                    .from('profiles')
                    .select('id, pin_hash')
                    .eq('username', username.toLowerCase().trim())
                    .maybeSingle();

                if (data) {
                    el.loginSubtitle.textContent = `Bem-vindo de volta, ${username}!`;
                    if (data.pin_hash) {
                        el.pinSection.style.display = 'block';
                        el.pinHint.textContent = 'Digite seu PIN para entrar';
                        el.pinInput.placeholder = 'PIN (4 dígitos)';
                    } else {
                        el.pinSection.style.display = 'none';
                    }
                } else {
                    el.loginSubtitle.textContent = `Criar conta para "${username}"`;
                    el.pinSection.style.display = 'block';
                    el.pinHint.textContent = 'Crie um PIN (opcional, mas recomendado)';
                    el.pinInput.placeholder = 'PIN novo (opcional)';
                }
            } catch (e) {
                console.warn('[Login] Sem conexão:', e.message);
                el.loginSubtitle.textContent = 'Modo offline — PIN não necessário';
                el.pinSection.style.display = 'none';
            }
        }, 500);
    });
}

async function handleLogin() {
    const username = el.loginInput.value.trim();
    if (!username || username.length < 2) {
        el.loginStatus.className = 'login-status error';
        el.loginStatus.textContent = 'Nome precisa ter pelo menos 2 caracteres';
        return;
    }

    const pin = el.pinInput ? el.pinInput.value.trim() : '';

    el.btnLogin.disabled = true;
    el.loginStatus.className = 'login-status loading';
    el.loginStatus.textContent = 'Conectando...';

    try {
        inv.loadUser(username);
        el.userName.textContent = username.toUpperCase();
        console.log('[Login] Usuário local carregado:', inv.currentUser);
    } catch (e) {
        console.error('[Login] Erro ao carregar local:', e);
    }

    if (navigator.onLine && typeof cloudSync !== 'undefined') {
        try {
            const result = await cloudSync.loginOrCreate(username, pin);
            if (!result.success) {
                el.loginStatus.className = 'login-status error';
                el.loginStatus.textContent = result.error || 'Erro ao conectar';
                el.btnLogin.disabled = false;
                return;
            }
            el.loginStatus.className = 'login-status success';
            el.loginStatus.textContent = result.isNew ? '✅ Conta criada!' : '✅ Logado com sucesso!';
        } catch (e) {
            console.warn('[Login] Sync falhou, modo local:', e);
            el.loginStatus.className = 'login-status loading';
            el.loginStatus.textContent = '📴 Modo local';
        }
    } else {
        el.loginStatus.className = 'login-status loading';
        el.loginStatus.textContent = '📴 Modo offline';
        if (typeof setSyncStatus === 'function') {
            setSyncStatus('offline', '📴 OFFLINE');
        }
    }

    setTimeout(() => {
        el.loginModal.classList.add('hidden');
        el.btnLogin.disabled = false;
        el.loginStatus.textContent = '';
        renderAll();
    }, 800);
}

// ============================================
// SETUP DE EVENTOS
// ============================================
function setupEvents() {

    // ----- LOGIN -----
    el.btnLogin.addEventListener('click', handleLogin);

    el.loginInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if (el.pinSection.style.display !== 'none' && el.pinInput && !el.pinInput.value) {
                el.pinInput.focus();
            } else {
                handleLogin();
            }
        }
    });

    if (el.pinInput) {
        el.pinInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleLogin();
        });
    }

    setupLoginCheck();

    // ----- TROCAR USUÁRIO -----
    el.btnChangeUser.addEventListener('click', () => {
        if (inv.currentUser) {
            inv.save();
            inv.createBackup();
            if (typeof cloudSync !== 'undefined') cloudSync.push();
        }

        if (typeof cloudSync !== 'undefined') cloudSync.logout();

        el.loginModal.classList.remove('hidden');
        el.loginInput.value = '';
        if (el.pinInput) el.pinInput.value = '';
        el.pinSection.style.display = 'none';
        el.loginStatus.textContent = '';
        el.loginSubtitle.textContent = 'Digite seu nome para entrar ou criar sua conta';

        setTimeout(() => el.loginInput.focus(), 100);
    });

    // ----- TABS -----
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            const target = document.getElementById(`${tab.dataset.tab}Tab`);
            if (target) target.classList.add('active');
        });
    });

    // ----- BUSCA RECEITAS -----
    if (typeof setupRecipeSearchDebounce === 'function') {
        setupRecipeSearchDebounce();
    }

    el.categoryFilter.addEventListener('change', () => {
        if (typeof recipePage !== 'undefined') recipePage = 0;
        renderRecipes();
    });

    el.progressFilter.addEventListener('change', () => {
        if (typeof recipePage !== 'undefined') recipePage = 0;
        renderRecipes();
    });

    // ----- BUSCA INVENTÁRIO -----
    let invSearchTimer = null;
    el.inventorySearch.addEventListener('input', () => {
        clearTimeout(invSearchTimer);
        invSearchTimer = setTimeout(renderInventory, 300);
    });

    // ----- ADICIONAR ITEM -----
    el.btnAddItem.addEventListener('click', () => {
        el.addItemModal.classList.remove('hidden');
        el.addItemSearch.value = '';
        renderAddItemList();
        setTimeout(() => el.addItemSearch.focus(), 100);
    });

    let addSearchTimer = null;
    el.addItemSearch.addEventListener('input', () => {
        clearTimeout(addSearchTimer);
        addSearchTimer = setTimeout(renderAddItemList, 300);
    });

    // ----- BUSCA FABRICADOS -----
    let craftedSearchTimer = null;
    el.craftedSearch.addEventListener('input', () => {
        clearTimeout(craftedSearchTimer);
        craftedSearchTimer = setTimeout(renderCrafted, 300);
    });

    el.craftedCategoryFilter.addEventListener('change', renderCrafted);

    // ----- IMPORT/EXPORT -----
    el.btnImportExport.addEventListener('click', () => {
        el.exportData.value = inv.exportData();
        el.importData.value = '';
        if (typeof renderBackupInfo === 'function') renderBackupInfo();
        el.importExportModal.classList.remove('hidden');
    });

    el.btnCopyExport.addEventListener('click', () => {
        el.exportData.select();
        navigator.clipboard.writeText(el.exportData.value)
            .then(() => showToast('Copiado!'))
            .catch(() => {
                document.execCommand('copy');
                showToast('Copiado!');
            });
    });

    el.btnImport.addEventListener('click', () => {
        const data = el.importData.value.trim();
        if (!data) {
            showToast('Cole seus dados antes de importar', 'error');
            return;
        }
        if (inv.importData(data)) {
            showToast('Importado com sucesso!');
            el.importExportModal.classList.add('hidden');
            invalidateProgressCache();
            renderAll();
        } else {
            showToast('Formato inválido', 'error');
        }
    });

    // ----- ATUALIZAR API -----
    el.btnRefreshApi.addEventListener('click', async () => {
        showToast('Atualizando...');
        el.loadingScreen.classList.remove('hidden');
        el.loadingScreen.style.opacity = '1';
        const success = await loadAPI(true);
        if (success) {
            populateCategories();
            if (typeof populateCraftedCategories === 'function') populateCraftedCategories();
            invalidateProgressCache();

            // Re-aplica raridades (se já carregadas)
            if (typeof applyRaritiesToCompMap === 'function' && RARITY_LOADED) {
                applyRaritiesToCompMap();
            }

            renderAll();
            updateApiStatus();
            showToast(`${RECIPES.length} receitas atualizadas!`);
        } else {
            showToast('Falha ao atualizar', 'error');
        }
        el.loadingScreen.classList.add('hidden');
    });

    // ----- SYNC MANUAL -----
    el.btnForceSync.addEventListener('click', async () => {
        if (typeof cloudSync === 'undefined' || !cloudSync.userId) {
            showToast('Faça login primeiro', 'error');
            return;
        }
        showToast('Sincronizando...');
        await cloudSync.push();
        showToast('Sincronizado!');
    });

    // ----- MODAIS -----
    if (typeof setupModalCloseHandlers === 'function') {
        setupModalCloseHandlers();
    }

    // ----- AUTO-BACKUP -----
    setInterval(() => {
        if (inv.currentUser && inv.isDirty()) {
            inv.createBackup();
            updateBackupBadge();
        }
    }, 60000);

    // ----- BEFORE UNLOAD -----
    window.addEventListener('beforeunload', () => {
        if (inv.currentUser) {
            inv.save();
            if (inv.isDirty()) inv.createBackup();
            if (typeof cloudSync !== 'undefined' && cloudSync.userId && navigator.onLine) {
                cloudSync.push();
            }
        }
    });

    // ----- CTRL+S -----
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (inv.currentUser) {
                inv.save();
                inv.createBackup();
                if (typeof cloudSync !== 'undefined') cloudSync.push();
                showToast('Salvo! (Ctrl+S)');
            }
        }
    });
}

// ============================================
// BOOT
// ============================================
async function boot() {
    // ... outras coisas ...

    populateCategories();
    if (typeof populateCraftedCategories === 'function') {
        populateCraftedCategories();
    }
    updateApiStatus();
    setupEvents();

    // ⭐ INICIAR AQUI ⭐
    if (typeof initRarities === 'function') {
        initRarities();
    }

    if (typeof initExtraRecipes === 'function') {
        initExtraRecipes();
    }

    setTimeout(() => {
        el.loadingScreen.classList.add('hidden');
        el.app.style.display = 'block';
    }, 300);

    // ... resto continua igual ...
}

boot();
