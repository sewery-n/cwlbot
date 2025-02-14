const { app, BrowserWindow, ipcMain } = require('electron');
const WebSocket = require('ws');
const path = require('path');
const { log } = require('../shared/utils/logger');
const configManager = require('../shared/data/configManager');
const channels = require('../shared/ipcChannels');
const { config } = require('process');
const Bot = require('../bot/bot');

class MainWindow {
    constructor() {
        this.win = null;
        this.botProcesses = {};
        this.accounts = [];
        this.initApp();
    }

    initApp() {
        app.on('ready', () => {
            this.createWindow();
            this.setupIPC();
        });

        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') app.quit();
        });

        app.on('activate', () => {
            if (this.win === null) this.createWindow();
        });
    }

    createWindow() {
        this.win = new BrowserWindow({
            width: 1366,
            height: 768,
            resizable: false,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            },
            autoHideMenuBar: true
        });
        this.win.loadFile(path.join(__dirname, '../renderer/index.html'));
        this.win.on('closed', () => this.win = null);
    }

    async loadAccounts () {
        const accounts = await configManager.loadAccounts();
        this.accounts = accounts;
        return accounts;
    }

    async saveAccounts(accounts) {
        return await configManager.saveAccounts(accounts);
    }

    setupIPC() {

        ipcMain.handle('quit', () => app.quit());

        ipcMain.handle('loadAccounts', async () => await this.loadAccounts());

        ipcMain.handle('saveAccounts', async (event, accounts) => await this.saveAccounts(accounts));

        ipcMain.on('start-bot', async (event, charId) => {
            try {
                const findAccount = this.accounts.find(account => account.char_id === charId);
                if(!findAccount) {
                    return;
                }
                await Bot.startBot(findAccount);
            } catch (error) {
                //console.log(error);
            }
        });

    }

}

module.exports = MainWindow;
new MainWindow();

