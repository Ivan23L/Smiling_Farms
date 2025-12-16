// Orquestador principal del juego

const Game = {
    CROP_INFO: {
        'wheat': { name: 'Trigo', emoji: '🌾', time: '2min', level: 1, cost: 0, sell: 3, xp: 3 },
        'carrot': { name: 'Zanahoria', emoji: '🥕', time: '5min', level: 2, cost: 0, sell: 7, xp: 8 },
        'corn': { name: 'Maíz', emoji: '🌽', time: '10min', level: 5, cost: 1, sell: 15, xp: 18 },
        'potato': { name: 'Patata', emoji: '🥔', time: '1h', level: 10, cost: 2, sell: 30, xp: 40 }
    },

    gameData: {
        player: null,
        plots: [],
        inventory: [],
        unlocked_crops: []
    },

    async init() {
        HUD.init();
        CropMenu.init();
        HarvestModal.init();
        InventoryPanel.init();
        BuildPanel.init();
        Farm.init();
        await this.loadGameData();
        Farm.render();
        document.getElementById('harvestBtn').addEventListener('click', () => HarvestModal.open());
        document.getElementById('loading').classList.add('hidden');
        setInterval(() => this.updateCrops(), 1000);
    },

    async loadGameData() {
        this.gameData = await API.init();
        this.gameData.plots.forEach(plot => {
            plot._planted = false;
        });
        HUD.update(this.gameData.player);
        this.updateReadyCropsCount();
        const inventory = await API.getInventory();
        this.gameData.inventory = inventory;
        // Renderizar inventario después de cargarlo
        if (InventoryPanel && InventoryPanel.render) {
            InventoryPanel.render();
        }
    },

    updateReadyCropsCount() {
        const count = this.gameData.plots.filter(p => p.state === 'ready').length;
        HUD.updateReadyCropsCount(count);
    },

    updateCrops() {
        let needsUpdate = false;
        this.gameData.plots.forEach(plot => {
            if (plot.state === 'growing' && plot.ready_at) {
                if (new Date() >= new Date(plot.ready_at)) {
                    plot.state = 'ready';
                    needsUpdate = true;
                }
            }
        });

        if (needsUpdate) {
            Farm.render();
            this.updateReadyCropsCount();
        }
    },

    renderFarm() {
        this.gameData.plots.forEach(plot => {
            plot._planted = false;
        });
        Farm.render();
    },

    showLevelUpModal(levelData) {
        LevelUpModal.show(levelData);
    }
};

window.addEventListener('load', () => Game.init());