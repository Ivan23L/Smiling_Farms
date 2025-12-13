// Panel de Inventario
const InventoryPanel = {
    init() {
        document.getElementById('inventoryBtn').addEventListener('click', () => this.open());
        document.getElementById('closeInventoryBtn').addEventListener('click', () => this.close());
    },

    open() {
        this.render();
        document.getElementById('inventoryPanel').classList.add('show');
        document.getElementById('panelOverlay').classList.add('show');
        
        document.getElementById('panelOverlay').onclick = () => {
            this.close();
            BuildPanel.close();
        };
    },

    close() {
        document.getElementById('inventoryPanel').classList.remove('show');
        if (!document.getElementById('buildPanel').classList.contains('show')) {
            document.getElementById('panelOverlay').classList.remove('show');
        }
    },

    render() {
        const grid = document.getElementById('inventoryGrid');
        const inventory = Game.gameData.inventory;

        if (inventory.length === 0) {
            grid.innerHTML = '<div class="empty-panel-message">Tu inventario está vacío.<br>¡Cosecha algunos cultivos!</div>';
            return;
        }

        grid.innerHTML = inventory.map(item => {
            const info = Game.CROP_INFO[item.item];
            if (!info) return '';

            return `
                <div class="inventory-card">
                    <div class="inventory-card-header">
                        <div class="inventory-card-icon">${info.emoji}</div>
                        <div class="inventory-card-info">
                            <div class="inventory-card-name">${info.name}</div>
                            <div class="inventory-card-qty">×${item.quantity}</div>
                        </div>
                    </div>
                    <div class="inventory-card-footer">
                        <div class="inventory-card-price">💰 ${info.sell} c/u</div>
                        <button class="inventory-sell-btn" onclick="InventoryPanel.sellItem('${item.item}', 1)">
                            Vender 1
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    async sellItem(itemType, quantity) {
        const item = Game.gameData.inventory.find(i => i.item === itemType);
        if (!item || item.quantity < quantity) {
            Notifications.show('❌ No tienes suficientes items', 'error');
            return;
        }

        const info = Game.CROP_INFO[itemType];
        const totalPrice = info.sell * quantity;

        const result = await API.sellItem(itemType, quantity);
        
        if (result.success) {
            Notifications.show(`💰 Vendido ${quantity}x ${info.name} por ${totalPrice} monedas`);
            await Game.loadGameData();
            this.render();
        }
    }
};
