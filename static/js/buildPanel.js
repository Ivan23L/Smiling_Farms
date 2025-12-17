const BuildPanel = {
  selectedStructure: null,

  init() {
    const buildBtn = document.getElementById('buildBtn');
    if (buildBtn) {
      buildBtn.addEventListener('click', () => this.open());
    }
  },

  open() {
    this.render();
    const panel = document.getElementById('buildPanel');
    const overlay = document.getElementById('panelOverlay');

    panel.classList.add('show');
    overlay.classList.add('show');

    overlay.onclick = () => {
      this.close();
      if (window.InventoryPanel) InventoryPanel.close();
    };
  },

  close() {
    document.getElementById('buildPanel').classList.remove('show');
    const overlay = document.getElementById('panelOverlay');
    if (!document.getElementById('inventoryPanel')?.classList.contains('show')) {
      overlay.classList.remove('show');
    }
    this.selectedStructure = null;
    Farm.cancelBuildMode && Farm.cancelBuildMode();
  },

  render() {
    const panel = document.getElementById('buildPanel');

    const structures = [
      { id: 'plot',     name: 'Nueva Parcela', icon: '🌱', cost: 50,  level: 1 },
      { id: 'silo',     name: 'Silo',          icon: '🏗️', cost: 100, level: 2 },
      { id: 'greenhouse', name: 'Invernadero', icon: '🏡', cost: 200, level: 3 },
      { id: 'cow_barn', name: 'Establo',      icon: '🐄', cost: 250, level: 4 },
      { id: 'mill',     name: 'Molino',       icon: '⚙️', cost: 500, level: 5 }
    ];

    const currentLevel = Game.gameData?.player?.level || 1;
    const coins = Game.gameData?.player?.coins || 0;

    const itemsHTML = structures.map(item => {
      const lockedByLevel = currentLevel < item.level;
      const lockedByCoins = coins < item.cost;
      const locked = lockedByLevel || lockedByCoins;

      const lockReason = lockedByLevel
        ? `Nivel ${item.level}`
        : `Faltan ${item.cost - coins} 🪙`;

      return `
        <div class="build-item ${locked ? 'locked' : ''}" data-id="${item.id}">
          <div class="build-item-icon">${item.icon}</div>
          <div class="build-item-info">
            <div class="build-item-name">${item.name}</div>
            <div class="build-item-meta">
              <span>${item.cost} 🪙</span>
              <span>Lvl ${item.level}</span>
            </div>
            ${locked ? `<div class="build-item-lock">🔒 ${lockReason}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');

    panel.querySelector('.build-tabs').innerHTML = itemsHTML;

    panel.querySelectorAll('.build-item').forEach(itemEl => {
      const id = itemEl.dataset.id;
      const isLocked = itemEl.classList.contains('locked');
      if (isLocked) return;

      itemEl.addEventListener('click', () => {
        this.selectedStructure = id;
        // marcar visualmente
        panel.querySelectorAll('.build-item').forEach(el => el.classList.remove('selected'));
        itemEl.classList.add('selected');

        // activar modo construcción en Farm
        Farm.startBuildMode(id);
      });
    });
  }
};
