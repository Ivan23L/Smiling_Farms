const BuildPanel = {
    init() {
        const buildBtn = document.getElementById('buildBtn');
        if (buildBtn) {
            buildBtn.addEventListener('click', () => this.open());
        }
    },

    open() {
        this.render();
        document.getElementById('buildPanel').classList.add('show');
        document.getElementById('panelOverlay').classList.add('show');
        
        document.getElementById('panelOverlay').onclick = () => {
            this.close();
            if (window.InventoryPanel) InventoryPanel.close();
        };
    },

    close() {
        document.getElementById('buildPanel').classList.remove('show');
        if (!document.getElementById('inventoryPanel')?.classList.contains('show')) {
            document.getElementById('panelOverlay').classList.remove('show');
        }
    },

    render() {
        const panel = document.getElementById('buildPanel');
        
        const structures = [
            { id: 'plot', name: 'Nueva Parcela', icon: '🌱', cost: 50, level: 1 },
            { id: 'silo', name: 'Silo', icon: '🏗️', cost: 100, level: 2 },
            { id: 'greenhouse', name: 'Invernadero', icon: '🏡', cost: 200, level: 3 },
            { id: 'establo', name: 'Establo', icon: '🐄', cost: 250, level: 4 },
            { id: 'molino', name: 'Molino', icon: '⚙️', cost: 500, level: 5 }
        ];

        const currentLevel = Game.gameData?.level || 1;

        const itemsHTML = structures.map(item => {
            const locked = currentLevel < item.level;
            return `
                <div class="build-item ${locked ? 'locked' : ''}" 
                     ${locked ? '' : `onclick="BuildPanel.build('${item.id}')"`}>
                    <div class="build-item-icon">${item.icon}</div>
                    <div class="build-item-name">${item.name}</div>
                    <div class="build-item-cost">💰 ${item.cost}</div>
                    <div class="build-item-level">Nivel ${item.level}</div>
                </div>
            `;
        }).join('');

        panel.innerHTML = `
            <div class="panel-header">
                <h2 class="panel-title">🏗️ Construir</h2>
                <button class="panel-close" onclick="BuildPanel.close()">×</button>
            </div>
            <div class="panel-content">
                <div class="build-grid">${itemsHTML}</div>
            </div>
        `;
    },

    async build(structureType) {
        Notifications.show(`🏗️ Construcción de ${structureType} en desarrollo`);
        this.close();
    }
};
