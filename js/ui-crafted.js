/**
 * ui-crafted.js
 * Aba de fabricados COM busca e fabricação manual
 */

// ============================================
// RENDER PRINCIPAL DA ABA FABRICADOS
// ============================================
function renderCrafted() {
    if (!el.craftedGrid) return;

    const search = normalize(el.craftedSearch.value);
    const catFilter = el.craftedCategoryFilter.value;

    let craftedRecipes = RECIPES.filter(recipe => {
        if (!inv.isCrafted(recipe.name)) return false;
        if (search && !normalize(recipe.name).includes(search)) return false;
        if (catFilter !== 'all' && recipe.category !== catFilter) return false;
        return true;
    });

    craftedRecipes.sort((a, b) => {
        const ta = inv.getCraftedTime(a.name) || 0;
        const tb = inv.getCraftedTime(b.name) || 0;
        return tb - ta;
    });

    el.craftedGrid.innerHTML = '';

    // BOTÃO de marcar fabricação manual (sempre visível)
    const addBtn = document.createElement('button');
    addBtn.className = 'crafted-add-btn';
    addBtn.innerHTML = '🔨 MARCAR ITEM COMO FABRICADO';
    addBtn.addEventListener('click', () => {
        openManualCraftModal();
    });
    el.craftedGrid.appendChild(addBtn);

    if (!craftedRecipes.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.style.gridColumn = '1/-1';
        empty.innerHTML = `<h3>Nenhum item fabricado</h3><p>Use o botão acima ou marque na aba "Receitas".</p>`;
        el.craftedGrid.appendChild(empty);
        renderCraftedStats(0);
        return;
    }

    craftedRecipes.forEach(r => el.craftedGrid.appendChild(createCraftedCard(r)));
    renderCraftedStats(craftedRecipes.length);
}

// ============================================
// CRIA CARD DE ITEM FABRICADO
// ============================================
function createCraftedCard(recipe) {
    const isPrime = recipe.name.includes('Prime');
    const craftTime = inv.getCraftedTime(recipe.name);
    const pr = inv.getRecipeProgress(recipe);

    const imgSrc = recipe.imageName ? `${CONFIG.IMG_CDN || 'https://cdn.warframestat.us/img/'}${recipe.imageName}` : '';
    const imgHtml = imgSrc
        ? `<div class="crafted-card-image"><img src="${imgSrc}" alt="${recipe.name}" loading="lazy" onerror="this.parentNode.innerHTML='<span class=\\'image-placeholder\\'>📦</span><span class=\\'crafted-overlay\\'>FABRICADO</span>';"><span class="crafted-overlay">FABRICADO</span></div>`
        : `<div class="crafted-card-image"><span class="image-placeholder">📦</span><span class="crafted-overlay">FABRICADO</span></div>`;

    const comps = pr.details.map(d => {
        const need = d.requiredQty > 1 ? ` x${d.requiredQty}` : '';
        const rarity = COMP_MAP[d.id]?.rarity || 'unknown';
        return `<span class="crafted-comp-tag rarity-${rarity}"><span class="rarity-badge ${rarity}"></span>${d.rawName || d.displayName}${need}</span>`;
    }).join('');

    const card = document.createElement('div');
    card.className = `crafted-card${isPrime ? ' prime' : ''}`;
    card.innerHTML = `
        ${imgHtml}
        <div class="crafted-card-body">
            <div class="crafted-card-name">${recipe.name}</div>
            <div class="crafted-card-category">${recipe.category}</div>
            <div class="crafted-card-date">📅 ${craftTime ? new Date(craftTime).toLocaleDateString('pt-BR') : 'Data desconhecida'}</div>
            <div class="crafted-card-components">${comps}</div>
            <div class="crafted-card-actions">
                <button class="btn-small btn-uncraft">↩️ DESFAZER</button>
                <button class="btn-small btn-detail">📋 DETALHES</button>
            </div>
        </div>`;

    card.querySelector('.btn-uncraft').addEventListener('click', () => {
        if (confirm(`Desfazer fabricação de "${recipe.name}"?\n\nOs componentes serão devolvidos ao inventário.`)) {
            inv.uncraftRecipe(recipe);
            showToast(`${recipe.name} desmarcado`, 'error');
            renderAll();
        }
    });

    card.querySelector('.btn-detail').addEventListener('click', () => {
        if (typeof openDetail === 'function') openDetail(recipe);
    });

    return card;
}

// ============================================
// ESTATÍSTICAS DA ABA
// ============================================
function renderCraftedStats(count) {
    if (!el.craftedStats) return;

    const cats = {};
    RECIPES.forEach(r => {
        if (inv.isCrafted(r.name)) {
            cats[r.category] = (cats[r.category] || 0) + 1;
        }
    });
    const topCat = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];

    el.craftedStats.innerHTML = `
        <div class="stat-card">
            <div class="stat-icon red">🔨</div>
            <div class="stat-info">
                <div class="stat-value">${count}</div>
                <div class="stat-label">Fabricados</div>
            </div>
        </div>
        ${topCat ? `<div class="stat-card">
            <div class="stat-icon gold">⭐</div>
            <div class="stat-info">
                <div class="stat-value" style="font-size:14px;">${topCat[0]}</div>
                <div class="stat-label">Mais fabricado (${topCat[1]})</div>
            </div>
        </div>` : ''}`;
}

// ============================================
// POPULATE FILTRO DE CATEGORIAS
// ============================================
function populateCraftedCategories() {
    if (!el.craftedCategoryFilter) return;

    const cats = WarframeAPI.getCategories(RECIPES);
    el.craftedCategoryFilter.innerHTML = '<option value="all">Todas Categorias</option>';
    cats.forEach(c => {
        const o = document.createElement('option');
        o.value = c;
        o.textContent = c;
        el.craftedCategoryFilter.appendChild(o);
    });
}

// ============================================
// MODAL MANUAL DE FABRICAÇÃO
// (criado UMA vez e reutilizado)
// ============================================
let manualSearchTimer = null;

function ensureManualCraftModal() {
    let modal = document.getElementById('manualCraftModal');

    // Se já existe, retorna
    if (modal) return modal;

    // Cria pela primeira vez
    console.log('[ManualCraft] Criando modal pela primeira vez...');

    modal = document.createElement('div');
    modal.id = 'manualCraftModal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>🔨 MARCAR COMO FABRICADO</h2>
                <button class="modal-close" data-close="manualCraftModal">&times;</button>
            </div>
            <div class="modal-body">
                <p style="color:var(--text-muted);font-size:13px;margin-bottom:12px;">
                    Marque qualquer item como fabricado sem precisar ter os componentes no inventário.
                </p>
                <div class="search-box modal-search">
                    <input type="text" id="manualCraftSearch" placeholder="🔍 Buscar receita...">
                </div>
                <div class="manual-craft-list" id="manualCraftList"></div>
            </div>
        </div>`;

    document.body.appendChild(modal);

    // Bind do search com debounce (UMA ÚNICA vez)
    const search = modal.querySelector('#manualCraftSearch');
    if (search) {
        search.addEventListener('input', () => {
            clearTimeout(manualSearchTimer);
            manualSearchTimer = setTimeout(renderManualCraftList, 300);
        });
    }

    return modal;
}

function openManualCraftModal() {
    // Fecha QUALQUER outro modal aberto antes
    document.querySelectorAll('.modal:not(.hidden)').forEach(m => {
        if (m.id !== 'loginModal') m.classList.add('hidden');
    });

    // Abre o modal manual
    const modal = ensureManualCraftModal();
    modal.classList.remove('hidden');

    const search = document.getElementById('manualCraftSearch');
    if (search) {
        search.value = '';
        setTimeout(() => search.focus(), 100);
    }

    renderManualCraftList();
}

function renderManualCraftList() {
    const searchEl = document.getElementById('manualCraftSearch');
    const list = document.getElementById('manualCraftList');
    if (!list) return;

    const search = searchEl ? normalize(searchEl.value) : '';

    let recipes = RECIPES.filter(r => {
        if (search && !normalize(r.name).includes(search)) return false;
        return true;
    });

    // Ordena: não-fabricados primeiro
    recipes.sort((a, b) => {
        const ca = inv.isCrafted(a.name);
        const cb = inv.isCrafted(b.name);
        if (ca && !cb) return 1;
        if (cb && !ca) return -1;
        return a.name.localeCompare(b.name);
    });

    const display = recipes.slice(0, 100);
    list.innerHTML = '';

    if (!display.length) {
        list.innerHTML = '<div class="empty-state" style="padding:20px;"><p>Nenhuma receita encontrada</p></div>';
        return;
    }

    display.forEach(recipe => {
        const isCrafted = inv.isCrafted(recipe.name);
        const div = document.createElement('div');
        div.className = `manual-craft-option${isCrafted ? ' already-crafted' : ''}`;
        div.innerHTML = `
            <div style="min-width:0;flex:1;">
                <div class="manual-craft-name">${recipe.name}</div>
                <div class="manual-craft-cat">${recipe.category}</div>
            </div>
            <button class="manual-craft-btn" ${isCrafted ? 'disabled' : ''}>
                ${isCrafted ? '✅ JÁ FABRICADO' : '🔨 MARCAR'}
            </button>`;

        const btn = div.querySelector('button');
        if (!isCrafted) {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                if (confirm(`Marcar "${recipe.name}" como fabricado?\n\nNenhum componente será removido do inventário.`)) {
                    inv.setCrafted(recipe.name);
                    showToast(`🔨 ${recipe.name} marcado como fabricado!`, 'craft');
                    renderManualCraftList();
                    renderAll();
                }
            });
        }

        list.appendChild(div);
    });

    if (recipes.length > 100) {
        const m = document.createElement('div');
        m.className = 'empty-state';
        m.style.padding = '10px';
        m.innerHTML = `<p style="font-size:12px;">Mostrando 100 de ${recipes.length}. Refine a busca.</p>`;
        list.appendChild(m);
    }
}
