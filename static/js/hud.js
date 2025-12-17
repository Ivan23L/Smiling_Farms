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
      harvestBtn: document.getElementById('harvestBtn'),
      // ⬇️ nuevos
      dayNightIcon: document.getElementById('dayNightIcon'),
      gameTimeText: document.getElementById('gameTimeText')
    };

    // Actualizar cada minuto el estado día/noche
    this.updateDayNight();
    setInterval(() => this.updateDayNight(), 60 * 1000);
  },

  update(playerData) {
    this.elements.farmName.textContent = `🌾 ${playerData.farm_name}`;
    this.elements.coins.textContent = playerData.coins;
    this.elements.gems.textContent = playerData.gems;
    this.elements.energy.textContent = playerData.energy;
    this.elements.maxEnergy.textContent = playerData.max_energy;
    this.elements.experience.textContent = playerData.experience;

    const xpPercent = (playerData.experience / playerData.xp_needed) * 100;
    this.elements.playerLevel.innerHTML = `${playerData.level} (${Math.floor(xpPercent)}%)`;
  },

  // Actualizar solo monedas
  updateCoins(newCoins) {
    if (this.elements.coins) {
      this.elements.coins.textContent = newCoins;
    }
  },

  updateReadyCropsCount(count) {
    this.elements.readyCropsCount.textContent = count;
    this.elements.harvestBtn.classList.toggle('has-crops', count > 0);
  },

  // Día / noche según hora local
  updateDayNight() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');

    const isDay = hours >= 6 && hours < 20; // 06:00–19:59 día, resto noche

    if (this.elements.dayNightIcon) {
      this.elements.dayNightIcon.textContent = isDay ? '🌞' : '🌙';
    }
    if (this.elements.gameTimeText) {
      this.elements.gameTimeText.textContent = `${hours.toString().padStart(2, '0')}:${minutes}`;
    }
  }
};
