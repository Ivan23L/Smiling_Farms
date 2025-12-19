// Render de la granja con PixiJS
const Farm = {
  app: null,
  TILE_WIDTH: 64,
  TILE_HEIGHT: 32,
  isMouseDown: false,
  buildMode: null,

  // 👇 NUEVO: mapa de biomas 70x70 y zoom
  MAP_WIDTH: 70,
  MAP_HEIGHT: 70,
  biomeMap: [],
  decorations: [],
  worldContainer: null,
  zoom: 1,
  isPanning: false,
  panStart: { x: 0, y: 0 },
  worldStart: { x: 0, y: 0 },
    worldBounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },


  init() {
    this.app = new PIXI.Application({
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: 0x5fa3d1,
      antialias: true,
    });

    document.getElementById("game-container").appendChild(this.app.view);

    document.addEventListener("mousedown", () => {
      this.isMouseDown = true;
    });
    document.addEventListener("mouseup", () => {
      this.isMouseDown = false;
    });
    //  inicializar mapa de biomas y contenedor del “mundo”
    this.worldContainer = new PIXI.Container();
    this.app.stage.addChild(this.worldContainer);

    // Zoom con límites suaves
    this.app.view.addEventListener("wheel", (e) => {
      e.preventDefault();
      const zoomFactor = 1.1;
      const oldZoom = this.zoom;

      if (e.deltaY < 0) this.zoom = Math.min(this.zoom * zoomFactor, 2.2);
      else this.zoom = Math.max(this.zoom / zoomFactor, 0.7);

      const mousePos = this.app.renderer.plugins.interaction.mouse.global;
      const wx = (mousePos.x - this.worldContainer.x) / oldZoom;
      const wy = (mousePos.y - this.worldContainer.y) / oldZoom;

      this.worldContainer.scale.set(this.zoom);
      this.worldContainer.x = mousePos.x - wx * this.zoom;
      this.worldContainer.y = mousePos.y - wy * this.zoom;
      this.clampCamera();
    });

    // Drag para mover el mapa
    this.app.view.addEventListener("mousedown", (e) => {
      this.isPanning = true;
      this.panStart.x = e.clientX;
      this.panStart.y = e.clientY;
      this.worldStart.x = this.worldContainer.x;
      this.worldStart.y = this.worldContainer.y;
    });

    window.addEventListener("mouseup", () => {
      this.isPanning = false;
    });

    window.addEventListener("mousemove", (e) => {
      if (!this.isPanning) return;
      const dx = e.clientX - this.panStart.x;
      const dy = e.clientY - this.panStart.y;
      this.worldContainer.x = this.worldStart.x + dx;
      this.worldContainer.y = this.worldStart.y + dy;
      this.clampCamera();
    });
    this.generateBiomeMap();
    this.generateDecorations();
  },
  clampCamera() {
    const z = this.zoom;
    const viewW = this.app.screen.width;
    const viewH = this.app.screen.height;

    // worldBounds están en coords del container, así que invertimos la transform
    const left   = this.worldBounds.minX * z + this.worldContainer.x;
    const right  = this.worldBounds.maxX * z + this.worldContainer.x;
    const top    = this.worldBounds.minY * z + this.worldContainer.y;
    const bottom = this.worldBounds.maxY * z + this.worldContainer.y;

    // no dejar que se vea “fuera” del mapa
    if (left > 100) {
      this.worldContainer.x -= left - 100;
    }
    if (right < viewW - 100) {
      this.worldContainer.x += (viewW - 100) - right;
    }
    if (top > 80) {
      this.worldContainer.y -= top - 80;
    }
    if (bottom < viewH - 80) {
      this.worldContainer.y += (viewH - 80) - bottom;
    }
  },

  // Genera un mapa 70x70 de biomas decorativos
  generateBiomeMap() {
    this.biomeMap = [];

    for (let y = 0; y < this.MAP_HEIGHT; y++) {
      const row = [];
      for (let x = 0; x < this.MAP_WIDTH; x++) {
        let biome = "field"; // campo por defecto

        // bosque en la parte norte
        if (y < 15 && x > 10) biome = "forest";

        // montaña en la esquina noreste
        if (x > 50 && y < 20) biome = "mountain";

        // río vertical cerca del centro
        if (x === 30 || x === 31) biome = "river";

        row.push(biome);
      }
      this.biomeMap.push(row);
    }
  },
  generateDecorations() {
    this.decorations = [];

    // Árboles esparcidos en el bosque
    for (let i = 0; i < 80; i++) {
      const x = 15 + Math.floor(Math.random() * 30);
      const y = 0 + Math.floor(Math.random() * 18);
      this.decorations.push({ type: "tree", x, y });
    }

    // Rocas en la zona de montaña
    for (let i = 0; i < 40; i++) {
      const x = 48 + Math.floor(Math.random() * 20);
      const y = 5 + Math.floor(Math.random() * 18);
      this.decorations.push({ type: "rock", x, y });
    }

    // Valla alrededor de la granja (zona suroeste)
    for (let x = 4; x <= 16; x++) {
      this.decorations.push({ type: "fence", x, y: 30 });
      this.decorations.push({ type: "fence", x, y: 40 });
    }
    for (let y = 30; y <= 40; y++) {
      this.decorations.push({ type: "fence", x: 4, y });
      this.decorations.push({ type: "fence", x: 16, y });
    }

    // Puente sobre el río
    const bridgeY = 28;
    for (let dx = -2; dx <= 2; dx++) {
      this.decorations.push({
        type: "bridge",
        x: 30 + dx,
        y: bridgeY + dx, // ligeramente diagonal
      });
    }
  },

  render() {
    // Limpiamos el contenedor del mundo (pero no el stage entero)
    this.worldContainer.removeChildren();

    const container = new PIXI.Container();

    // 1) Dibujar mapa de biomas completo
    const biomeLayer = new PIXI.Container();

    for (let y = 0; y < this.MAP_HEIGHT; y++) {
      for (let x = 0; x < this.MAP_WIDTH; x++) {
        const biome = this.biomeMap[y][x];
        const tile = this.createBiomeTile(x, y, biome);
        biomeLayer.addChild(tile);
      }
    }

    container.addChild(biomeLayer);
    const decoLayer = new PIXI.Container();
    this.decorations.forEach((d) => {
      const sprite = this.createDecorationSprite(d);
      decoLayer.addChild(sprite);
    });
    container.addChild(decoLayer);
    // 2) Dibujar las parcelas existentes (las mismas que ya usas)
    const plotsLayer = new PIXI.Container();

    const sortedPlots = [...Game.gameData.plots].sort(
      (a, b) => a.x + a.y - (b.x + b.y)
    );

    sortedPlots.forEach((plot) => {
      const plotSprite = this.createPlotSprite(plot);
      plotsLayer.addChild(plotSprite);
    });

    container.addChild(plotsLayer);

    // 3) Posicionar el mundo: granja al suroeste del mapa
    container.x = this.app.screen.width / 2;
    container.y = this.app.screen.height / 2 + 80;

    if (this.worldContainer.children.length === 0) {
      // primer render; centramos pensando en HUD arriba
      container.x = this.app.screen.width / 2;
      container.y = this.app.screen.height / 2 + 80;
    }
    this.worldContainer.addChild(container);
        // calcular bounds del mundo (para limitar el drag)
    const topLeft     = this.isoToScreen(0, 0);
    const topRight    = this.isoToScreen(this.MAP_WIDTH, 0);
    const bottomLeft  = this.isoToScreen(0, this.MAP_HEIGHT);
    const bottomRight = this.isoToScreen(this.MAP_WIDTH, this.MAP_HEIGHT);

    const xs = [topLeft.x, topRight.x, bottomLeft.x, bottomRight.x];
    const ys = [topLeft.y, topRight.y, bottomLeft.y, bottomRight.y];

    this.worldBounds.minX = Math.min(...xs);
    this.worldBounds.maxX = Math.max(...xs);
    this.worldBounds.minY = Math.min(...ys);
    this.worldBounds.maxY = Math.max(...ys);

  },
    isoToScreen(x, y) {
    return {
      x: (x - y) * (this.TILE_WIDTH / 2),
      y: (x + y) * (this.TILE_HEIGHT / 2),
    };
  },


  startBuildMode(structureId) {
    this.buildMode = structureId;
  },

  cancelBuildMode() {
    this.buildMode = null;
  },
  // Dibuja un tile de bioma (campo, bosque, río, montaña) en coordenadas de mapa
  createBiomeTile(mapX, mapY, biome) {
    const g = new PIXI.Graphics();

    const isoX = (mapX - mapY) * (this.TILE_WIDTH / 2);
    const isoY = (mapX + mapY) * (this.TILE_HEIGHT / 2);

    let fillColor;
    let borderColor;
    switch (biome) {
      case "forest":
        fillColor = 0x1f6b3b; // verde bosque más vivo
        borderColor = 0x174f2c;
        break;
      case "river":
        fillColor = 0x3399ff; // azul claro
        borderColor = 0x1c6fbf;
        break;
      case "mountain":
        fillColor = 0x8d9ba6; // gris azulado
        borderColor = 0x6b7a86;
        break;
      default: // field
        fillColor = 0x7fcf5b; // verde césped brillante
        borderColor = 0x5fa33f;
        break;
    }

    g.beginFill(fillColor);
    g.moveTo(isoX, isoY);
    g.lineTo(isoX + this.TILE_WIDTH / 2, isoY + this.TILE_HEIGHT / 2);
    g.lineTo(isoX, isoY + this.TILE_HEIGHT);
    g.lineTo(isoX - this.TILE_WIDTH / 2, isoY + this.TILE_HEIGHT / 2);
    g.closePath();
    g.endFill();

    g.lineStyle(1, borderColor, 0.7);
    g.moveTo(isoX, isoY);
    g.lineTo(isoX + this.TILE_WIDTH / 2, isoY + this.TILE_HEIGHT / 2);
    g.lineTo(isoX, isoY + this.TILE_HEIGHT);
    g.lineTo(isoX - this.TILE_WIDTH / 2, isoY + this.TILE_HEIGHT / 2);
    g.closePath();

    return g;
  },
  createDecorationSprite(dec) {
    const g = new PIXI.Graphics();
    const isoX = (dec.x - dec.y) * (this.TILE_WIDTH / 2);
    const isoY = (dec.x + dec.y) * (this.TILE_HEIGHT / 2);

    if (dec.type === "tree") {
      // tronco
      g.beginFill(0x8d5a2b);
      g.drawRect(isoX - 4, isoY - 10, 8, 10);
      g.endFill();
      // copa
      g.beginFill(0x2e7d32);
      g.drawCircle(isoX, isoY - 22, 14);
      g.endFill();
    }

    if (dec.type === "rock") {
      g.beginFill(0x90a4ae);
      g.drawPolygon(
        isoX - 10,
        isoY,
        isoX,
        isoY - 8,
        isoX + 10,
        isoY,
        isoX + 4,
        isoY + 6,
        isoX - 4,
        isoY + 6
      );
      g.endFill();
    }

    if (dec.type === "fence") {
      g.lineStyle(3, 0x795548);
      g.moveTo(isoX - 8, isoY + 4);
      g.lineTo(isoX + 8, isoY - 4);
    }

    if (dec.type === "bridge") {
      g.beginFill(0xa1887f);
      g.drawRect(isoX - 14, isoY - 4, 28, 8);
      g.endFill();
      g.lineStyle(1, 0x5d4037);
      g.moveTo(isoX - 14, isoY - 4);
      g.lineTo(isoX + 14, isoY - 4);
      g.moveTo(isoX - 14, isoY + 4);
      g.lineTo(isoX + 14, isoY + 4);
    }

    g.zIndex = dec.y;
    return g;
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
window.Farm = Farm;
