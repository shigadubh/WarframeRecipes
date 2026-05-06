/**
 * ui-recipes.js
 * Renderiza receitas com raridade
 */

let progressCache = {};
let progressCacheDirty = true;

function invalidateProgressCache() {
    progressCacheDirty = true;
}

function getProgress(recipe) {
    if (progressCacheDirty) {
        progressCache = {};
        progressCacheDirty = false;
    }
    if (!progressCache[recipe.name]) {
        progressCache[recipe.name] = inv.getRecipeProgress(recipe);
    }
    return progressCache[recipe.name];
}

let recipePage = 0;
const RECIPES_PER_PAGE = 50;
let filteredRecipesCache = [];
let recipeSearchTimer = null;

function setupRecipeSearchDebounce() {
    el.recipeSearch.addEventListener('input', () => {
        clearTimeout(recipeSearchTimer);
        recipeSearchTimer = setTimeout(() => {
            recipePage = 0;
            renderRecipes();
        }, 300);
    });
}

function getRarityName(rarity) {
    if (rarity === 'common') return 'Comum';
    if (rarity === 'uncommon') return 'Incomum';
    if (rarity === 'rare') return 'Raro';
    return '?';
}

function renderRecipes() {
    invalidateProgressCache();

    const search = normalize(el.recipeSearch.value);
    const catFilter = el.categoryFilter.value;
    const progFilter = el.progressFilter.value;

    filteredRecipesCache = RECIPES.filter(recipe => {
        if (search && !normalize(recipe.name).includes(search)) return false;
        if (catFilter !== 'all' && recipe.category !== catFilter) return false;
        if (progFilter !== 'all') {
            const p = getProgress(recipe);
            const isCrafted = inv.isCrafted(recipe.name);
            if (progFilter === 'complete' && p.percentage !== 100) return false;
            if (progFilter === 'partial' && (p.percentage === 0 || p.percentage === 100)) return false;
            if (progFilter === 'none' && p.percentage !== 0) return false;
            if (progFilter === 'craftable' && !p.canCraft) return false;
            if (progFilter === 'crafted' && !isCrafted) return false;
        }
        return true;
    });

    filteredRecipesCache.sort((a, b) => {
        const ca = inv.isCrafted(a.name);
        const cb = inv.isCrafted(b.name);
        if (ca && !cb) return 1;
        if (cb && !ca) return -1;
        const pa = getProgress(a).percentage;
        const pb = getProgress(b).percentage;
        if (pa === 100 && pb !== 100) return 1;
        if (pb === 100 && pa !== 100) return -1;
        if (pb !== pa) return pb - pa;
        return a.name.localeCompare(b.name);
    });

    el.recipesGrid.innerHTML = '';
    recipePage = 0;

    if (!filteredRecipesCache.length) {
        el.recipesGrid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><h3>Nenhuma receita encontrada</h3><p>Ajuste os filtros</p></div>`;
        return;
    }

    appendRecipePage();
}

function appendRecipePage() {
    const start = recipePage * RECIPES_PER_PAGE;
    const end = Math.min(start + RECIPES_PER_PAGE, filteredRecipesCache.length);
    const fragment = document.createDocumentFragment();

    for (let i = start; i < end; i++) {
        fragment.appendChild(createRecipeCard(filteredRecipesCache[i]));
    }

    el.recipesGrid.appendChild(fragment);
    recipePage++;

    const existing = el.recipesGrid.querySelector('.load-more-btn');
    if (existing) existing.remove();

    if (end < filteredRecipesCache.length) {
        const loadMoreBtn = document.createElement('div');
        loadMoreBtn.className = 'empty-state load-more-btn';
        loadMoreBtn.style.cssText = 'grid-column:1/-1;padding:20px;cursor:pointer;';
        loadMoreBtn.innerHTML = `<button class="btn-secondary" style="margin:0 auto;">Carregar mais (${filteredRecipesCache.length - end} restantes)</button>`;
        loadMoreBtn.addEventListener('click', () => {
            loadMoreBtn.remove();
            appendRecipePage();
        });
        el.recipesGrid.appendChild(loadMoreBtn);
    }
}

function createRecipeCard(recipe) {
    const pr = getProgress(recipe);
    const isPrime = recipe.name.includes('Prime');
    const pct = pr.percentage;
    const isCrafted = inv.isCrafted(recipe.name);

    let badgeClass, badgeText;
    if (isCrafted) { badgeClass = 'none'; badgeText = 'Fabricado'; }
    else if (pct === 100) { badgeClass = 'complete'; badgeText = 'Completo'; }
    else if (pct > 0) { badgeClass = 'partial'; badgeText = 'Parcial'; }
    else { badgeClass = 'none'; badgeText = 'Faltam todos'; }

    let fillClass;
    if (isPrime) fillClass = pct === 100 ? 'gold' : pct > 0 ? 'orange' : 'red';
    else fillClass = pct === 100 ? 'green' : pct > 0 ? 'orange' : 'red';

    const imgHtml = recipe.imageName
        ? `<div class="recipe-card-image"><img src="${CONFIG.IMG_CDN || 'https://cdn.warframestat.us/img/'}${recipe.imageName}" alt="${recipe.name}" loading="lazy" onerror="this.parentNode.innerHTML='<span class=\\'image-placeholder\\'>📦</span>';"></div>`
        : '';

    const maxTags = 6;
    const tagsToShow = pr.details.slice(0, maxTags);
    const tags = tagsToShow.map(d => {
        let label = d.rawName || d.displayName;
        if (label.length > 18) label = label.substring(0, 15) + '...';
        const need = d.requiredQty > 1
            ? ` <small style="color:var(--accent-primary);">(${d.quantity}/${d.requiredQty})</small>`
            : '';
        const rarity = COMP_MAP[d.id]?.rarity || 'unknown';
        return `<span class="recipe-item-tag rarity-${rarity}${d.owned ? ' owned' : ''}"><span class="rarity-badge ${rarity}"></span>${label}${need}</span>`;
    }).join('');
    const extra = pr.details.length > maxTags ? `<span class="recipe-item-tag">+${pr.details.length - maxTags}</span>` : '';

    const card = document.createElement('div');
    card.className = `recipe-card${isPrime ? ' prime' : ''}${isCrafted ? ' crafted' : ''}${recipe.imageName ? ' has-image' : ''}`;
    card.innerHTML = `
        ${imgHtml}
        <div class="recipe-card-header">
            <div>
                <div class="recipe-name">${recipe.name}</div>
                <div class="recipe-category">${recipe.category}</div>
            </div>
            <div class="recipe-header-badges">
                <span class="crafted-badge ${isCrafted ? 'is-crafted' : 'not-crafted'}" title="${isCrafted ? 'Desmarcar' : 'Fabricar'}">
                    ${isCrafted ? '🔨 FABRICADO' : '🔨'}
                </span>
                <span class="recipe-badge ${badgeClass}">${badgeText}</span>
            </div>
        </div>
        <div class="recipe-card-body">
            <div class="recipe-progress-bar">
                <div class="recipe-progress-fill ${fillClass}" style="width:${pct}%"></div>
            </div>
            <div class="recipe-items-preview">${tags}${extra}</div>
            <div class="recipe-counter">${pr.owned}/${pr.total}</div>
        </div>
        ${!isCrafted && pr.maxCrafts > 0 ? `<div class="recipe-card-footer"><div class="craft-count-badge">Pode fabricar: <strong>${pr.maxCrafts}x</strong></div></div>` : ''}`;

    card.querySelector('.crafted-badge').addEventListener('click', e => {
        e.stopPropagation();
        handleCraftToggle(recipe, pr, isCrafted);
    });

    card.addEventListener('click', e => {
        if (e.target.closest('.crafted-badge')) return;
        openDetail(recipe);
    });

    return card;
}

function handleCraftToggle(recipe, progress, isCrafted) {
    if (isCrafted) {
        if (confirm(`Desmarcar "${recipe.name}"?\nItens devolvidos ao inventário.`)) {
            inv.uncraftRecipe(recipe);
            showToast(`${recipe.name} desmarcado`, 'error');
            renderAll();
        }
    } else {
        if (!progress.canCraft) {
            showToast('Faltam componentes!', 'error');
            return;
        }
        const list = recipe.components.map(c => `• ${c.displayName}${c.requiredQty > 1 ? ' x' + c.requiredQty : ''}`).join('\n');
        if (confirm(`Fabricar "${recipe.name}"?\n\nRemoverá:\n${list}`)) {
            inv.craftRecipe(recipe);
            showToast(`🔨 ${recipe.name} fabricado!`, 'craft');
            renderAll();
        }
    }
}

function renderRecipeStats() {
    let total = RECIPES.length;
    let complete = 0, craftable = 0, crafted = 0, ownedComp = 0, totalComp = 0;
    RECIPES.forEach(r => {
        const p = getProgress(r);
        totalComp += p.total;
        ownedComp += p.owned;
        if (inv.isCrafted(r.name)) crafted++;
        else if (p.canCraft) craftable++;
        if (p.percentage === 100) complete++;
    });
    el.recipesStats.innerHTML = `
        <div class="stat-card"><div class="stat-icon blue">📋</div><div class="stat-info"><div class="stat-value">${total}</div><div class="stat-label">Total</div></div></div>
        <div class="stat-card"><div class="stat-icon green">✅</div><div class="stat-info"><div class="stat-value">${complete}</div><div class="stat-label">Completas</div></div></div>
        <div class="stat-card"><div class="stat-icon orange">🔶</div><div class="stat-info"><div class="stat-value">${craftable}</div><div class="stat-label">Fabricáveis</div></div></div>
        <div class="stat-card"><div class="stat-icon red">🔨</div><div class="stat-info"><div class="stat-value">${crafted}</div><div class="stat-label">Fabricados</div></div></div>
        <div class="stat-card"><div class="stat-icon gold">🧩</div><div class="stat-info"><div class="stat-value">${ownedComp}/${totalComp}</div><div class="stat-label">Componentes</div></div></div>`;
}

function openDetail(recipe) {
    const pr = inv.getRecipeProgress(recipe);
    const isPrime = recipe.name.includes('Prime');
    const pct = pr.percentage;
    const isCrafted = inv.isCrafted(recipe.name);

    let fillClass;
    if (isPrime) fillClass = pct === 100 ? 'gold' : pct > 0 ? 'orange' : 'red';
    else fillClass = pct === 100 ? 'green' : pct > 0 ? 'orange' : 'red';

    const imgHtml = recipe.imageName
        ? `<div style="text-align:center;margin-bottom:16px;"><img src="${CONFIG.IMG_CDN || 'https://cdn.warframestat.us/img/'}${recipe.imageName}" alt="${recipe.name}" style="max-height:120px;object-fit:contain;" onerror="this.style.display='none';"></div>`
        : '';

    let h = `${imgHtml}
        <div style="margin-bottom:16px;">
            <div class="recipe-detail-category">${recipe.category}</div>
            ${recipe.description ? `<p style="color:var(--text-muted);font-size:13px;margin-top:6px;">${recipe.description}</p>` : ''}
        </div>
        <div class="recipe-detail-progress">
            <div class="recipe-detail-progress-bar"><div class="recipe-detail-progress-fill ${fillClass}" style="width:${pct}%"></div></div>
            <div class="recipe-detail-progress-text">${pr.owned}/${pr.total}</div>
        </div>
        <div class="recipe-detail-items">`;

    pr.details.forEach(it => {
        const qtyInfo = `${it.quantity}/${it.requiredQty}`;
        const rarity = COMP_MAP[it.id]?.rarity || 'unknown';
        const rarityName = getRarityName(rarity);

        h += `<div class="recipe-detail-item rarity-${rarity} ${it.owned ? 'owned' : 'missing'}">
            <div class="recipe-detail-item-name">
                <span class="rarity-badge ${rarity}"></span>
                ${it.owned ? '✓' : '✗'} ${it.displayName}
                <span style="color:var(--accent-primary);font-size:12px;font-family:Orbitron;">(${qtyInfo})</span>
                <span class="rarity-label ${rarity}" style="margin-left:8px;">${rarityName}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span class="recipe-detail-item-status ${it.owned ? 'owned' : 'missing'}">${it.owned ? 'OK' : 'Faltando'}</span>
                <button class="toggle-btn ${it.owned ? 'remove-inv' : 'add-inv'}" data-comp-id="${it.id}" data-action="${it.owned ? 'remove' : 'add'}">${it.owned ? 'Remover' : 'Adicionar'}</button>
            </div>
        </div>`;
    });
    h += `</div>`;

    const craftClass = isCrafted ? 'is-crafted' : pr.canCraft ? 'can-craft' : '';
    const titleClass = isCrafted ? 'crafted' : pr.canCraft ? 'available' : 'unavailable';
    const titleText = isCrafted ? '🔨 FABRICADO' : pr.canCraft ? '⚡ PRONTO' : '🔒 FALTAM COMPONENTES';

    h += `<div class="craft-section ${craftClass}">
        <div class="craft-section-header">
            <div class="craft-section-title ${titleClass}">${titleText}</div>
            ${!isCrafted && pr.maxCrafts > 0 ? `<div class="craft-possible">Pode fabricar: <strong>${pr.maxCrafts}x</strong></div>` : ''}
        </div>`;

    if (isCrafted) {
        const ct = inv.getCraftedTime(recipe.name);
        h += `<div class="crafted-status">
            <div>
                <div class="crafted-status-text">✅ Fabricado</div>
                <div class="crafted-status-time">${ct ? new Date(ct).toLocaleString('pt-BR') : ''}</div>
            </div>
        </div>
        <div class="craft-actions" style="margin-top:12px;">
            <button class="btn-primary btn-warning" id="btnUncraft">↩️ DESFAZER</button>
        </div>
        <div class="craft-warning">⚠️ Devolve componentes ao inventário</div>`;
    } else if (pr.canCraft) {
        h += `<div class="craft-actions">
            <button class="btn-primary btn-danger" id="btnCraft">🔨 FABRICAR</button>
        </div>
        <div class="craft-warning">⚠️ Remove componentes do inventário</div>`;
    } else {
        h += `<div style="font-size:13px;color:var(--text-muted);">Adicione todos os componentes na quantidade necessária.</div>`;
    }
    h += `</div>`;

    if (recipe.wikiaUrl) {
        h += `<div style="margin-top:16px;text-align:center;">
            <a href="${recipe.wikiaUrl}" target="_blank" style="color:var(--accent-primary);font-size:13px;text-decoration:none;">📖 Wiki</a>
        </div>`;
    }

    el.recipeDetailTitle.textContent = recipe.name;
    el.recipeDetailBody.innerHTML = h;
    el.recipeDetailModal.classList.remove('hidden');

    el.recipeDetailBody.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const id = btn.dataset.compId;
            const dn = COMP_MAP[id]?.displayName || id;
            if (btn.dataset.action === 'add') {
                inv.addItem(id, 1);
                showToast(`${dn} adicionado!`);
            } else {
                inv.removeItem(id);
                showToast(`${dn} removido`, 'error');
            }
            openDetail(recipe);
            renderAll();
        });
    });

    const btnCraft = el.recipeDetailBody.querySelector('#btnCraft');
    if (btnCraft) {
        btnCraft.addEventListener('click', () => {
            if (confirm(`Fabricar "${recipe.name}"?`)) {
                inv.craftRecipe(recipe);
                showToast(`🔨 Fabricado!`, 'craft');
                openDetail(recipe);
                renderAll();
            }
        });
    }

    const btnUncraft = el.recipeDetailBody.querySelector('#btnUncraft');
    if (btnUncraft) {
        btnUncraft.addEventListener('click', () => {
            if (confirm(`Desfazer "${recipe.name}"?`)) {
                inv.uncraftRecipe(recipe);
                showToast('Desmarcado', 'error');
                openDetail(recipe);
                renderAll();
            }
        });
    }
}
