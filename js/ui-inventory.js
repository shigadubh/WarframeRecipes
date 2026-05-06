/**
 * ui-inventory.js
 * Renderiza inventário e modal de adicionar item com raridade
 */

function getRarityNameInv(rarity) {
    if (rarity === 'common') return 'Comum';
    if (rarity === 'uncommon') return 'Incomum';
    if (rarity === 'rare') return 'Raro';
    return '?';
}

function renderInventory() {
    const search = normalize(el.inventorySearch.value);
    let items = inv.getAllItems();

    if (search) {
        items = items.filter(item => {
            const dn = COMP_MAP[item.id]?.displayName || item.id;
            const pn = COMP_MAP[item.id]?.parentName || '';
            return normalize(dn).includes(search) || normalize(pn).includes(search);
        });
    }

    el.inventoryList.innerHTML = '';

    if (!items.length) {
        el.inventoryList.innerHTML = `<div class="empty-state"><h3>Inventário vazio</h3><p>Clique em "Adicionar Item"</p></div>`;
        return;
    }

    items.forEach(item => {
        const info = COMP_MAP[item.id] || { displayName: item.id, parentName: '?', rarity: 'unknown' };
        const rarity = info.rarity || 'unknown';
        const rarityName = getRarityNameInv(rarity);
        const recipes = inv.findRecipesUsing(item.id);
        const rt = recipes.length ? `Receita: ${recipes.map(r => r.name).join(', ')}` : 'Sem receita';

        const div = document.createElement('div');
        div.className = `inventory-item rarity-${rarity}`;
        div.innerHTML = `
            <div class="inventory-item-info">
                <div class="inventory-item-name">
                    <span class="rarity-badge ${rarity}"></span>${info.displayName}
                    <span class="rarity-label ${rarity}" style="margin-left:6px;">${rarityName}</span>
                </div>
                <div class="inventory-item-parent">📦 ${info.parentName}</div>
                <div class="inventory-item-recipes">${rt}</div>
            </div>
            <div class="inventory-item-actions">
                <div class="quantity-control">
                    <button class="quantity-btn minus">−</button>
                    <span class="quantity-value">${item.quantity}</span>
                    <button class="quantity-btn plus">+</button>
                </div>
                <button class="btn-danger-outline delete-btn">✗</button>
            </div>`;

        div.querySelector('.minus').addEventListener('click', () => {
            if (item.quantity <= 1) {
                inv.removeItem(item.id);
                showToast(`${info.displayName} removido`, 'error');
            } else {
                inv.setQty(item.id, item.quantity - 1);
            }
            renderAll();
        });

        div.querySelector('.plus').addEventListener('click', () => {
            inv.setQty(item.id, item.quantity + 1);
            renderAll();
        });

        div.querySelector('.delete-btn').addEventListener('click', () => {
            inv.removeItem(item.id);
            showToast(`${info.displayName} removido`, 'error');
            renderAll();
        });

        el.inventoryList.appendChild(div);
    });
}

function renderInventoryStats() {
    const items = inv.getAllItems();
    const u = items.length;
    const t = items.reduce((s, i) => s + i.quantity, 0);

    el.inventoryStats.innerHTML = `
        <div class="stat-card"><div class="stat-icon blue">📦</div><div class="stat-info"><div class="stat-value">${u}</div><div class="stat-label">Itens Únicos</div></div></div>
        <div class="stat-card"><div class="stat-icon gold">🔢</div><div class="stat-info"><div class="stat-value">${t}</div><div class="stat-label">Total Peças</div></div></div>
        <div class="stat-card"><div class="stat-icon green">💾</div><div class="stat-info"><div class="stat-value" style="font-size:14px;">${timeAgo(inv.getLastSave())}</div><div class="stat-label">Último Save</div></div></div>`;
}

function renderAddItemList() {
    const search = normalize(el.addItemSearch.value);
    let items = ALL_COMPONENTS;

    if (search) {
        items = items.filter(c =>
            normalize(c.displayName).includes(search) ||
            normalize(c.parentName).includes(search)
        );
    }

    const display = items.slice(0, 80);
    el.addItemList.innerHTML = '';

    // Legenda de raridade
    const legend = document.createElement('div');
    legend.className = 'rarity-legend';
    legend.innerHTML = `
        <strong style="color:var(--text-primary);font-size:11px;letter-spacing:1px;">RARIDADE:</strong>
        <span class="rarity-legend-item"><span class="rarity-badge common"></span>Comum</span>
        <span class="rarity-legend-item"><span class="rarity-badge uncommon"></span>Incomum</span>
        <span class="rarity-legend-item"><span class="rarity-badge rare"></span>Raro</span>
        <span class="rarity-legend-item"><span class="rarity-badge unknown"></span>?</span>`;
    el.addItemList.appendChild(legend);

    if (!display.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.style.padding = '20px';
        empty.innerHTML = '<p>Nenhum item encontrado</p>';
        el.addItemList.appendChild(empty);
        return;
    }

    display.forEach(comp => {
        const inI = inv.hasItem(comp.id);
        const qty = inv.getQty(comp.id);
        const rarity = comp.rarity || 'unknown';
        const rarityName = getRarityNameInv(rarity);

        const div = document.createElement('div');
        div.className = `add-item-option rarity-${rarity}${inI ? ' in-inventory' : ''}`;
        div.innerHTML = `
            <div style="min-width:0;flex:1;">
                <div class="add-item-option-name">
                    <span class="rarity-badge ${rarity}"></span>${comp.displayName}
                    ${inI ? ` <small style="color:var(--success);">(x${qty})</small>` : ''}
                    <span class="rarity-label ${rarity}" style="margin-left:6px;">${rarityName}</span>
                </div>
                <div class="add-item-option-sub">📦 ${comp.parentName}</div>
            </div>
            <button class="add-item-option-btn ${inI ? 'remove' : 'add'}">${inI ? 'Remover' : 'Adicionar'}</button>`;

        div.querySelector('button').addEventListener('click', e => {
            e.stopPropagation();
            if (inI) {
                inv.removeItem(comp.id);
                showToast(`${comp.displayName} removido`, 'error');
            } else {
                inv.addItem(comp.id, 1);
                showToast(`${comp.displayName} adicionado!`);
            }
            renderAddItemList();
            renderAll();
        });

        el.addItemList.appendChild(div);
    });

    if (items.length > 80) {
        const m = document.createElement('div');
        m.className = 'empty-state';
        m.style.padding = '10px';
        m.innerHTML = `<p style="font-size:12px;">Mostrando 80 de ${items.length}. Refine a busca.</p>`;
        el.addItemList.appendChild(m);
    }
}
