class WebSocketManager {
    constructor(url) {
        this.url = url;
        this.socket = null;
        this.callbacks = [];
        this.isConnected = false;
    }

    init() {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) return;

        this.socket = new WebSocket(this.url);

        this.socket.onopen = () => {
            console.log("✅ WebSocket połączony!");
            this.isConnected = true;
        };

        this.socket.onmessage = (event) => {
            console.log("📩 Otrzymano wiadomość:", event.data);
            const data = JSON.parse(event.data);
            this._handleMessage(data);
        };

        this.socket.onerror = (error) => {
            console.error("❌ Błąd WebSocket:", error);
        };

        this.socket.onclose = () => {
            console.warn("⚠️ WebSocket zamknięty. Próba ponownego połączenia...");
            this.isConnected = false;
            setTimeout(() => this.init(), 5000);
        };
    }

    onMessage(callback) {
        this.callbacks.push(callback);
    }

    _handleMessage(data) {
        this.callbacks.forEach(callback => callback(data));
    }

    sendMessage(message) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
        } else {
            console.error("❌ WebSocket nie jest dostępny. Kolejkujemy wiadomość...");
            setTimeout(() => this.sendMessage(message), 1000);
        }
    }
}

class CharacterManager {
    constructor() {
        this.charId = null;
    }

    async getCharData() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length === 0 || !tabs[0].url.includes(".margonem.pl")) {
                throw new Error("Rozszerzenie działa tylko na domenie Margonem");
            }

            const cookie = await this.getCharIdFromActiveTab();
            if (!cookie) throw new Error("Nie znaleziono cookie mchar_id");

            this.charId = cookie.value;
            return { charId: this.charId };
        } catch (error) {
            console.error("⚠️ Błąd pobierania danych postaci:", error);
            throw error;
        }
    }

    getCharIdFromActiveTab() {
        return new Promise((resolve, reject) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length === 0) return reject(new Error("Brak aktywnej karty"));

                chrome.cookies.get({ url: tabs[0].url, name: "mchar_id" }, (cookie) => {
                    if (cookie) resolve(cookie);
                    else reject(new Error("Nie znaleziono cookie o nazwie mchar_id"));
                });
            });
        });
    }
}

const app = {
    wsManager: null,
    charManager: new CharacterManager(),

    async initWebSocket() {
        if (!this.wsManager) {
            this.wsManager = new WebSocketManager("ws://srv27.mikr.us:40077");
            this.wsManager.init();
        }

        this.wsManager.onMessage(async (data) => {
            if (data.type === "get-settings") {
                try {
                    const charData = await this.charManager.getCharData();
                    chrome.runtime.sendMessage({ 
                        action: "updateSettings", 
                        charID: charData.charId, 
                        settings: JSON.parse(data.data) 
                    });
                } catch (error) {
                    console.error("❌ Błąd pobierania danych postaci:", error);
                }
            }
        });
    },

    async getSettings() {
        try {
            if (!this.wsManager || !this.wsManager.isConnected) {
                console.warn("WebSocket nie jest jeszcze gotowy, inicjalizacja...");
                await this.initWebSocket();
            }

            const charData = await this.charManager.getCharData();
            this.wsManager.sendMessage({ action: "get-settings", charID: charData.charId });
        } catch (error) {
            console.error("❌ Błąd pobierania ustawień:", error);
        }
    },

    async sendSettings(message) {
        try {
            if (!this.wsManager || !this.wsManager.isConnected) {
                console.warn("WebSocket nie jest jeszcze gotowy, inicjalizacja...");
                await this.initWebSocket();
            }

            const charID = this.charManager.charId || (await this.charManager.getCharData()).charId;
            const settings = { ...message.settings.settings, charID };
            
            console.log("📤 Wysyłanie ustawień:", settings);
            this.wsManager.sendMessage({ action: "save-settings", settings });
        } catch (error) {
            console.error("❌ Błąd wysyłania ustawień:", error);
        }
    }
};

// Obsługa wiadomości w rozszerzeniu
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
        switch (message.action) {
            case "initWebSocket":
                app.initWebSocket();
                return true;
            case "getSettings":
                app.getSettings();
                return true;
            case "sendSettings":
                app.sendSettings(message);
                return true;
        }
    } catch (error) {
        console.error("❌ Błąd przetwarzania wiadomości:", error);
        sendResponse({ error: error.message });
    }
});