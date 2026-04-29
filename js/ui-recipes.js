/**
 * ui-recipes.js
 * Renderiza cards de receitas, stats e modal de detalhes
 */

function renderRecipes() {
    const search = normalize(el.recipeSearch.value);
    const catFilter = el.categoryFilter.value;
    const progFilter = el.progressFilter.value;

    let filtered = RECIPES.filter(recipe => {
        if (search && !normalize(recipe.name).includes(search)) return false;
        if (catFilter !== 'all' && recipe.category !== catFilter) return false;
        if (progFilter !== 'all') {
            const p = inv.getRecipeProgress(recipe);
            const isCrafted = inv.isCrafted(recipe.name);
            if (progFilter === 'complete'  && p.percentage !== 100) return false;
            if (progFilter === 'partial'   && (p.percentage === 0 || p.percentage === 100)) return false;
            if (progFilter === 'none'      && p.percentage !== 0) return false;
            if (progFilter === 'craftable' && !p.canCraft) return false;
            if (progFilter === 'crafted'   && !isCrafted) return false;
        }
        return true;
    });

    filtered.sort((a, b) => {
        const ca = inv.isCrafted(a.name), cb = inv.isCrafted(b.name);
        if (ca && !cb) return 1;
        if (cb && !ca) return -1;
        const pa = inv.getRecipeProgress(a).percentage;
        const pb = inv.getRecipeProgress(b).percentage;
        if (pa === 100 && pb !== 100) return 1;
        if (pb === 100 && pa !== 100) return -1;
        if (pb !== pa) return pb - pa;
        return a.name.localeCompare(b.name);
    });

    el.recipesGrid.innerHTML = '';

    if (!filtered.length) {
        el.recipesGrid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><h3>Nenhuma receita encontrada</h3><p>Ajuste os filtros</p></div>`;
        return;
    }

    filtered.forEach(recipe => el.recipesGrid.appendChild(createRecipeCard(recipe)));
}

function createRecipeCard(recipe) {
    const pr = inv.getRecipeProgress(recipe);
    const isPrime = recipe.name.includes('Prime');
    const pct = pr.percentage;
    const isCrafted = inv.isCrafted(recipe.name);

    let badgeClass, badgeText;
    if (isCrafted)       { badgeClass = 'none';     badgeText = 'Fabricado';   }
    else if (pct === 100){ badgeClass = 'complete';  badgeText = 'Completo';    }
    else if (pct > 0)    { badgeClass = 'partial';   badgeText = 'Parcial';     }
    else                 { badgeClass = 'none';      badgeText = 'Faltam todos';}

    let fillClass;
    if (isPrime) fillClass = pct === 100 ? 'gold' : pct > 0 ? 'orange' : 'red';
    else         fillClass = pct === 100 ? 'green': pct > 0 ? 'orange' : 'red';

    const tags = pr.details.map(d => {
        let label = d.rawName || d.displayName;
        if (label.length > 20) label = label.substring(0, 17) + '...';
        const qty = d.quantity > 1 ? ` <small>x${d.quantity}</small>` : '';
        return `<span class="recipe-item-tag${d.owned ? ' owned' : ''}">${d.owned ? '<span class="check">✓</span>' : ''}${label}${qty}</span>`;
    }).join('');

    const card = document.createElement('div');
    card.className = `recipe-card${isPrime ? ' prime' : ''}${isCrafted ? ' crafted' : ''}`;
    card.innerHTML = `
        <div class="recipe-card-header">
            <div>
                <div class="recipe-name">${recipe.name}</div>
                <div class="recipe-category">${recipe.category}</div>
            </div>
            <div class="recipe-header-badges">
                <span class="crafted-badge ${isCrafted ? 'is-crafted' : 'not-crafted'}"
                      title="${isCrafted ? 'Clique para desmarcar' : 'Clique para marcar como fabricado'}">
                    ${isCrafted ? '🔨 FABRICADO' : '🔨'}
                </span>
                <span class="recipe-badge ${badgeClass}">${badgeText}</span>
            </div>
        </div>
        <div class="recipe-card-body">
            <div class="recipe-progress-bar">
                <div class="recipe-progress-fill ${fillClass}" style="width:${pct}%"></div>
            </div>
            <div class="recipe-items-preview">${tags}</div>
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
        if (confirm(`Desmarcar "${recipe.name}" como fabricado?\n\nOs componentes serão devolvidos ao inventário.`)) {
            inv.uncraftRecipe(recipe);
            showToast(`${recipe.name} desmarcado — itens devolvidos`, 'error');
            renderAll();
        }
    } else {
        if (!progress.canCraft) {
            showToast(`Faltam componentes para fabricar ${recipe.name}!`, 'error');
            return;
        }
        if (confirm(`Fabricar "${recipe.name}"?\n\nRemoverá 1 de cada componente:\n${recipe.components.map(c => '• ' + c.displayName).join('\n')}`)) {
            inv.craftRecipe(recipe);
            showToast(`🔨 ${recipe.name} fabricado!`, 'craft');
            renderAll();
        }
    }
}

function renderRecipeStats() {
    let total = RECIPES.length, complete = 0, craftable = 0, crafted = 0, ownedComp = 0, totalComp = 0;
    RECIPES.forEach(recipe => {
        const p = inv.getRecipeProgress(recipe);
        totalComp += p.total; ownedComp += p.owned;
        if (inv.isCrafted(recipe.name)) crafted++;
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
    else         fillClass = pct === 100 ? 'green': pct > 0 ? 'orange' : 'red';

    let html = `
        <div style="margin-bottom:16px;">
            <div class="recipe-detail-category">${recipe.category}</div>
            ${recipe.description ? `<p style="color:var(--text-muted);font-size:13px;margin-top:6px;">${recipe.description}</p>` : ''}
        </div>
        <div class="recipe-detail-progress">
            <div class="recipe-detail-progress-bar"><div class="recipe-detail-progress-fill ${fillClass}" style="width:${pct}%"></div></div>
            <div class="recipe-detail-progress-text">${pr.owned}/${pr.total}</div>
        </div>
        <div class="recipe-detail-items">`;

    pr.details.forEach(item => {
        const qty = item.quantity > 1 ? ` <span style="color:var(--accent-primary);font-size:12px;font-family:Orbitron;">(x${item.quantity})</span>` : '';
        html += `
            <div class="recipe-detail-item ${item.owned ? 'owned' : 'missing'}">
                <div class="recipe-detail-item-name">${item.owned ? '✓' : '✗'} ${item.displayName}${qty}</div>
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <span class="recipe-detail-item-status ${item.owned ? 'owned' : 'missing'}">${item.owned ? `${item.quantity} no inv.` : 'Faltando'}</span>
                    <button class="toggle-btn ${item.owned ? 'remove-inv' : 'add-inv'}" data-comp-id="${item.id}" data-action="${item.owned ? 'remove' : 'add'}">${item.owned ? 'Remover' : 'Adicionar'}</button>
                </div>
            </div>`;
    });
    html += `</div>`;

    // Seção de fabricação
    const craftClass = isCrafted ? 'is-crafted' : pr.canCraft ? 'can-craft' : '';
    const titleClass = isCrafted ? 'crafted' : pr.canCraft ? 'available' : 'unavailable';
    const titleText  = isCrafted ? '🔨 FABRICADO' : pr.canCraft ? '⚡ PRONTO PARA FABRICAR' : '🔒 COMPONENTES FALTANDO';

    html += `<div class="craft-section ${craftClass}">
        <div class="craft-section-header">
            <div class="craft-section-title ${titleClass}">${titleText}</div>
            ${!isCrafted && pr.maxCrafts > 0 ? `<div class="craft-possible">Fabricações possíveis: <strong>${pr.maxCrafts}x</strong></div>` : ''}
        </div>`;

    if (isCrafted) {
        const craftTime = inv.getCraftedTime(recipe.name);
        html += `
            <div class="crafted-status">
                <div>
                    <div class="crafted-status-text">✅ Item fabricado</div>
                    <div class="crafted-status-time">Fabricado em: ${craftTime ? new Date(craftTime).toLocaleString('pt-BR') : 'Data desconhecida'}</div>
                </div>
            </div>
            <div class="craft-actions" style="margin-top:12px;">
                <button class="btn-primary btn-warning" id="btnUncraft">↩️ DESFAZER FABRICAÇÃO</button>
            </div>
            <div class="craft-warning">⚠️ Desfazer devolverá 1 de cada componente ao inventário</div>`;
    } else if (pr.canCraft) {
        html += `
            <div class="craft-actions">
                <button class="btn-primary btn-danger" id="btnCraft">🔨 FABRICAR</button>
            </div>
            <div class="craft-warning">⚠️ Fabricar removerá 1 de cada componente do inventário</div>`;
    } else {
        html += `<div style="font-size:13px;color:var(--text-muted);">Adicione todos os componentes para fabricar.</div>`;
    }
    html += `</div>`;

    if (recipe.wikiaUrl) html += `<div style="margin-top:16px;text-align:center;"><a href="${recipe.wikiaUrl}" target="_blank" rel="noopener" style="color:var(--accent-primary);font-size:13px;text-decoration:none;">📖 Wiki</a></div>`;

    el.recipeDetailTitle.textContent = recipe.name;
    el.recipeDetailBody.innerHTML = html;
    el.recipeDetailModal.classList.remove('hidden');

    el.recipeDetailBody.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const id = btn.dataset.compId;
            const dn = COMP_MAP[id]?.displayName || id;
            if (btn.dataset.action === 'add') { inv.addItem(id, 1); showToast(`${dn} adicionado!`); }
            else { inv.removeItem(id); showToast(`${dn} removido`, 'error'); }
            openDetail(recipe); renderAll();
        });
    });

    const btnCraft = el.recipeDetailBody.querySelector('#btnCraft');
    if (btnCraft) btnCraft.addEventListener('click', () => {
        if (confirm(`Fabricar "${recipe.name}"?\n\nRemoverá 1 de cada componente.`)) {
            inv.craftRecipe(recipe);
            showToast(`🔨 ${recipe.name} fabricado!`, 'craft');
            openDetail(recipe); renderAll();
        }
    });

    const btnUncraft = el.recipeDetailBody.querySelector('#btnUncraft');
    if (btnUncraft) btnUncraft.addEventListener('click', () => {
        if (confirm(`Desfazer fabricação de "${recipe.name}"?\n\nDevolverá os componentes.`)) {
            inv.uncraftRecipe(recipe);
            showToast(`${recipe.name} desmarcado`, 'error');
            openDetail(recipe); renderAll();
        }
    });
}