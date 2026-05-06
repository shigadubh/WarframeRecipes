/**
 * app.js - Controller Principal
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
// UTILITÁRIOS
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
    try { invalidateProgressCache(); } catch (e) { console.warn('Cache:', e); }
    try { renderRecipes(); } catch (e) { console.error('renderRecipes:', e); }
    try { renderRecipeStats(); } catch (e) { console.error('renderRecipeStats:', e); }
    try { renderInventory(); } catch (e) { console.error('renderInventory:', e); }
    try { renderInventoryStats(); } catch (e) { console.error('renderInventoryStats:', e); }
    try { renderCrafted(); } catch 
