// Modal de cosecha
const HarvestModal = {
    counters: {},
    maxValues: {},

    init() {
        document.getElementById('closeHarvestBtn').addEventListener('click', () => this.close());
        document.getElementById('harvestSelectedBtn').addEventListener('click', () => this.harvestSelected());
        document.getElementById('harvestAllBtn').addEventListener('click', () => this.harvestAll());
    },

    open() {
        const readyCrops = Game.gameData.plots.filter(p => p.state === 'ready');
        
        if (readyCrops.length === 0) {
            Notifications.show('❌ No hay cultivos listos', 'error');
            return;
        }
        
        const grouped = {};
        readyCrops.forEach(plot => {
            if (!grouped[plot.crop_type]) grouped[plot.crop_type] = [];
            grouped[plot.crop_type].push(plot);
        });
        
        this.counters = {};
        this.maxValues = {};
        const list = document.getElementById('harvestList');
        
        list.innerHTML = Object.entries(grouped).map(([cropType, plots]) => {
            this.counters[cropType] = 0;
            this.maxValues[cropType] = plots.length;
            const info = Game.CROP_INFO[cropType];
            
            return `
                <div class="harvest-item">
                    <div class="harvest-item-left">
                        <span class="harvest-item-icon">${info.emoji}</span>
                        <div class="harvest-item-info">
                            <div class="harvest-item-name">${info.name}</div>
                            <div class="harvest-item-count">${plots.length} disponibles</div>
                        </div>
                    </div>
                    <div class="harvest-counter">
                        <button class="counter-btn" onclick="HarvestModal.decrement('${cropType}')">−</button>
                        <input type="number" 
                               class="counter-display" 
                               id="counter-${cropType}" 
                               value="0" 
                               min="0" 
                               max="${plots.length}"
                               oninput="HarvestModal.validateInput('${cropType}')"
                               onblur="HarvestModal.validateInput('${cropType}')">
                        <button class="counter-btn" onclick="HarvestModal.increment('${cropType}', ${plots.length})">+</button>
                    </div>
                </div>
            `;
        }).join('');
        
        document.getElementById('harvestModal').classList.add('show');
    },

    validateInput(cropType) {
        const input = document.getElementById(`counter-${cropType}`);
        let value = parseInt(input.value) || 0;
        const max = this.maxValues[cropType];
        
        // Validar rango
        if (value < 0) value = 0;
        if (value > max) value = max;
        
        input.value = value;
        this.counters[cropType] = value;
    },

    increment(cropType, max) {
        if (this.counters[cropType] < max) {
            this.counters[cropType]++;
            document.getElementById(`counter-${cropType}`).value = this.counters[cropType];
        }
    },

    decrement(cropType) {
        if (this.counters[cropType] > 0) {
            this.counters[cropType]--;
            document.getElementById(`counter-${cropType}`).value = this.counters[cropType];
        }
    },

    async harvestSelected() {
        let totalHarvested = 0;
        let totalCoins = 0;
        let totalXP = 0;
        let leveledUp = false;
        let levelUpData = null;
        
        for (const [cropType, count] of Object.entries(this.counters)) {
            if (count > 0) {
                const plots = Game.gameData.plots.filter(p => p.state === 'ready' && p.crop_type === cropType);
                
                for (let i = 0; i < Math.min(count, plots.length); i++) {
                    const result = await API.harvestCrop(plots[i].x, plots[i].y);
                    if (result.success) {
                        totalHarvested++;
                        totalCoins += result.coins_gained || 0;
                        totalXP += result.exp_gained || 0;
                        
                        if (result.leveled_up) {
                            leveledUp = true;
                            levelUpData = {
                                new_level: result.new_level,
                                reward: result.level_up_reward
                            };
                        }
                    }
                }
            }
        }
        
        if (totalHarvested > 0) {
            Notifications.show(`✂️ ${totalHarvested} cosechados | +${totalCoins} 💰 | +${totalXP} ✨`);
            await Game.loadGameData();
            Game.renderFarm();
            
            if (leveledUp) {
                Game.showLevelUpModal(levelUpData);
            }
        } else {
            Notifications.show('❌ Selecciona al menos 1', 'error');
        }
        
        this.close();
    },

    async harvestAll() {
        const readyCrops = Game.gameData.plots.filter(p => p.state === 'ready');
        let totalCoins = 0;
        let totalXP = 0;
        let leveledUp = false;
        let levelUpData = null;
        
        for (const plot of readyCrops) {
            const result = await API.harvestCrop(plot.x, plot.y);
            if (result.success) {
                totalCoins += result.coins_gained || 0;
                totalXP += result.exp_gained || 0;
                
                if (result.leveled_up) {
                    leveledUp = true;
                    levelUpData = {
                        new_level: result.new_level,
                        reward: result.level_up_reward
                    };
                }
            }
        }
        
        Notifications.show(`✂️ ${readyCrops.length} cosechados | +${totalCoins} 💰 | +${totalXP} ✨`);
        await Game.loadGameData();
        Game.renderFarm();
        
        if (leveledUp) {
            Game.showLevelUpModal(levelUpData);
        }
        
        this.close();
    },
    close() {
        document.getElementById('harvestModal').classList.remove('show');
    }
};
