// Gestión del HUD
const HUD = {
    elements: {},

    init() {
        this.elements = {
            farmName: document.getElementById('farmName'),
            playerLevel: document.getElementById('playerLevel'),
            coins: document.getElementById('coins'),
            gems: document.getElementById('gems'),
            energy: document.getElementById('energy'),
            maxEnergy: document.getElementById('maxEnergy'),
            experience: document.getElementById('experience'),
            readyCropsCount: document.getElementById('readyCropsCount'),
            harvestBtn: document.getElementById('harvestBtn')
        };
    },

    update(playerData) {
        this.elements.farmName.textContent = `🌾 ${playerData.farm_name}`;
        this.elements.coins.textContent = playerData.coins;
        this.elements.gems.textContent = playerData.gems;
        this.elements.energy.textContent = playerData.energy;
        this.elements.maxEnergy.textContent = playerData.max_energy;
        this.elements.experience.textContent = playerData.experience;
        
        const xpPercent = (playerData.experience / playerData.xp_needed) * 100;
        this.elements.playerLevel.innerHTML = `${playerData.level} <span style="font-size:11px; opacity:0.8;">(${Math.floor(xpPercent)}%)</span>`;
    },

    updateReadyCropsCount(count) {
        this.elements.readyCropsCount.textContent = count;
        this.elements.harvestBtn.classList.toggle('has-crops', count > 0);
    }
};
