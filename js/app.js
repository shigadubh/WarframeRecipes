const el={
    loadingScreen:document.getElementById('loadingScreen'),loadingBar:document.getElementById('loadingBar'),loadingStatus:document.getElementById('loadingStatus'),loadingError:document.getElementById('loadingError'),
    app:document.getElementById('app'),loginModal:document.getElementById('loginModal'),loginInput:document.getElementById('loginInput'),pinSection:document.getElementById('pinSection'),pinInput:document.getElementById('pinInput'),pinHint:document.getElementById('pinHint'),loginSubtitle:document.getElementById('loginSubtitle'),btnLogin:document.getElementById('btnLogin'),loginStatus:document.getElementById('loginStatus'),
    userName:document.getElementById('userName'),btnChangeUser:document.getElementById('btnChangeUser'),apiStatusBadge:document.getElementById('apiStatusBadge'),backupBadge:document.getElementById('backupBadge'),syncBadge:document.getElementById('syncBadge'),
    recipeSearch:document.getElementById('recipeSearch'),categoryFilter:document.getElementById('categoryFilter'),progressFilter:document.getElementById('progressFilter'),recipesGrid:document.getElementById('recipesGrid'),recipesStats:document.getElementById('recipesStats'),
    inventorySearch:document.getElementById('inventorySearch'),inventoryList:document.getElementById('inventoryList'),inventoryStats:document.getElementById('inventoryStats'),
    btnAddItem:document.getElementById('btnAddItem'),addItemModal:document.getElementById('addItemModal'),addItemSearch:document.getElementById('addItemSearch'),addItemList:document.getElementById('addItemList'),
    recipeDetailModal:document.getElementById('recipeDetailModal'),recipeDetailTitle:document.getElementById('recipeDetailTitle'),recipeDetailBody:document.getElementById('recipeDetailBody'),
    btnImportExport:document.getElementById('btnImportExport'),importExportModal:document.getElementById('importExportModal'),exportData:document.getElementById('exportData'),importData:document.getElementById('importData'),btnCopyExport:document.getElementById('btnCopyExport'),btnImport:document.getElementById('btnImport'),
    btnRefreshApi:document.getElementById('btnRefreshApi'),btnForceSync:document.getElementById('btnForceSync'),
    backupInfoSection:document.getElementById('backupInfoSection'),backupSlots:document.getElementById('backupSlots'),
    craftedSearch:document.getElementById('craftedSearch'),craftedCategoryFilter:document.getElementById('craftedCategoryFilter'),craftedGrid:document.getElementById('craftedGrid'),craftedStats:document.getElementById('craftedStats'),
    toast:document.getElementById('toast'),
};

const inv=new InventoryManager();
let toastTimeout=null;

function showToast(m,t='success'){el.toast.textContent=m;el.toast.className=`toast ${t}`;el.toast.classList.remove('hidden');if(toastTimeout)clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.toast.classList.add('hidden'),2500);}
function normalize(s){return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();}
function setProgress(p,s){el.loadingBar.style.width=p+'%';el.loadingStatus.textContent=s;}
function timeAgo(ts){if(!ts)return'Nunca';const d=Date.now()-ts;if(d<60000)return'Agora';if(d<3600000)return`${Math.floor(d/60000)}min`;if(d<86400000)return`${Math.floor(d/3600000)}h`;return new Date(ts).toLocaleString('pt-BR');}

function renderAll(){invalidateProgressCache();renderRecipes();renderRecipeStats();renderInventory();renderInventoryStats();renderCrafted();updateBackupBadge();}
function updateBackupBadge(){const ls=inv.getLastSave();el.backupBadge.textContent=ls?'💾 SALVO':'⚠️';el.backupBadge.title=ls?`Save: ${timeAgo(ls)}`:'Sem dados';}
function updateApiStatus(){if(!API_LOADED){el.apiStatusBadge.className='api-status offline';el.apiStatusBadge.textContent='ERRO';return;}el.apiStatusBadge.className=API_SOURCE==='cache-expired'?'api-status offline':'api-status online';el.apiStatusBadge.textContent=API_SOURCE==='cache-expired'?'OFFLINE':API_SOURCE==='cache'?'CACHE ✓':'API ✓';el.apiStatusBadge.title=`${RECIPES.length} receitas | ${ALL_COMPONENTS.length} comp | ${API_SOURCE}`;}
function populateCategories(){const cats=WarframeAPI.getCategories(RECIPES);el.categoryFilter.innerHTML='<option value="all">Todas Categorias</option>';cats.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;el.categoryFilter.appendChild(o);});}

let loginCheckTimeout=null;
function setupLoginCheck(){
    el.loginInput.addEventListener('input',()=>{
        clearTimeout(loginCheckTimeout);const u=el.loginInput.value.trim();
        if(u.length<2){el.pinSection.style.display='none';el.loginSubtitle.textContent='Digite seu nome para entrar ou criar sua conta';return;}
        loginCheckTimeout=setTimeout(async()=>{
            try{const{data}=await supabaseClient.from('profiles').select('id,pin_hash').eq('username',u.toLowerCase().trim()).maybeSingle();
            if(data){el.loginSubtitle.textContent=`Bem-vindo de volta, ${u}!`;if(data.pin_hash){el.pinSection.style.display='block';el.pinHint.textContent='Digite seu PIN';el.pinInput.placeholder='PIN (4 dígitos)';}else{el.pinSection.style.display='none';}}
            else{el.loginSubtitle.textContent=`Criar conta para "${u}"`;el.pinSection.style.display='block';el.pinHint.textContent='Crie um PIN (opcional)';el.pinInput.placeholder='PIN novo (opcional)';}}
            catch(e){el.loginSubtitle.textContent='Modo offline';el.pinSection.style.display='none';}
        },500);
    });
}

async function handleLogin(){
    const u=el.loginInput.value.trim();if(!u||u.length<2){el.loginStatus.className='login-status error';el.loginStatus.textContent='Mínimo 2 caracteres';return;}
    const pin=el.pinInput?el.pinInput.value.trim():'';
    el.btnLogin.disabled=true;el.loginStatus.className='login-status loading';el.loginStatus.textContent='Conectando...';
    inv.loadUser(u);el.userName.textContent=u.toUpperCase();
    if(navigator.onLine){const r=await cloudSync.loginOrCreate(u,pin);if(!r.success){el.loginStatus.className='login-status error';el.loginStatus.textContent=r.error||'Erro';el.btnLogin.disabled=false;return;}el.loginStatus.className='login-status success';el.loginStatus.textContent=r.isNew?'✅ Conta criada!':'✅ Logado!';}
    else{el.loginStatus.className='login-status loading';el.loginStatus.textContent='📴 Offline';setSyncStatus('offline','📴 OFFLINE');}
    setTimeout(()=>{el.loginModal.classList.add('hidden');el.btnLogin.disabled=false;el.loginStatus.textContent='';invalidateProgressCache();renderAll();},800);
}

function setupEvents(){
    el.btnLogin.addEventListener('click',handleLogin);
    el.loginInput.addEventListener('keydown',e=>{if(e.key==='Enter'){if(el.pinSection.style.display!=='none'&&!el.pinInput.value)el.pinInput.focus();else handleLogin();}});
    if(el.pinInput)el.pinInput.addEventListener('keydown',e=>{if(e.key==='Enter')handleLogin();});
    setupLoginCheck();

    el.btnChangeUser.addEventListener('click',()=>{if(inv.currentUser){inv.save();inv.createBackup();cloudSync.push();}cloudSync.logout();el.loginModal.classList.remove('hidden');el.loginInput.value='';if(el.pinInput)el.pinInput.value='';el.pinSection.style.display='none';el.loginStatus.textContent='';el.loginSubtitle.textContent='Digite seu nome para entrar ou criar sua conta';setTimeout(()=>el.loginInput.focus(),100);});

    document.querySelectorAll('.nav-tab').forEach(tab=>{tab.addEventListener('click',()=>{document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));tab.classList.add('active');document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));document.getElementById(`${tab.dataset.tab}Tab`).classList.add('active');});});

    setupRecipeSearchDebounce();
    el.categoryFilter.addEventListener('change',()=>{recipePage=0;renderRecipes();});
    el.progressFilter.addEventListener('change',()=>{recipePage=0;renderRecipes();});

    let invST=null;el.inventorySearch.addEventListener('input',()=>{clearTimeout(invST);invST=setTimeout(renderInventory,300);});

    el.btnAddItem.addEventListener('click',()=>{el.addItemModal.classList.remove('hidden');el.addItemSearch.value='';renderAddItemList();setTimeout(()=>el.addItemSearch.focus(),100);});
    let addST=null;el.addItemSearch.addEventListener('input',()=>{clearTimeout(addST);addST=setTimeout(renderAddItemList,300);});

    let craftedST=null;el.craftedSearch.addEventListener('input',()=>{clearTimeout(craftedST);craftedST=setTimeout(renderCrafted,300);});
    el.craftedCategoryFilter.addEventListener('change',renderCrafted);

    el.btnImportExport.addEventListener('click',()=>{el.exportData.value=inv.exportData();el.importData.value='';renderBackupInfo();el.importExportModal.classList.remove('hidden');});
    el.btnCopyExport.addEventListener('click',()=>{el.exportData.select();navigator.clipboard.writeText(el.exportData.value).then(()=>showToast('Copiado!')).catch(()=>{document.execCommand('copy');showToast('Copiado!');});});
    el.btnImport.addEventListener('click',()=>{const d=el.importData.value.trim();if(!d){showToast('Cole seus dados','error');return;}if(inv.importData(d)){showToast('Importado!');el.importExportModal.classList.add('hidden');invalidateProgressCache();renderAll();}else showToast('Formato inválido','error');});

    el.btnRefreshApi.addEventListener('click',async()=>{showToast('Atualizando...');el.loadingScreen.classList.remove('hidden');el.loadingScreen.style.opacity='1';const ok=await loadAPI(true);if(ok){populateCategories();populateCraftedCategories();invalidateProgressCache();renderAll();updateApiStatus();showToast(`${RECIPES.length} receitas!`);}else showToast('Falha','error');el.loadingScreen.classList.add('hidden');});
    el.btnForceSync.addEventListener('click',async()=>{if(!cloudSync.userId){showToast('Faça login primeiro','error');return;}showToast('Sincronizando...');await cloudSync.push();showToast('Sincronizado!');});

    setupModalCloseHandlers();
    setInterval(()=>{if(inv.currentUser&&inv.isDirty()){inv.createBackup();updateBackupBadge();}},60000);
    window.addEventListener('beforeunload',()=>{if(inv.currentUser){inv.save();if(inv.isDirty())inv.createBackup();if(cloudSync.userId&&navigator.onLine)cloudSync.push();}});
    document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();if(inv.currentUser){inv.save();inv.createBackup();cloudSync.push();showToast('Salvo! (Ctrl+S)');}}});
}

async function boot(){
    setProgress(0,'Inicializando...');
    const ok=await loadAPI();
    if(!ok){el.loadingError.style.display='block';el.loadingError.innerHTML=`<p>⚠️ Sem dados.</p><button onclick="location.reload()">TENTAR</button>`;return;}
    populateCategories();populateCraftedCategories();updateApiStatus();setupEvents();
    const savedId=InventoryManager.getSavedCloudUserId(),lastUser=InventoryManager.getLastUser();
    if(savedId&&lastUser){
        inv.loadUser(lastUser);el.userName.textContent=lastUser.toUpperCase();
        setTimeout(()=>{el.loadingScreen.classList.add('hidden');el.app.style.display='block';renderAll();},500);
        cloudSync.resumeSession(savedId).then(ok=>{if(ok){invalidateProgressCache();renderAll();showToast('Sincronizado!');}});
    }else if(lastUser){
        inv.loadUser(lastUser);el.userName.textContent=lastUser.toUpperCase();el.loginInput.value=lastUser;
        setTimeout(()=>{el.loadingScreen.classList.add('hidden');el.app.style.display='block';el.loginModal.classList.remove('hidden');renderAll();},500);
    }else{
        setTimeout(()=>{el.loadingScreen.classList.add('hidden');el.app.style.display='block';el.loginModal.classList.remove('hidden');setTimeout(()=>el.loginInput.focus(),300);},500);
    }
}

boot();
