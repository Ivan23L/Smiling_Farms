// API Client para comunicación con el backend
const API = {
    BASE_URL: 'http://localhost:8080/api',
    PLAYER_ID: 1,

    async init() {
        const response = await fetch(`${this.BASE_URL}/game/init/${this.PLAYER_ID}`);
        return await response.json();
    },

    async getInventory() {
        const response = await fetch(`${this.BASE_URL}/game/inventory/${this.PLAYER_ID}`);
        return await response.json();
    },

    async plantCrop(x, y, cropType) {
        const response = await fetch(`${this.BASE_URL}/game/plant/${this.PLAYER_ID}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ x, y, crop_type: cropType })
        });
        return await response.json();
    },

    async harvestCrop(x, y) {
        const response = await fetch(`${this.BASE_URL}/game/harvest/${this.PLAYER_ID}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ x, y })
        });
        return await response.json();
    },

    async sellItem(itemType, quantity) {
        const response = await fetch(`${this.BASE_URL}/game/sell/${this.PLAYER_ID}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_type: itemType, quantity })
        });
        return await response.json();
    }
};
