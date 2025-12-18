const InventoryPanel = {
  sellCounters: {},
  currentTab: "crops",

  init() {
    const invBtn = document.getElementById("inventoryBtn");
    if (invBtn) {
      invBtn.addEventListener("click", () => this.open());
    }
    document.querySelectorAll(".inventory-tab").forEach((btn) => {
      btn.addEventListener("click", (e) => this.switchTab(btn.dataset.tab, e));
    });

    // 🎯 CONEXIÓN DE BOTONES DEL FOOTER
    const sellBtn = document.getElementById("sellBtn");
    const resetBtn = document.getElementById("resetBtn");
    if (sellBtn) {
      sellBtn.addEventListener("click", () => this.sellItems());
    }
    if (resetBtn) {
      resetBtn.addEventListener("click", () => this.resetSell());
    }

    // 🔺 NUEVO: BOTÓN DE CERRAR INVENTARIO
    const closeInventoryBtn = document.getElementById("closeInventoryBtn");
    if (closeInventoryBtn) {
      closeInventoryBtn.addEventListener("click", () => this.close());
    }
  },

  open() {
    this.render();
    document.getElementById("inventoryPanel").classList.add("show");
    document.getElementById("panelOverlay").classList.add("show");
    document.getElementById("panelOverlay").onclick = () => {
      this.close();
      if (window.BuildPanel) BuildPanel.close();
    };
  },

  close() {
    document.getElementById("inventoryPanel").classList.remove("show");
    if (!document.getElementById("buildPanel")?.classList.contains("show")) {
      document.getElementById("panelOverlay").classList.remove("show");
    }
    this.sellCounters = {};
  },

  switchTab(tabName, e) {
    this.currentTab = tabName;
    document.querySelectorAll(".inventory-tab").forEach((btn) => {
      btn.classList.remove("active");
    });
    if (e && e.currentTarget) {
      e.currentTarget.classList.add("active");
    } else {
      document
        .querySelector(`.inventory-tab[data-tab="${tabName}"]`)
        ?.classList.add("active");
    }
    document.querySelectorAll(".inventory-tab-content").forEach((content) => {
      content.classList.remove("active");
    });
    const activeTab = document.getElementById(`${tabName}-tab`);
    if (activeTab) activeTab.classList.add("active");
  },

  enrichInventoryItem(itemType, quantity) {
    const safeItemType = (itemType || "unknown").toLowerCase().trim();
    const cropInfo = Game.CROP_INFO?.[safeItemType] || {};
    let name = cropInfo.name;
    if (!name) {
      if (safeItemType === "unknown") {
        name = "Desconocido";
      } else {
        name = safeItemType.charAt(0).toUpperCase() + safeItemType.slice(1);
      }
    }
    const category = cropInfo && cropInfo.name ? "crops" : "products";
    return {
      id: safeItemType,
      name: name,
      emoji: cropInfo.emoji || "📦",
      quantity: parseInt(quantity) || 0,
      sell_price: cropInfo.sell || 1,
      category: category,
    };
  },

  render() {
    const gridCrops = document.getElementById("inventoryGrid-crops");
    const gridProducts = document.getElementById("inventoryGrid-products");
    let rawInventory = Game.gameData?.inventory || [];
    if (!Array.isArray(rawInventory)) {
      rawInventory =
        rawInventory?.data ||
        rawInventory?.items ||
        rawInventory?.inventory ||
        [];
    }
    const inventory = rawInventory.map((item) => {
      let type = "unknown";
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
      } else if (typeof item === "object") {
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

    if (gridCrops) gridCrops.innerHTML = "";
    if (gridProducts) gridProducts.innerHTML = "";

    const crops = inventory.filter((item) => item.category === "crops");
    const products = inventory.filter((item) => item.category === "products");

    if (crops.length === 0) {
      if (gridCrops)
        gridCrops.innerHTML =
          '<div class="empty-panel-message">Sin cultivos disponibles</div>';
    } else {
      crops.forEach((item) => this.addItemToGrid(item, gridCrops));
    }

    if (products.length === 0) {
      if (gridProducts)
        gridProducts.innerHTML =
          '<div class="empty-panel-message">Sin productos disponibles</div>';
    } else {
      products.forEach((item) => this.addItemToGrid(item, gridProducts));
    }

    this.updateInventoryFooter();
  },

  addItemToGrid(item, gridElement) {
    if (!gridElement) return;

    const itemElement = document.createElement("div");
    itemElement.className = "sell-item";
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

    const minusBtn = itemElement.querySelector(".minus-btn");
    const plusBtn = itemElement.querySelector(".plus-btn");
    const maxBtn = itemElement.querySelector(".max-btn");
    const input = itemElement.querySelector(".counter-input");

    minusBtn.addEventListener("click", () =>
      this.updateCounter(item.id, -1, item.quantity)
    );
    plusBtn.addEventListener("click", () =>
      this.updateCounter(item.id, 1, item.quantity)
    );
    maxBtn.addEventListener("click", () =>
      this.setMaxCounter(item.id, item.quantity)
    );
    input.addEventListener("input", () =>
      this.validateCounter(item.id, item.quantity)
    );
    input.addEventListener("change", () =>
      this.validateCounter(item.id, item.quantity)
    );

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
    const input = document.querySelector(
      `.counter-input[data-item-id="${itemId}"]`
    );
    if (input) {
      input.value = this.sellCounters[itemId] || 0;
    }
  },

  validateCounter(itemId, maxQuantity) {
    const input = document.querySelector(
      `.counter-input[data-item-id="${itemId}"]`
    );
    if (input) {
      let value = parseInt(input.value) || 0;
      value = Math.max(0, Math.min(value, maxQuantity));
      this.sellCounters[itemId] = value;
      input.value = value;
      this.updateInventoryFooter();
    }
  },

  updateInventoryFooter() {
    const totalAmount = document.querySelector(".total-amount");
    let totalValue = 0;

    const allItems = document.querySelectorAll(".sell-item");

    allItems.forEach((item) => {
      const itemId = item.dataset.itemId;
      const quantity = this.sellCounters[itemId] || 0;
      const priceText =
        item.querySelector(".sell-item-price")?.textContent || "";
      const price = parseInt(priceText.match(/\d+/)?.[0] || 0);
      totalValue += quantity * price;
    });

    if (totalAmount) {
      totalAmount.textContent = `${totalValue} 🪙`;
      totalAmount.classList.toggle("has-value", totalValue > 0);
    }

    // Habilitar/deshabilitar botón de vender
    const sellBtn = document.getElementById("sellBtn");
    if (sellBtn) {
      sellBtn.disabled = totalValue === 0;
    }
  },
    openSellConfirmModal(totalItems, totalCoins) {
    return new Promise((resolve) => {
      const modal = document.getElementById('sellConfirmModal');
      const textEl = document.getElementById('sellConfirmText');
      const btnOk = document.getElementById('sellConfirmOk');
      const btnCancel = document.getElementById('sellConfirmCancel');

      if (!modal || !textEl || !btnOk || !btnCancel) {
        // Si el modal no existe por cualquier motivo, continuar como si estuviera confirmado
        return resolve(true);
      }

      textEl.textContent = `¿Estás seguro de que quieres vender ${totalItems} ítems por ${totalCoins} 🪙?`;
      modal.classList.add('show');

      const cleanup = () => {
        modal.classList.remove('show');
        btnOk.onclick = null;
        btnCancel.onclick = null;
      };

      btnOk.onclick = () => {
        cleanup();
        resolve(true);
      };

      btnCancel.onclick = () => {
        cleanup();
        resolve(false);
      };
    });
  },

  isOpen() {
    return document.getElementById('inventoryPanel')?.classList.contains('show');
  },

  hasBlockingModalOpen() {
    const buildOpen = document.getElementById('buildPanel')?.classList.contains('show');
    const harvestOpen = document.getElementById('harvestModal')?.classList.contains('show');
    const levelUpOpen = document.getElementById('levelUpModal')?.classList.contains('show');
    return buildOpen || harvestOpen || levelUpOpen;
  },


  async sellItems() {
    const totalAmountText = document.querySelector('.total-amount')?.textContent || '0';
    const totalCoinsPreview = parseInt(totalAmountText.match(/\d+/)?.[0] || 0);

    // Calcular total de ítems seleccionados (cultivos + productos)
    let totalItemsSelected = 0;
    const itemsToSell = [];
    document.querySelectorAll('.sell-item').forEach(item => {
      const itemId = item.dataset.itemId;
      const quantity = this.sellCounters[itemId] || 0;
      if (quantity > 0) {
        totalItemsSelected += quantity;
        itemsToSell.push({ itemId, quantity });
      }
    });

    if (totalItemsSelected === 0) {
      Notifications.show('Selecciona cultivos o productos para vender', 'error');
      return;
    }

    // Confirmación bonita a partir de 100 ítems
    if (totalItemsSelected >= 100) {
      const confirmed = await this.openSellConfirmModal(
        totalItemsSelected,
        totalCoinsPreview
      );
      if (!confirmed) {
        // Usuario canceló: no tocamos contadores ni inventario
        return;
      }
    }

    let totalCoinsEarned = 0;

    // Venta real usando tu API actual
    for (const { itemId, quantity } of itemsToSell) {
      try {
        const result = await API.sellItem(itemId, quantity); // /game/sell/{PLAYER_ID} [file:0]
        if (result.success) {
          if (typeof result.coins_earned === 'number') {
            totalCoinsEarned += result.coins_earned;
          }
        } else {
          console.error('Error selling item', itemId, result);
          Notifications.show(
            `No se pudo vender ${itemId} (${result.error || 'error desconocido'})`,
            'error'
          );
        }
      } catch (err) {
        console.error('Error de conexión al vender:', err);
        Notifications.show('Error al conectar con el servidor al vender', 'error');
        return;
      }
    }

    if (totalCoinsEarned > 0) {
      Notifications.show(`Has recibido ${totalCoinsEarned} 🪙 por la venta.`, 'success');
    }

    // Actualizar estado del jugador y HUD sin recargar
    if (totalCoinsEarned > 0 && Game.gameData?.player) {
      Game.gameData.player.coins += totalCoinsEarned;

      if (window.HUD) {
        if (typeof HUD.updateCoins === 'function') {
          HUD.updateCoins(Game.gameData.player.coins); // actualiza número de monedas [file:53917c00-b7ec-4031-9562-d9b09f119e12]
        } else if (typeof HUD.update === 'function') {
          HUD.update(Game.gameData.player);
        }
      }
    }

    // Recargar inventario y resetear selección
    try {
      const inventory = await API.getInventory();
      Game.gameData.inventory = inventory;
      this.sellCounters = {};
      this.render();
    } catch (err) {
      console.error('Error recargando inventario tras vender:', err);
    }
  },


  resetSell() {
    this.sellCounters = {};
    this.render();
  },

  isOpen() {
    return document
      .getElementById("inventoryPanel")
      ?.classList.contains("show");
  },

  // Comprueba si hay otros paneles/modales abiertos
  hasBlockingModalOpen() {
    const buildOpen = document
      .getElementById("buildPanel")
      ?.classList.contains("show");
    const harvestOpen = document
      .getElementById("harvestModal")
      ?.classList.contains("show");
    const levelUpOpen = document
      .getElementById("levelUpModal")
      ?.classList.contains("show");
    return buildOpen || harvestOpen || levelUpOpen;
  },
};

window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();

  // No interceptar si el foco está en un input/textarea para no molestar
  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return;

  if (key === "e") {
    // Solo abrir/cerrar si no hay otros modales bloqueando
    if (!InventoryPanel.hasBlockingModalOpen()) {
      if (InventoryPanel.isOpen()) {
        InventoryPanel.close();
      } else {
        InventoryPanel.open();
      }
      e.preventDefault();
    }
  } else if (key === "escape") {
    if (InventoryPanel.isOpen()) {
      InventoryPanel.close();
      e.preventDefault();
    }
  }
});

