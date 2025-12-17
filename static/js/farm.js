// Render de la granja con PixiJS
const Farm = {
  app: null,
  TILE_WIDTH: 64,
  TILE_HEIGHT: 32,
  isMouseDown: false,
  buildMode: null,

  init() {
    this.app = new PIXI.Application({
      width: window.innerWidth - 280,
      height: window.innerHeight,
      backgroundColor: 0x87ceeb,
      antialias: true,
    });

    document.getElementById("game-container").appendChild(this.app.view);

    document.addEventListener("mousedown", () => {
      this.isMouseDown = true;
    });
    document.addEventListener("mouseup", () => {
      this.isMouseDown = false;
    });
  },

  render() {
    this.app.stage.removeChildren();

    const container = new PIXI.Container();
    container.x = (this.app.screen.width - 280) / 2;
    container.y = 100;

    const sortedPlots = [...Game.gameData.plots].sort(
      (a, b) => a.x + a.y - (b.x + b.y)
    );

    sortedPlots.forEach((plot) => {
      const plotSprite = this.createPlotSprite(plot);
      container.addChild(plotSprite);
    });

    this.app.stage.addChild(container);
  },
  startBuildMode(structureId) {
    this.buildMode = structureId;
  },

  cancelBuildMode() {
    this.buildMode = null;
  },

  createPlotSprite(plot) {
    const container = new PIXI.Container();
    const graphics = new PIXI.Graphics();
    const isoX = (plot.x - plot.y) * (this.TILE_WIDTH / 2);
    const isoY = (plot.x + plot.y) * (this.TILE_HEIGHT / 2);

    let fillColor =
      plot.state === "empty"
        ? 0x8b4513
        : plot.state === "ready"
        ? 0x7cfc00
        : 0x6b8e23;
    let borderColor =
      plot.state === "empty"
        ? 0x654321
        : plot.state === "ready"
        ? 0x32cd32
        : 0x556b2f;

    graphics.beginFill(fillColor);
    graphics.moveTo(isoX, isoY);
    graphics.lineTo(isoX + this.TILE_WIDTH / 2, isoY + this.TILE_HEIGHT / 2);
    graphics.lineTo(isoX, isoY + this.TILE_HEIGHT);
    graphics.lineTo(isoX - this.TILE_WIDTH / 2, isoY + this.TILE_HEIGHT / 2);
    graphics.closePath();
    graphics.endFill();

    graphics.lineStyle(2, borderColor, 0.8);
    graphics.moveTo(isoX, isoY);
    graphics.lineTo(isoX + this.TILE_WIDTH / 2, isoY + this.TILE_HEIGHT / 2);
    graphics.lineTo(isoX, isoY + this.TILE_HEIGHT);
    graphics.lineTo(isoX - this.TILE_WIDTH / 2, isoY + this.TILE_HEIGHT / 2);
    graphics.closePath();

    container.addChild(graphics);

    if (plot.crop_type) {
      const emoji = Game.CROP_INFO[plot.crop_type]?.emoji || "🌱";
      const size = plot.state === "ready" ? 36 : 28;
      const text = new PIXI.Text(plot.state === "ready" ? emoji : "🌱", {
        fontSize: size,
      });
      text.anchor.set(0.5);
      text.x = isoX;
      text.y = isoY - (plot.state === "ready" ? 20 : 15);

      if (plot.state === "ready") {
        let time = 0;
        const ticker = () => {
          time += 0.1;
          text.y = isoY - 20 + Math.sin(time) * 5;
        };
        this.app.ticker.add(ticker);
      }

      container.addChild(text);
    }

    graphics.interactive = true;
    graphics.buttonMode = true;

    graphics.on("pointerdown", async (e) => {
      // 1) Si estamos en modo construcción (build)
      if (this.buildMode) {
        e.stopPropagation();

        // Solo permitimos construir en parcelas vacías
        if (plot.state !== "empty" || plot.crop_type) {
          alert("Esta casilla ya está ocupada.");
          return;
        }

        const structureType = this.buildMode;

        try {
          const result = await API.buildStructure(
            structureType,
            plot.x,
            plot.y
          );
          if (result.success) {
            // Actualizamos estado local: según estructura
            if (structureType === "plot") {
              // una nueva parcela puede significar simplemente marcarla como desbloqueada,
              // o el backend devolverá una nueva lista de plots en result.plots
              Game.gameData.plots = result.plots || Game.gameData.plots;
            } else if (structureType === "cow_barn") {
              // guardamos edificios en gameData (array buildings)
              Game.gameData.buildings =
                result.buildings || Game.gameData.buildings || [];
            }

            // Actualizamos monedas si el backend las devuelve
            if (result.player) {
              Game.gameData.player = result.player;
              HUD.update(Game.gameData.player);
            }

            this.buildMode = null;
            BuildPanel.selectedStructure = null;
            this.render();
          } else {
            alert(
              "❌ No se pudo construir: " + (result.message || "desconocido")
            );
          }
        } catch (err) {
          console.error("Error construyendo estructura:", err);
          alert("❌ Error de conexión al construir");
        }

        return;
      }

      // 2) Si NO estamos en modo construcción, comportamiento normal: menú de cultivos
      if (
        plot.state === "empty" &&
        !CropMenu.selectedCrop &&
        !CropMenu.isDraggingFromMenu
      ) {
        CropMenu.show(e.data.global);
        e.stopPropagation();
      }
    });

    graphics.on("pointerover", () => {
      if (
        CropMenu.selectedCrop &&
        plot.state === "empty" &&
        (this.isMouseDown || CropMenu.isDraggingFromMenu) &&
        !plot._planted
      ) {
        plot._planted = true;
        console.log(
          `🌱 Plantando ${CropMenu.selectedCrop} en (${plot.x}, ${plot.y})`
        );
        this.plantCrop(plot, CropMenu.selectedCrop);
      }

      this.showTooltip(plot, event);
      graphics.alpha = 0.9;
    });

    graphics.on("pointermove", (e) => {
      this.updateTooltipPosition(e);
    });

    graphics.on("pointerout", () => {
      this.hideTooltip();
      graphics.alpha = 1;
    });

    return container;
  },

  async plantCrop(plot, cropType) {
    try {
      // 📌 1) Obtener coste del cultivo
      const cropInfo = Game.CROP_INFO[cropType];
      const cost = cropInfo?.cost || 0;

      // 📌 2) Leer monedas actuales del jugador
      const player = Game.gameData.player;
      if (!player) {
        console.error("Jugador no cargado en Game.gameData.player");
        return;
      }

      // 📌 3) Validar saldo
      if (player.coins < cost) {
        alert("❌ No tienes suficientes monedas para plantar este cultivo");
        return;
      }

      // 📌 4) Restar monedas en el cliente y refrescar HUD
      player.coins -= cost;
      HUD.updateCoins(player.coins);

      // 📌 5) Llamar API para plantar (como ya hacías)
      const result = await API.plantCrop(plot.x, plot.y, cropType);

      if (result.success) {
        plot.state = "growing";
        plot.crop_type = cropType;
        plot.ready_at = new Date(
          Date.now() + result.ready_in_minutes * 60000
        ).toISOString();

        this.render();
      } else {
        // Si el servidor rechaza la acción, devolver las monedas
        player.coins += cost;
        HUD.updateCoins(player.coins);
        alert("❌ Error al plantar: " + (result.message || "desconocido"));
      }
    } catch (error) {
      console.error("Error plantando:", error);
    }
  },

  showTooltip(plot, event) {
    const tooltip = document.getElementById("tooltip");
    const title = document.getElementById("tooltipTitle");
    const status = document.getElementById("tooltipStatus");

    if (plot.state === "empty") {
      title.textContent = "Parcela vacía";
      status.textContent = CropMenu.selectedCrop
        ? "Mantén click para plantar"
        : "Click para cultivos";
    } else if (plot.state === "growing") {
      const info = Game.CROP_INFO[plot.crop_type];
      title.textContent = `${info.name} creciendo...`;
      status.textContent = `Listo en ${this.calculateTimeLeft(plot.ready_at)}`;
    } else if (plot.state === "ready") {
      const info = Game.CROP_INFO[plot.crop_type];
      title.textContent = `${info.name} listo! 🎉`;
      status.textContent = "Usa el botón de cosecha";
    }

    tooltip.classList.add("show");
  },

  updateTooltipPosition(event) {
    const tooltip = document.getElementById("tooltip");
    tooltip.style.left = event.clientX + 15 + "px";
    tooltip.style.top = event.clientY + 15 + "px";
  },

  hideTooltip() {
    document.getElementById("tooltip").classList.remove("show");
  },

  calculateTimeLeft(readyAt) {
    const diff = new Date(readyAt) - new Date();
    if (diff <= 0) return "Listo!";

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  },
};
