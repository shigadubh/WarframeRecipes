/**
 * ui-modals.js
 * Gerencia modais auxiliares: backup, import/export, fechar modais
 */

function renderBackupInfo() {
    const backups = inv.getBackups();
    const lastSync = cloudSync.getLastSyncTime();

    el.backupInfoSection.innerHTML = `
        <h4>📊 STATUS</h4>
        <p>Usuário: <strong style="color:var(--accent-primary);">${(inv.currentUser || 'N/A').toUpperCase()}</strong></p>
        <p>
            Itens: <strong>${inv.getAllItems().length}</strong> |
            Fabricados: <strong style="color:var(--crafted-red);">${Object.keys(inv.crafted).length}</strong>
        </p>
        <p>Save local: <strong style="color:var(--success);">${timeAgo(inv.getLastSave())}</strong></p>
        <p>Último sync nuvem: <strong style="color:var(--accent-primary);">${timeAgo(lastSync)}</strong></p>
        <p>Backups locais: <strong>${backups.length}/${CONFIG.MAX_LOCAL_BACKUPS}</strong></p>`;

    el.backupSlots.innerHTML = '';
    if (!backups.length) {
        el.backupSlots.innerHTML = '<p style="font-size:12px;color:var(--text-muted);">Nenhum backup local ainda.</p>';
        return;
    }
    backups.forEach(backup => {
        const btn = document.createElement('button');
        btn.className = 'backup-slot-btn';
        btn.textContent = `#${backup.slot + 1} — ${timeAgo(backup.ts)} (${backup.count || '?'} itens)`;
        btn.addEventListener('click', () => {
            if (confirm(`Restaurar backup #${backup.slot + 1}?\nSeu inventário atual será substituído.`)) {
                if (inv.restoreBackup(backup.slot)) { showToast('Backup restaurado!'); renderAll(); renderBackupInfo(); }
                else showToast('Erro ao restaurar', 'error');
            }
        });
        el.backupSlots.appendChild(btn);
    });
}

function setupModalCloseHandlers() {
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById(btn.dataset.close).classList.add('hidden');
        });
    });
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', e => {
            if (e.target === modal && modal.id !== 'loginModal') modal.classList.add('hidden');
        });
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal:not(.hidden)').forEach(m => {
                if (m.id !== 'loginModal') m.classList.add('hidden');
            });
        }
    });
}