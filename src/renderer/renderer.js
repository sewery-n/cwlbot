const { machineIdSync } = require('node-machine-id');
const configManager = require('../shared/data/configManager');
const { ipcRenderer, ipcMain } = require('electron');


let accounts = [];
document.addEventListener('DOMContentLoaded', async () => {
    const hwid = machineIdSync();
    document.getElementById('hwidDisplay').innerText = `HWID: ${hwid}`;

    await setupEventListeners();
    setTimeout(() => {
        document.getElementById('loader').classList.add('hidden');
    }, 1500);
});

async function loadAccounts() {
    const accountsContainer = document.getElementById('accounts-tablist');
    accountsContainer.innerHTML = ``;
    accounts = await ipcRenderer.invoke('loadAccounts');

    accounts.forEach(account => {
        const accountDiv = document.createElement('div');
        accountDiv.className = 'account-item';

        const button = document.createElement('button');
        button.innerHTML = account.profileName;
        button.addEventListener('click', async () => await startAccount(account.char_id));

        const deleteButton = document.createElement('button');
        deleteButton.innerHTML = 'X';
        deleteButton.className = 'delete-button';
        deleteButton.addEventListener('click', async (event) => {
            event.stopPropagation();
            await deleteAccount(account.char_id);
        });

        accountDiv.appendChild(button);
        accountDiv.appendChild(deleteButton);
        accountsContainer.appendChild(accountDiv);
    })
    return accounts;
}

async function saveAccounts() {
    ipcRenderer.invoke('saveAccounts', accounts);
}

async function deleteAccount(charId) {
    try {
        accounts = accounts.filter(account => account.char_id !== charId);
        await saveAccounts();
        await loadAccounts();
        const toastEl = document.getElementById('addedToast1');
        const toast = new bootstrap.Toast(toastEl);
        toast.show();
    } catch (error) {
        console.error('Error saving accounts: ', error);
    }
}

async function startAccount(charId) {
    ipcRenderer.send('start-bot', charId);
}

async function addAccount(e) {
    e.preventDefault();

    const login = document.getElementById('login').value.trim(),
        pass = document.getElementById('password').value.trim(),
        charid = document.getElementById('char_id').value.trim(),
        mode = document.getElementById('proxy-enabled').checked,
        address = document.getElementById('proxy-address').value.trim(),
        user = document.getElementById('proxy-user').value.trim(),
        ppass = document.getElementById('proxy-pass').value.trim(),
        profileName = document.getElementById('profile-name').value;

    if (!login || !pass || !charid || !profileName) {
        const toastEl = document.getElementById('declineToast');
        const toast = new bootstrap.Toast(toastEl);
        toast.show();
        return;
    }
    if (isNaN(charid) || charid <= 0) {
        const toastEl = document.getElementById('declineToast');
        const toast = new bootstrap.Toast(toastEl);
        toast.show();
        return;
    }

    accounts.push({
        login,
        password: pass,
        char_id: charid,
        proxy: { address, user, pass: ppass, enabled: mode },
        profileName,
    });
    const toastEl = document.getElementById('addedToast');
    const toast = new bootstrap.Toast(toastEl);
    toast.show();


    document.getElementById('add-account-form').reset();
    await saveAccounts();
}

async function setupEventListeners() {
    document.getElementById('close').addEventListener('click', () => {
        ipcRenderer.invoke('quit');
    });

    document.getElementById('add-account-button').addEventListener('click', addAccount);

    document.getElementById('tab-settings').addEventListener('click', async () => {
        await loadAccounts();
    });

    document.querySelectorAll('.tablist button').forEach(button => {
        button.addEventListener('click', () => {
            const panelId = button.id.replace('tab-', 'panel-');
            document.querySelectorAll('.panels > div').forEach(panel => {
                panel.style.display = panel.id === panelId ? 'block' : 'none';
            });
            document.querySelectorAll('.tablist button').forEach(btn => {
                btn.classList.toggle('active', btn === button);
            });
        });
    });
}