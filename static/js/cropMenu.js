// Menú radial de cultivos
const CropMenu = {
  isOpen: false,
  selectedCrop: null,
  isDraggingFromMenu: false,

  init() {
    const overlay = document.getElementById("cropMenuOverlay");

    // Al soltar en cualquier parte: termina el modo "pintura" y se limpia selección
    document.addEventListener("mouseup", () => {
      this.isDraggingFromMenu = false;
      this.selectedCrop = null;
    });

    // Cerrar completamente con ESC (por si el usuario quiere cancelar)
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isOpen) {
        this.close();
      }
    });

    // Evitar que el overlay interfiera con el drag
    if (overlay) {
      overlay.addEventListener("mousedown", (e) => {
        e.stopPropagation();
      });
    }
  },

  /**
   * Muestra el menú cerca de la posición del click,
   * ajustándolo para que nunca se salga de la pantalla.
   * @param {{x:number, y:number}} position Coordenadas globales (e.data.global)
   */
  show(position) {
    const menu = document.getElementById("cropMenu");
    const overlay = document.getElementById("cropMenuOverlay");
    const container = menu.querySelector(".radial-menu-container");

    // Limpiar items anteriores
    container.querySelectorAll(".radial-item").forEach((item) => item.remove());

    const playerLevel = Game.gameData.player.level;
    const unlockedCrops = Game.gameData.unlocked_crops || [];

    // Cultivos visibles (hasta nivel +5)
    const visibleCrops = Object.entries(Game.CROP_INFO).filter(([_, info]) => {
      return info.level <= playerLevel + 5;
    });
    if (visibleCrops.length === 0) return;

    // Posicionar menú dentro de los límites de la ventana
    const menuSize = 300;
    const halfSize = menuSize / 2;
    const padding = 12;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let targetX = position.x;
    let targetY = position.y;

    targetX = Math.max(
      halfSize + padding,
      Math.min(viewportWidth - halfSize - padding, targetX)
    );
    targetY = Math.max(
      halfSize + padding,
      Math.min(viewportHeight - halfSize - padding, targetY)
    );

    menu.style.left = `${targetX}px`;
    menu.style.top = `${targetY}px`;

    // Distribuir items en círculo
    const radius = 110;
    const angleStep = (2 * Math.PI) / visibleCrops.length;

    visibleCrops.forEach(([cropType, info], index) => {
      const unlocked = unlockedCrops.includes(cropType);
      const comingSoon = !unlocked && info.level <= playerLevel + 5;

      const angle = angleStep * index - Math.PI / 2;
      const x = Math.cos(angle) * radius + menuSize / 2;
      const y = Math.sin(angle) * radius + menuSize / 2;

      const item = document.createElement("div");
      let classes = "radial-item";
      if (!unlocked) classes += comingSoon ? " coming-soon" : " locked";
      item.className = classes;
      item.dataset.crop = cropType;

      // Centrar card 100x100 en x,y
      item.style.left = `${x - 50}px`;
      item.style.top = `${y - 50}px`;

      const costText = info.cost > 0 ? `${info.cost} 🪙` : "Gratis";
      const timeText = info.time || "";

      item.innerHTML = `
        <div class="radial-item-emoji">${info.emoji || "🌱"}</div>
        <div class="radial-item-name">${info.name}</div>
        <div class="radial-item-time">${timeText}</div>
        <div class="radial-item-level">Nv. ${info.level} • ${costText}</div>
        ${
          !unlocked
            ? `<div class="radial-item-lock">${
                comingSoon ? "⏳" : "🔒"
              }</div>`
            : ""
        }
      `;

      if (unlocked) {
        // Clic normal: seleccionar cultivo (modo "click a click" si lo quieres)
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          this.selectCrop(cropType, item);
        });

        // Mantener pulsado: activar modo pintar y ocultar menú
        item.addEventListener("mousedown", (e) => {
          e.stopPropagation();
          this.selectCrop(cropType, item);
          this.isDraggingFromMenu = true;
          this.hideVisual();
        });
      } else {
        // Feedback para bloqueados
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          if (comingSoon) {
            alert(
              `✨ Próximamente: ${info.name} se desbloquea en el nivel ${info.level}`
            );
          } else {
            alert(
              `🔒 Necesitas nivel ${info.level} para plantar ${info.name}`
            );
          }
        });
      }

      container.appendChild(item);
    });

    this.isOpen = true;
    overlay.classList.add("show");
    menu.classList.add("show");
  },

  selectCrop(cropType, itemElement) {
    this.selectedCrop = cropType;

    const container = document.querySelector(
      "#cropMenu .radial-menu-container"
    );
    if (!container) return;

    container
      .querySelectorAll(".radial-item")
      .forEach((el) => el.classList.remove("selected"));
    if (itemElement) itemElement.classList.add("selected");
  },

  hideVisual() {
    const menu = document.getElementById("cropMenu");
    const overlay = document.getElementById("cropMenuOverlay");
    this.isOpen = false;
    menu.classList.remove("show");
    overlay.classList.remove("show");
  },

  close() {
    this.hideVisual();
    this.selectedCrop = null;
    this.isDraggingFromMenu = false;
  }
};
