const InventoryPanel = {
    sellCounters: {},

    init() {
        const invBtn = document.getElementById('inventoryBtn');
        if (invBtn) {
            invBtn.addEventListener('click', () => this.open());
        }
    },

    open() {
        this.render();
        document.getElementById('inventoryPanel').classList.add('show');
        document.getElementById('panelOverlay').classList.add('show');
        
        document.getElementById('panelOverlay').onclick = () => {
            this.close();
            if (window.BuildPanel) BuildPanel.close();
        };
    },

    close() {
        document.getElementById('inventoryPanel').classList.remove('show');
        if (!document.getElementById('buildPanel')?.classList.contains('show')) {
            document.getElementById('panelOverlay').classList.remove('show');
        }
        this.sellCounters = {};
    },

    render() {
        const panel = document.getElementById('inventoryPanel');
        const inventory = Game.gameData?.inventory || [];

        if (inventory.length === 0) {
            panel.innerHTML = `
                <div class="panel-header">
                    <h2 class="panel-title">🎒 Inventario</h2>
                    <button class="panel-close" onclick="InventoryPanel.close()">×</button>
                </div>
                <div class="panel-content">
                    <div class="empty-panel-message">Tu inventario está vacío.<br>¡Cosecha algunos cultivos!</div>
                </div>
            `;
            return;
        }

        inventory.forEach(item => {
            if (!this.sellCounters[item.item]) {
                this.sellCounters[item.item] = 0;
            }
        });

        const itemsHTML = inventory.map(item => {
            const info = Game.CROP_INFO[item.item];
            if (!info) return '';

            return `
                <div class="sell-item" data-item="${item.item}">
                    <div class="sell-item-icon">${info.emoji}</div>
                    <div class="sell-item-details">
                        <div class="sell-item-name">${info.name}</div>
                        <div class="sell-item-info">
                            <span class="sell-item-stock">×${item.quantity}</span>
                            <span class="sell-item-price">💰 ${info.sell} c/u</span>
                        </div>
                    </div>
                    <div class="sell-item-controls">
                        <button class="counter-btn" onclick="InventoryPanel.decrement('${item.item}')">−</button>
                        <input 
                            type="number" 
                            class="counter-input" 
                            id="counter-${item.item}" 
                            value="0"
                            min="0"
                            max="${item.quantity}"
                            oninput="InventoryPanel.updateFromInput('${item.item}', ${item.quantity})"
                        >
                        <button class="counter-btn" onclick="InventoryPanel.increment('${item.item}', ${item.quantity})">+</button>
                    </div>
                </div>
            `;
        }).join('');

        panel.innerHTML = `
            <div class="panel-header">
                <h2 class="panel-title">🎒 Inventario</h2>
                <button class="panel-close" onclick="InventoryPanel.close()">×</button>
            </div>
            <div class="panel-content">
                <div id="inventoryGrid">${itemsHTML}</div>
            </div>
            <div class="inventory-footer">
                <div class="inventory-total">
                    <span>Total a vender:</span>
                    <span id="totalSellValue" class="total-amount">0 💰</span>
                </div>
                <div class="inventory-buttons">
                    <button id="sellSelectedBtn" class="inventory-action-btn primary" onclick="InventoryPanel.sellSelected()">💰 Vender seleccionados</button>
                    <button id="sellAllBtn" class="inventory-action-btn secondary" onclick="InventoryPanel.sellAll()">🔥 Vender todo</button>
                </div>
            </div>
        `;

        this.updateTotal();
    },

    increment(itemType, max) {
        if (this.sellCounters[itemType] < max) {
            this.sellCounters[itemType]++;
            this.updateCounter(itemType);
            this.updateTotal();
        }
    },

    decrement(itemType) {
        if (this.sellCounters[itemType] > 0) {
            this.sellCounters[itemType]--;
            this.updateCounter(itemType);
            this.updateTotal();
        }
    },

    updateFromInput(itemType, max) {
        const input = document.getElementById(`counter-${itemType}`);
        let value = parseInt(input.value) || 0;
        
        if (value < 0) value = 0;
        if (value > max) value = max;
        
        input.value = value;
        this.sellCounters[itemType] = value;
        
        const itemEl = document.querySelector(`[data-item="${itemType}"]`);
        if (value > 0) {
            itemEl.classList.add('selected');
        } else {
            itemEl.classList.remove('selected');
        }
        
        this.updateTotal();
    },

    updateCounter(itemType) {
        const counterEl = document.getElementById(`counter-${itemType}`);
        if (counterEl) {
            counterEl.value = this.sellCounters[itemType];
            
            const itemEl = document.querySelector(`[data-item="${itemType}"]`);
            if (this.sellCounters[itemType] > 0) {
                itemEl.classList.add('selected');
            } else {
                itemEl.classList.remove('selected');
            }
        }
    },

    updateTotal() {
        let total = 0;
        let totalItems = 0;
        
        const inventory = Game.gameData?.inventory || [];
        inventory.forEach(item => {
            const count = this.sellCounters[item.item] || 0;
            const price = Game.CROP_INFO[item.item]?.sell || 0;
            total += count * price;
            totalItems += count;
        });
        
        const totalEl = document.getElementById('totalSellValue');
        if (totalEl) {
            totalEl.textContent = `${total} 💰`;
            totalEl.classList.toggle('has-value', total > 0);
        }
        
        const sellBtn = document.getElementById('sellSelectedBtn');
        if (sellBtn) {
            sellBtn.textContent = totalItems > 0 
                ? `💰 Vender seleccionados (${totalItems})` 
                : '💰 Vender seleccionados';
        }
    },

    async sellSelected() {
        let totalItems = 0;
        let totalEarned = 0;

        for (const [itemType, count] of Object.entries(this.sellCounters)) {
            if (count > 0) {
                const result = await API.sellItem(itemType, count);
                
                if (result.success) {
                    totalItems += count;
                    totalEarned += result.coins_earned;
                }
            }
        }

        if (totalItems > 0) {
            Notifications.show(`💰 ${totalItems} items vendidos (+${totalEarned} monedas)`);
            await Game.loadGameData();
            this.sellCounters = {};
            this.render();
        } else {
            Notifications.show('❌ Selecciona al menos 1 item', 'error');
        }
    },

    async sellAll() {
        const inventory = Game.gameData?.inventory || [];
        
        if (inventory.length === 0) {
            Notifications.show('❌ No hay items para vender', 'error');
            return;
        }

        let totalEarned = 0;
        let totalItems = 0;

        for (const item of inventory) {
            const result = await API.sellItem(item.item, item.quantity);
            if (result.success) {
                totalEarned += result.coins_earned;
                totalItems += item.quantity;
            }
        }

        Notifications.show(`💰 ${totalItems} items vendidos (+${totalEarned} monedas)`);
        await Game.loadGameData();
        this.sellCounters = {};
        this.render();
    }
};
