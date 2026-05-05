function renderCrafted(){
    const s=normalize(el.craftedSearch.value),cf=el.craftedCategoryFilter.value;
    let craftedRecipes=RECIPES.filter(r=>{
        if(!inv.isCrafted(r.name))return false;
        if(s&&!normalize(r.name).includes(s))return false;
        if(cf!=='all'&&r.category!==cf)return false;
        return true;
    });
    craftedRecipes.sort((a,b)=>{const ta=inv.getCraftedTime(a.name)||0,tb=inv.getCraftedTime(b.name)||0;return tb-ta;});
    el.craftedGrid.innerHTML='';
    if(!craftedRecipes.length){el.craftedGrid.innerHTML=`<div class="empty-state" style="grid-column:1/-1;"><h3>Nenhum item fabricado</h3><p>Itens fabricados na aba "Receitas" aparecerão aqui.</p></div>`;renderCraftedStats(0);return;}
    craftedRecipes.forEach(r=>el.craftedGrid.appendChild(createCraftedCard(r)));
    renderCraftedStats(craftedRecipes.length);
}

function createCraftedCard(recipe){
    const isPrime=recipe.name.includes('Prime'),craftTime=inv.getCraftedTime(recipe.name),pr=inv.getRecipeProgress(recipe);
    const imgSrc=recipe.imageName?`${CONFIG.IMG_CDN}${recipe.imageName}`:'';
    const imgHtml=imgSrc?`<div class="crafted-card-image"><img src="${imgSrc}" alt="${recipe.name}" loading="lazy" onerror="this.parentNode.innerHTML='<span class=\\'image-placeholder\\'>📦</span><span class=\\'crafted-overlay\\'>FABRICADO</span>';"><span class="crafted-overlay">FABRICADO</span></div>`:`<div class="crafted-card-image"><span class="image-placeholder">📦</span><span class="crafted-overlay">FABRICADO</span></div>`;
    const comps=pr.details.map(d=>{const need=d.requiredQty>1?` x${d.requiredQty}`:'';return`<span class="crafted-comp-tag">${d.rawName||d.displayName}${need}</span>`;}).join('');

    const card=document.createElement('div');card.className=`crafted-card${isPrime?' prime':''}`;
    card.innerHTML=`${imgHtml}<div class="crafted-card-body"><div class="crafted-card-name">${recipe.name}</div><div class="crafted-card-category">${recipe.category}</div><div class="crafted-card-date">📅 ${craftTime?new Date(craftTime).toLocaleDateString('pt-BR'):'Data desconhecida'}</div><div class="crafted-card-components">${comps}</div><div class="crafted-card-actions"><button class="btn-small btn-uncraft">↩️ DESFAZER</button><button class="btn-small btn-detail">📋 DETALHES</button></div></div>`;

    card.querySelector('.btn-uncraft').addEventListener('click',()=>{
        if(confirm(`Desfazer fabricação de "${recipe.name}"?\nComponentes serão devolvidos.`)){inv.uncraftRecipe(recipe);showToast(`${recipe.name} desmarcado`,'error');renderAll();}
    });
    card.querySelector('.btn-detail').addEventListener('click',()=>openDetail(recipe));
    return card;
}

function renderCraftedStats(count){
    const cats={};
    RECIPES.forEach(r=>{if(inv.isCrafted(r.name)){cats[r.category]=(cats[r.category]||0)+1;}});
    const topCat=Object.entries(cats).sort((a,b)=>b[1]-a[1])[0];
    el.craftedStats.innerHTML=`
        <div class="stat-card"><div class="stat-icon red">🔨</div><div class="stat-info"><div class="stat-value">${count}</div><div class="stat-label">Fabricados</div></div></div>
        ${topCat?`<div class="stat-card"><div class="stat-icon gold">⭐</div><div class="stat-info"><div class="stat-value" style="font-size:16px;">${topCat[0]}</div><div class="stat-label">Mais fabricado (${topCat[1]})</div></div></div>`:''}`;
}

function populateCraftedCategories(){
    const cats=WarframeAPI.getCategories(RECIPES);
    el.craftedCategoryFilter.innerHTML='<option value="all">Todas Categorias</option>';
    cats.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;el.craftedCategoryFilter.appendChild(o);});
}
