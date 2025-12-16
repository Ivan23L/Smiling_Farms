const InventoryPanel = {
  sellCounters: {},
  currentTab: 'crops',

  init() {
    const invBtn = document.getElementById('inventoryBtn');
    if (invBtn) {
      invBtn.addEventListener('click', () => this.open());
    }
    document.querySelectorAll('.inventory-tab').forEach(btn => {
      btn.addEventListener('click', (e) => this.switchTab(btn.dataset.tab, e));
    });

    // 🎯 CONEXIÓN DE BOTONES DEL FOOTER
    const sellBtn = document.getElementById('sellBtn');
    const resetBtn = document.getElementById('resetBtn');
    
    if (sellBtn) {
      sellBtn.addEventListener('click', () => this.sellItems());
    }
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetSell());
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

  switchTab(tabName, e) {
    this.currentTab = tabName;
    document.querySelectorAll('.inventory-tab').forEach(btn => {
      btn.classList.remove('active');
    });
    if (e && e.currentTarget) {
      e.currentTarget.classList.add('active');
    } else {
      document.querySelector(`.inventory-tab[data-tab="${tabName}"]`)?.classList.add('active');
    }
    document.querySelectorAll('.inventory-tab-content').forEach(content => {
      content.classList.remove('active');
    });
    const activeTab = document.getElementById(`${tabName}-tab`);
    if (activeTab) activeTab.classList.add('active');
  },

  enrichInventoryItem(itemType, quantity) {
    const safeItemType = (itemType || 'unknown').toLowerCase().trim();
    const cropInfo = Game.CROP_INFO?.[safeItemType] || {};
    let name = cropInfo.name;
    if (!name) {
      if (safeItemType === 'unknown') {
        name = 'Desconocido';
      } else {
        name = safeItemType.charAt(0).toUpperCase() + safeItemType.slice(1);
      }
    }
    const category = (cropInfo && cropInfo.name) ? 'crops' : 'products';
    return {
      id: safeItemType,
      name: name,
      emoji: cropInfo.emoji || '📦',
      quantity: parseInt(quantity) || 0,
      sell_price: cropInfo.sell || 1,
      category: category
    };
  },

  render() {
    const gridCrops = document.getElementById('inventoryGrid-crops');
    const gridProducts = document.getElementById('inventoryGrid-products');
    let rawInventory = Game.gameData?.inventory || [];
    if (!Array.isArray(rawInventory)) {
      rawInventory = rawInventory?.data || rawInventory?.items || rawInventory?.inventory || [];
    }
    const inventory = rawInventory.map(item => {
      let type = 'unknown';
      let quantity = 0;
      if (item.crop_type) {
        type = item.crop_type;
        quantity = item.quantity || 0;
      } else if (item.item_type) {
        type = item.item_type;
        quantity = item.quantity || 0;
      } else if (item.type) {
        type = item.type;
        quantity = item.quantity || 0;
      } else if (typeof item === 'object') {
        const keys = Object.keys(item);
        const cropKeys = Object.keys(Game.CROP_INFO || {});
        for (let key of keys) {
          const val = String(item[key]).toLowerCase();
          if (cropKeys.includes(val)) {
            type = val;
            break;
          }
        }
        if (item.quantity !== undefined) quantity = item.quantity;
        else if (item.count !== undefined) quantity = item.count;
        else if (item.amount !== undefined) quantity = item.amount;
      }
      return this.enrichInventoryItem(type, quantity);
    });

    if (gridCrops) gridCrops.innerHTML = '';
    if (gridProducts) gridProducts.innerHTML = '';

    const crops = inventory.filter(item => item.category === 'crops');
    const products = inventory.filter(item => item.category === 'products');

    if (crops.length === 0) {
      if (gridCrops) gridCrops.innerHTML = '<div class="empty-panel-message">Sin cultivos disponibles</div>';
    } else {
      crops.forEach(item => this.addItemToGrid(item, gridCrops));
    }

    if (products.length === 0) {
      if (gridProducts) gridProducts.innerHTML = '<div class="empty-panel-message">Sin productos disponibles</div>';
    } else {
      products.forEach(item => this.addItemToGrid(item, gridProducts));
    }

    this.updateInventoryFooter();
  },

  addItemToGrid(item, gridElement) {
    if (!gridElement) return;

    const itemElement = document.createElement('div');
    itemElement.className = 'sell-item';
    itemElement.dataset.itemId = item.id;

    const quantity = this.sellCounters[item.id] || 0;

    itemElement.innerHTML = `
      <div class="sell-item-icon">${item.emoji}</div>
      <div class="sell-item-details">
        <div class="sell-item-name">${item.name}</div>
        <div class="sell-item-info">
          <span class="sell-item-stock">Disponible: <strong>${item.quantity}</strong></span>
          <span class="sell-item-price">${item.sell_price} 🪙/ud</span>
        </div>
      </div>
      <div class="sell-item-controls">
        <button class="counter-btn minus-btn" data-item-id="${item.id}" aria-label="Disminuir cantidad">−</button>
        <input type="number" class="counter-input" data-item-id="${item.id}" value="${quantity}" min="0" max="${item.quantity}">
        <button class="counter-btn plus-btn" data-item-id="${item.id}" aria-label="Aumentar cantidad">+</button>
        <button class="counter-btn max-btn" data-item-id="${item.id}" data-max="${item.quantity}" aria-label="Máximo disponible">Máx</button>
      </div>
    `;

    const minusBtn = itemElement.querySelector('.minus-btn');
    const plusBtn = itemElement.querySelector('.plus-btn');
    const maxBtn = itemElement.querySelector('.max-btn');
    const input = itemElement.querySelector('.counter-input');

    minusBtn.addEventListener('click', () => this.updateCounter(item.id, -1, item.quantity));
    plusBtn.addEventListener('click', () => this.updateCounter(item.id, 1, item.quantity));
    maxBtn.addEventListener('click', () => this.setMaxCounter(item.id, item.quantity));
    input.addEventListener('input', () => this.validateCounter(item.id, item.quantity));
    input.addEventListener('change', () => this.validateCounter(item.id, item.quantity));

    gridElement.appendChild(itemElement);
  },

  updateCounter(itemId, delta, maxQuantity) {
    const current = this.sellCounters[itemId] || 0;
    let newValue = current + delta;
    newValue = Math.max(0, Math.min(newValue, maxQuantity));
    this.sellCounters[itemId] = newValue;
    this.updateInputValue(itemId);
    this.updateInventoryFooter();
  },

  setMaxCounter(itemId, maxQuantity) {
    this.sellCounters[itemId] = maxQuantity;
    this.updateInputValue(itemId);
    this.updateInventoryFooter();
  },

  updateInputValue(itemId) {
    const input = document.querySelector(`.counter-input[data-item-id="${itemId}"]`);
    if (input) {
      input.value = this.sellCounters[itemId] || 0;
    }
  },

  validateCounter(itemId, maxQuantity) {
    const input = document.querySelector(`.counter-input[data-item-id="${itemId}"]`);
    if (input) {
      let value = parseInt(input.value) || 0;
      value = Math.max(0, Math.min(value, maxQuantity));
      this.sellCounters[itemId] = value;
      input.value = value;
      this.updateInventoryFooter();
    }
  },

  updateInventoryFooter() {
    const totalAmount = document.querySelector('.total-amount');
    let totalValue = 0;

    const allItems = document.querySelectorAll('.sell-item');

    allItems.forEach(item => {
      const itemId = item.dataset.itemId;
      const quantity = this.sellCounters[itemId] || 0;
      const priceText = item.querySelector('.sell-item-price')?.textContent || '';
      const price = parseInt(priceText.match(/\d+/)?.[0] || 0);
      totalValue += quantity * price;
    });

    if (totalAmount) {
      totalAmount.textContent = `${totalValue} 🪙`;
      totalAmount.classList.toggle('has-value', totalValue > 0);
    }

    // Habilitar/deshabilitar botón de vender
    const sellBtn = document.getElementById('sellBtn');
    if (sellBtn) {
      sellBtn.disabled = totalValue === 0;
    }
  },

  sellItems() {
    const totalAmount = document.querySelector('.total-amount')?.textContent || '0';
    const totalCoins = parseInt(totalAmount.match(/\d+/)?.[0] || 0);

    if (totalCoins === 0) {
      alert('❌ Selecciona items para vender');
      return;
    }

    const itemsToSell = [];
    document.querySelectorAll('.sell-item').forEach(item => {
      const itemId = item.dataset.itemId;
      const quantity = this.sellCounters[itemId] || 0;
      if (quantity > 0) {
        itemsToSell.push({ item: itemId, quantity: quantity });
      }
    });

    if (itemsToSell.length === 0) return;

    // Enviar al servidor
    fetch('/api/sell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: itemsToSell })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          this.sellCounters = {};
          this.render();
          if (window.HUD) HUD.updateCoins(data.coins);
          console.log(`✅ Venta exitosa: +${totalCoins} 🪙`);
          alert(`✅ ¡Venta exitosa!\n+${totalCoins} 🪙`);
        } else {
          alert('❌ Error en la venta: ' + (data.message || 'desconocido'));
        }
      })
      .catch(err => {
        console.error('Error selling items:', err);
        alert('❌ Error de conexión con el servidor');
      });
  },

  resetSell() {
    this.sellCounters = {};
    this.render();
  }
};