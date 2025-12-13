// Modal de subida de nivel
const LevelUpModal = {
    init() {
        // El modal se crea dinámicamente
    },

    show(levelData) {
        // Crear modal si no existe
        let modal = document.getElementById('levelUpModal');
        if (!modal) {
            modal = this.createModal();
            document.body.appendChild(modal);
        }

        const { new_level, reward } = levelData;
        
        // Actualizar contenido
        document.getElementById('levelUpNumber').textContent = new_level;
        
        // Recompensas
        const rewardsList = document.getElementById('levelUpRewards');
        rewardsList.innerHTML = `
            <div class="level-reward-item">
                <span class="reward-icon">💎</span>
                <span class="reward-text">+${reward.gems} Gemas</span>
            </div>
            <div class="level-reward-item">
                <span class="reward-icon">⚡</span>
                <span class="reward-text">+${reward.max_energy_increase} Energía Máxima</span>
            </div>
            <div class="level-reward-item">
                <span class="reward-icon">${reward.random_item.split(' ')[0]}</span>
                <span class="reward-text">${reward.random_item}</span>
            </div>
            ${reward.unlocked_crops.length > 0 ? `
                <div class="level-reward-item unlocked">
                    <span class="reward-icon">🔓</span>
                    <span class="reward-text">Desbloqueado: ${reward.unlocked_crops.map(c => Game.CROP_INFO[c]?.emoji || c).join(' ')}</span>
                </div>
            ` : ''}
        `;

        modal.classList.add('show');
        
        // Crear confetti/partículas
        this.createConfetti();
    },

    close() {
        const modal = document.getElementById('levelUpModal');
        if (modal) {
            modal.classList.remove('show');
        }
    },

    createModal() {
        const modal = document.createElement('div');
        modal.id = 'levelUpModal';
        modal.className = 'level-up-modal';
        modal.innerHTML = `
            <div class="level-up-content">
                <div class="level-up-header">
                    <div class="level-up-star">⭐</div>
                    <h2 class="level-up-title">¡NIVEL SUBIDO!</h2>
                    <div class="level-up-number-display">
                        Nivel <span id="levelUpNumber">2</span>
                    </div>
                </div>
                
                <div class="level-up-body">
                    <h3 class="rewards-title">🎁 Recompensas</h3>
                    <div id="levelUpRewards" class="level-rewards-list"></div>
                </div>
                
                <button class="level-up-close-btn" onclick="LevelUpModal.close()">
                    ¡Continuar!
                </button>
            </div>
        `;
        return modal;
    },

    createConfetti() {
        const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'];
        
        for (let i = 0; i < 50; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.className = 'confetti';
                confetti.style.left = Math.random() * 100 + '%';
                confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
                confetti.style.animationDelay = Math.random() * 0.5 + 's';
                document.body.appendChild(confetti);
                
                setTimeout(() => confetti.remove(), 3000);
            }, i * 30);
        }
    }
};
