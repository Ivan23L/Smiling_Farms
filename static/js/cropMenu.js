// Menú radial de cultivos
const CropMenu = {
    isOpen: false,
    selectedCrop: null,
    isDraggingFromMenu: false,

    init() {
        document.getElementById('cropMenuOverlay').addEventListener('mouseup', () => {
            if (!this.isDraggingFromMenu) {
                this.close();
                this.selectedCrop = null;
            }
        });
    },

    show(position) {
        const menu = document.getElementById('cropMenu');
        const overlay = document.getElementById('cropMenuOverlay');
        const container = menu.querySelector('.radial-menu-container');
        
        container.querySelectorAll('.radial-item').forEach(item => item.remove());
        
        const playerLevel = Game.gameData.player.level;
        const visibleCrops = Object.entries(Game.CROP_INFO).filter(([_, info]) => {
            return info.level <= playerLevel + 5;
        });
        
        const radius = 110;
        const angleStep = (2 * Math.PI) / visibleCrops.length;
        
        visibleCrops.forEach(([cropType, info], index) => {
            const unlocked = Game.gameData.unlocked_crops.includes(cropType);
            const comingSoon = !unlocked && info.level <= playerLevel + 5;
            
            const angle = angleStep * index - Math.PI / 2;
            const x = Math.cos(angle) * radius + 150;
            const y = Math.sin(angle) * radius + 150;
            
            const item = document.createElement('div');
            let classes = 'radial-item';
            if (!unlocked) classes += comingSoon ? ' coming-soon' : ' locked';
            item.className = classes;
            item.dataset.crop = cropType;
            item.style.left = `${x - 50}px`;
            item.style.top = `${y - 50}px`;
            
            item.innerHTML = `
                ${!unlocked ? '<div class="radial-item-lock">🔒</div>' : ''}
                <div class="radial-item-emoji">${info.emoji}</div>
                <div class="radial-item-name">${info.name}</div>
                <div class="radial-item-time">⏱️ ${info.time}</div>
                ${!unlocked ? `<div class="radial-item-level">Nivel ${info.level}</div>` : ''}
            `;
            
            if (unlocked) {
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.startDragFromMenu(cropType);
                });
            }
            
            container.appendChild(item);
        });
        
        menu.style.left = `${position.x}px`;
        menu.style.top = `${position.y}px`;
        menu.classList.add('show');
        overlay.classList.add('show');
        this.isOpen = true;
    },

    startDragFromMenu(cropType) {
        console.log('🌱 Drag iniciado:', cropType);
        this.selectedCrop = cropType;
        this.isDraggingFromMenu = true;
        Farm.isMouseDown = true;
        
        this.close();
        
        Notifications.show(`🌱 ${Game.CROP_INFO[cropType].name} - Arrastra para plantar`);
        
        const handleMouseUp = () => {
            console.log('✋ Drag terminado');
            this.isDraggingFromMenu = false;
            this.selectedCrop = null;
            Farm.isMouseDown = false;
            document.removeEventListener('mouseup', handleMouseUp);
        };
        
        document.addEventListener('mouseup', handleMouseUp);
    },

    close() {
        document.getElementById('cropMenu').classList.remove('show');
        document.getElementById('cropMenuOverlay').classList.remove('show');
        this.isOpen = false;
    }
};
