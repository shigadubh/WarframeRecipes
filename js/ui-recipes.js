let progressCache={}, progressCacheDirty=true;
function invalidateProgressCache(){progressCacheDirty=true;}
function getProgress(recipe){if(progressCacheDirty){progressCache={};progressCacheDirty=false;}if(!progressCache[recipe.name])progressCache[recipe.name]=inv.getRecipeProgress(recipe);return progressCache[recipe.name];}

let recipePage=0;const RECIPES_PER_PAGE=50;let filteredRecipesCache=[];
let recipeSearchTimer=null;
function setupRecipeSearchDebounce(){el.recipeSearch.addEventListener('input',()=>{clearTimeout(recipeSearchTimer);recipeSearchTimer=setTimeout(()=>{recipePage=0;renderRecipes();},300);});}

function renderRecipes(){
    invalidateProgressCache();
    const s=normalize(el.recipeSearch.value),cf=el.categoryFilter.value,pf=el.progressFilter.value;
    filteredRecipesCache=RECIPES.filter(r=>{
        if(s&&!normalize(r.name).includes(s))return false;
        if(cf!=='all'&&r.category!==cf)return false;
        if(pf!=='all'){const p=getProgress(r);const ic=inv.isCrafted(r.name);if(pf==='complete'&&p.percentage!==100)return false;if(pf==='partial'&&(p.percentage===0||p.percentage===100))return false;if(pf==='none'&&p.percentage!==0)return false;if(pf==='craftable'&&!p.canCraft)return false;if(pf==='crafted'&&!ic)return false;}
        return true;
    });
    filteredRecipesCache.sort((a,b)=>{const ca=inv.isCrafted(a.name),cb=inv.isCrafted(b.name);if(ca&&!cb)return 1;if(cb&&!ca)return-1;const pa=getProgress(a).percentage,pb=getProgress(b).percentage;if(pa===100&&pb!==100)return 1;if(pb===100&&pa!==100)return-1;if(pb!==pa)return pb-pa;return a.name.localeCompare(b.name);});
    el.recipesGrid.innerHTML='';recipePage=0;
    if(!filteredRecipesCache.length){el.recipesGrid.innerHTML=`<div class="empty-state" style="grid-column:1/-1;"><h3>Nenhuma receita encontrada</h3><p>Ajuste os filtros</p></div>`;return;}
    appendRecipePage();
}

function appendRecipePage(){
    const start=recipePage*RECIPES_PER_PAGE,end=Math.min(start+RECIPES_PER_PAGE,filteredRecipesCache.length);
    const frag=document.createDocumentFragment();
    for(let i=start;i<end;i++)frag.appendChild(createRecipeCard(filteredRecipesCache[i]));
    el.recipesGrid.appendChild(frag);recipePage++;
    const ex=el.recipesGrid.querySelector('.load-more-btn');if(ex)ex.remove();
    if(end<filteredRecipesCache.length){
        const lm=document.createElement('div');lm.className='empty-state load-more-btn';lm.style.cssText='grid-column:1/-1;padding:20px;cursor:pointer;';
        lm.innerHTML=`<button class="btn-secondary" style="margin:0 auto;">Carregar mais (${filteredRecipesCache.length-end} restantes)</button>`;
        lm.addEventListener('click',()=>{lm.remove();appendRecipePage();});
        el.recipesGrid.appendChild(lm);
    }
}

function createRecipeCard(recipe){
    const pr=getProgress(recipe),isPrime=recipe.name.includes('Prime'),pct=pr.percentage,isCrafted=inv.isCrafted(recipe.name);
    let bc,bt;if(isCrafted){bc='none';bt='Fabricado';}else if(pct===100){bc='complete';bt='Completo';}else if(pct>0){bc='partial';bt='Parcial';}else{bc='none';bt='Faltam todos';}
    let fc;if(isPrime)fc=pct===100?'gold':pct>0?'orange':'red';else fc=pct===100?'green':pct>0?'orange':'red';

    const imgHtml=recipe.imageName?`<div class="recipe-card-image"><img src="${CONFIG.IMG_CDN}${recipe.imageName}" alt="${recipe.name}" loading="lazy" onerror="this.parentNode.innerHTML='<span class=\\'image-placeholder\\'>📦</span>';"></div>`:'';

    const maxTags=6,tagsToShow=pr.details.slice(0,maxTags);
    const tags=tagsToShow.map(d=>{
        let l=d.rawName||d.displayName;if(l.length>18)l=l.substring(0,15)+'...';
        const need=d.requiredQty>1?` <small style="color:var(--accent-primary);">(${d.quantity}/${d.requiredQty})</small>`:'';
        return`<span class="recipe-item-tag${d.owned?' owned':''}">${d.owned?'<span class="check">✓</span>':''}${l}${need}</span>`;
    }).join('');
    const extra=pr.details.length>maxTags?`<span class="recipe-item-tag">+${pr.details.length-maxTags}</span>`:'';

    const card=document.createElement('div');
    card.className=`recipe-card${isPrime?' prime':''}${isCrafted?' crafted':''}${recipe.imageName?' has-image':''}`;
    card.innerHTML=`${imgHtml}<div class="recipe-card-header"><div><div class="recipe-name">${recipe.name}</div><div class="recipe-category">${recipe.category}</div></div><div class="recipe-header-badges"><span class="crafted-badge ${isCrafted?'is-crafted':'not-crafted'}" title="${isCrafted?'Desmarcar':'Fabricar'}">${isCrafted?'🔨 FABRICADO':'🔨'}</span><span class="recipe-badge ${bc}">${bt}</span></div></div><div class="recipe-card-body"><div class="recipe-progress-bar"><div class="recipe-progress-fill ${fc}" style="width:${pct}%"></div></div><div class="recipe-items-preview">${tags}${extra}</div><div class="recipe-counter">${pr.owned}/${pr.total}</div></div>${!isCrafted&&pr.maxCrafts>0?`<div class="recipe-card-footer"><div class="craft-count-badge">Pode fabricar: <strong>${pr.maxCrafts}x</strong></div></div>`:''}`;

    card.querySelector('.crafted-badge').addEventListener('click',e=>{e.stopPropagation();handleCraftToggle(recipe,pr,isCrafted);});
    card.addEventListener('click',e=>{if(e.target.closest('.crafted-badge'))return;openDetail(recipe);});
    return card;
}

function handleCraftToggle(recipe,progress,isCrafted){
    if(isCrafted){if(confirm(`Desmarcar "${recipe.name}"?\nItens devolvidos ao inventário.`)){inv.uncraftRecipe(recipe);showToast(`${recipe.name} desmarcado`,'error');renderAll();}}
    else{if(!progress.canCraft){showToast('Faltam componentes!','error');return;}
    const list=recipe.components.map(c=>`• ${c.displayName}${c.requiredQty>1?' x'+c.requiredQty:''}`).join('\n');
    if(confirm(`Fabricar "${recipe.name}"?\n\nRemoverá:\n${list}`)){inv.craftRecipe(recipe);showToast(`🔨 ${recipe.name} fabricado!`,'craft');renderAll();}}
}

function renderRecipeStats(){
    let total=RECIPES.length,complete=0,craftable=0,crafted=0,ownedComp=0,totalComp=0;
    RECIPES.forEach(r=>{const p=getProgress(r);totalComp+=p.total;ownedComp+=p.owned;if(inv.isCrafted(r.name))crafted++;else if(p.canCraft)craftable++;if(p.percentage===100)complete++;});
    el.recipesStats.innerHTML=`<div class="stat-card"><div class="stat-icon blue">📋</div><div class="stat-info"><div class="stat-value">${total}</div><div class="stat-label">Total</div></div></div><div class="stat-card"><div class="stat-icon green">✅</div><div class="stat-info"><div class="stat-value">${complete}</div><div class="stat-label">Completas</div></div></div><div class="stat-card"><div class="stat-icon orange">🔶</div><div class="stat-info"><div class="stat-value">${craftable}</div><div class="stat-label">Fabricáveis</div></div></div><div class="stat-card"><div class="stat-icon red">🔨</div><div class="stat-info"><div class="stat-value">${crafted}</div><div class="stat-label">Fabricados</div></div></div><div class="stat-card"><div class="stat-icon gold">🧩</div><div class="stat-info"><div class="stat-value">${ownedComp}/${totalComp}</div><div class="stat-label">Componentes</div></div></div>`;
}

function openDetail(recipe){
    const pr=inv.getRecipeProgress(recipe),isPrime=recipe.name.includes('Prime'),pct=pr.percentage,isCrafted=inv.isCrafted(recipe.name);
    let fc;if(isPrime)fc=pct===100?'gold':pct>0?'orange':'red';else fc=pct===100?'green':pct>0?'orange':'red';

    const imgHtml=recipe.imageName?`<div style="text-align:center;margin-bottom:16px;"><img src="${CONFIG.IMG_CDN}${recipe.imageName}" alt="${recipe.name}" style="max-height:120px;object-fit:contain;" onerror="this.style.display='none';"></div>`:'';

    let h=`${imgHtml}<div style="margin-bottom:16px;"><div class="recipe-detail-category">${recipe.category}</div>${recipe.description?`<p style="color:var(--text-muted);font-size:13px;margin-top:6px;">${recipe.description}</p>`:''}</div>
    <div class="recipe-detail-progress"><div class="recipe-detail-progress-bar"><div class="recipe-detail-progress-fill ${fc}" style="width:${pct}%"></div></div><div class="recipe-detail-progress-text">${pr.owned}/${pr.total}</div></div>
    <div class="recipe-detail-items">`;

    pr.details.forEach(it=>{
        const qtyInfo=`${it.quantity}/${it.requiredQty}`;
        h+=`<div class="recipe-detail-item ${it.owned?'owned':'missing'}"><div class="recipe-detail-item-name">${it.owned?'✓':'✗'} ${it.displayName} <span style="color:var(--accent-primary);font-size:12px;font-family:Orbitron;">(${qtyInfo})</span></div><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><span class="recipe-detail-item-status ${it.owned?'owned':'missing'}">${it.owned?'OK':'Faltando'}</span><button class="toggle-btn ${it.owned?'remove-inv':'add-inv'}" data-comp-id="${it.id}" data-action="${it.owned?'remove':'add'}">${it.owned?'Remover':'Adicionar'}</button></div></div>`;
    });
    h+=`</div>`;

    const craftClass=isCrafted?'is-crafted':pr.canCraft?'can-craft':'';
    const titleClass=isCrafted?'crafted':pr.canCraft?'available':'unavailable';
    const titleText=isCrafted?'🔨 FABRICADO':pr.canCraft?'⚡ PRONTO':'🔒 FALTAM COMPONENTES';
    h+=`<div class="craft-section ${craftClass}"><div class="craft-section-header"><div class="craft-section-title ${titleClass}">${titleText}</div>${!isCrafted&&pr.maxCrafts>0?`<div class="craft-possible">Pode fabricar: <strong>${pr.maxCrafts}x</strong></div>`:''}</div>`;
    if(isCrafted){const ct=inv.getCraftedTime(recipe.name);h+=`<div class="crafted-status"><div><div class="crafted-status-text">✅ Fabricado</div><div class="crafted-status-time">${ct?new Date(ct).toLocaleString('pt-BR'):''}</div></div></div><div class="craft-actions" style="margin-top:12px;"><button class="btn-primary btn-warning" id="btnUncraft">↩️ DESFAZER</button></div><div class="craft-warning">⚠️ Devolve componentes</div>`;}
    else if(pr.canCraft){h+=`<div class="craft-actions"><button class="btn-primary btn-danger" id="btnCraft">🔨 FABRICAR</button></div><div class="craft-warning">⚠️ Remove componentes</div>`;}
    else{h+=`<div style="font-size:13px;color:var(--text-muted);">Adicione todos os componentes na quantidade necessária.</div>`;}
    h+=`</div>`;
    if(recipe.wikiaUrl)h+=`<div style="margin-top:16px;text-align:center;"><a href="${recipe.wikiaUrl}" target="_blank" style="color:var(--accent-primary);font-size:13px;text-decoration:none;">📖 Wiki</a></div>`;

    el.recipeDetailTitle.textContent=recipe.name;el.recipeDetailBody.innerHTML=h;el.recipeDetailModal.classList.remove('hidden');

    el.recipeDetailBody.querySelectorAll('.toggle-btn').forEach(btn=>{btn.addEventListener('click',e=>{e.stopPropagation();const id=btn.dataset.compId,dn=COMP_MAP[id]?.displayName||id;if(btn.dataset.action==='add'){inv.addItem(id,1);showToast(`${dn} adicionado!`);}else{inv.removeItem(id);showToast(`${dn} removido`,'error');}openDetail(recipe);renderAll();});});
    const bc=el.recipeDetailBody.querySelector('#btnCraft');if(bc)bc.addEventListener('click',()=>{if(confirm(`Fabricar "${recipe.name}"?`)){inv.craftRecipe(recipe);showToast(`🔨 Fabricado!`,'craft');openDetail(recipe);renderAll();}});
    const bu=el.recipeDetailBody.querySelector('#btnUncraft');if(bu)bu.addEventListener('click',()=>{if(confirm(`Desfazer "${recipe.name}"?`)){inv.uncraftRecipe(recipe);showToast('Desmarcado','error');openDetail(recipe);renderAll();}});
}
