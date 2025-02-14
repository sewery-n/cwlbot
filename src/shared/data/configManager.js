const fs = require('fs');
const path = require('path');
const os = require('os');

class ConfigManager {
    constructor() {
        const userDataDir = os.homedir();
        this.accountsPath = path.join(userDataDir, 'botv2', 'accounts.json');
        this.settingsDir = path.join(userDataDir, 'botv2', 'settings');
        this.file = this.accountsPath;
        this.defaultConfig = {
            accounts: [
            ]
        };

        if (!fs.existsSync(this.settingsDir)) {
            fs.mkdirSync(this.settingsDir, { recursive: true });
        }
    }

    async generateConfigFiles() {
        if (!fs.existsSync(this.file)) {
            fs.writeFileSync(this.file, JSON.stringify(this.defaultConfig, null, 2));
        }
    }

    async loadConfig() {
        if (!fs.existsSync(this.file)) {
            await this.generateConfigFiles();
        }
        return JSON.parse(fs.readFileSync(this.file, 'utf-8'));
    }

    async saveConfig(newConfig) {
        fs.writeFileSync(this.file, JSON.stringify(newConfig, null, 2));
    }

    async loadAccounts() {
        try {
            const config = await this.loadConfig();
            return config.accounts || [];
        } catch (error) {
            console.error("Error loading accounts:", error);
            throw error;
        }
    }

    async saveAccounts(accounts) {
        const config = await this.loadConfig();
        config.accounts = accounts;
        this.saveConfig(config);
    }
}
module.exports = new ConfigManager();