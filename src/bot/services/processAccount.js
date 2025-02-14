const { addExtra } = require('puppeteer-extra');
const rebrowserPuppeteer = require('rebrowser-puppeteer-core');
const path = require('path');
const os = require('os');
const puppeteer = addExtra(rebrowserPuppeteer)
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { logInAccount } = require('./logInAccount');
const { sleep, getRandomDelay } = require('../../shared/utils/time');
const WebSocket = require('ws');
const { getData, getReachableMobs, getClosestNpc, getAvailableEntries } = require('../handlers/mapHandler');
const { move, goTo, clickText, talkToNpc } = require('../handlers/movementHandler');
const { closeFight, autoFight } = require('../handlers/fightHandler');
const { runAC } = require('../handlers/captchaHandler');
const QuestHandler = require('../handlers/questHandler');
const MerchantHandler = require('../handlers/merchantHandler');

puppeteer.use(StealthPlugin());

class AccountProcess {
    constructor(account) {
        this.account = account;
        this.browser = null;
        this.page = null;
        this.settings = null;
        this.ws = null;
        this.globalpath = null;
        this.mapsWithTp = [589, 1141, 9, 1, 2, 33, 35, 574, 114, 500, 630, 1739, 1740, 1741, 1742, 1743, 1744, 1738];
        this.mapsWithDisabledTp = [353, 344];
        this.currentIndex = 0;
        this.reverseMode = false;
        this.currentTargetCoords = null;
        this.lastAttackReq = new Date() / 60;
        this.initializeBrowser();
        this.questHandler = null;
        this.merchantHandler = null;
    }

    async initializeWebSocket(url) {
        this.ws = new WebSocket(url);

        this.ws.on('open', () => {
            this.ws.send(JSON.stringify({
                action: 'get-settings',
                charID: this.account.char_id
            }));
        });

        this.ws.on('message', (message) => this.handleWebSocketMessage(message));

        this.ws.on('close', () => setTimeout(() => this.initializeWebSocket('ws://srv27.mikr.us:40077'), 5000));
    }

    handleWebSocketMessage(message) {
        try {
            const messageText = message.toString().trim();
            if (!messageText) {
                console.error('Received an empty or undefined message');
                return;
            }
            const parsedMessage = JSON.parse(messageText);
            const parsedMessageData = JSON.parse(parsedMessage.data);

            if (parsedMessageData && parsedMessageData.charID !== undefined) {
                if (parseInt(this.account.char_id) === parseInt(parsedMessageData.charID)) {
                    if (parsedMessage.type === "get-settings") {
                        this.settings = JSON.parse(parsedMessage.data);
                    }
                    if (parsedMessage.type === "get-way") {
                        let response = JSON.parse(parsedMessage.data);
                        this.globalpath = response.path.map(Number);
                        console.log(this.globalpath);
                    }
                }
            } else {
                console.error('Received message with undefined charID:', parsedMessageData);
            }

        } catch (error) {
            console.error('Error while receiving message: ', error);
        }
    }

    async initializeBrowser() {
        const sanitizedCharId = String(this.account.profileName).replace(/[^a-zA-Z0-9-_]/g, '_');
        const userDataDir = path.join(os.homedir(), sanitizedCharId);
        //process.resourcesPath
        this.browser = await puppeteer.launch({
            headless: false,
            userDataDir,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--brave-enable-shields-web',
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--disable-dev-shm-usage',
                `--load-extension=${path.join(process.resourcesPath, 'extension')}`,
                this.account.proxy.enabled ? '--proxy-server=' + this.account.proxy.address : '',
            ],
            executablePath: `C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe`,
            defaultViewport: null,
        });

        this.page = await this.browser.newPage();
        if (this.account.proxy.enabled) await this.page.authenticate({ username: this.account.proxy.user, password: this.account.proxy.password });

        await this.initializeWebSocket('ws://srv27.mikr.us:40077');

        try {
            await logInAccount(this.page, this.account);

            this.questHandler = new QuestHandler(this.page, this.account.char_id, this.settings, this.ws);
            this.merchantHandler = new MerchantHandler(this.page, this.account, this.settings, this.ws, this.globalpath, this.handleGlobalPath);

            const tasks = [
                this.expTask(),
                this.autohealTask(),
                this.sellingTask(),
                this.captchaTask(),
                this.eliteTask(),
                this.stasisTask(),
                this.alertAccept(),
                this.processFight(),
                this.questTask()
            ];

            await Promise.all(tasks);
        } catch (error) {
            console.log(error);
        }

    }

    async handleGlobalPath(currentMap, targetMap) {
        try {
            const mapsWithTp = [589, 1141, 9, 1, 2, 33, 35, 574, 114, 500, 630, 1739, 1740, 1741, 1742, 1743, 1744, 1738];
            const gateways = await getAvailableEntries(this.page);
            this.ws.send(JSON.stringify({
                action: "get-way",
                charID: this.account.char_id || this.charID,
                target: String(targetMap),
                current: String(currentMap),
                gateways: gateways,
            }));
            if (!this.globalpath || !Array.isArray(this.globalpath) || this.globalpath.length === 0) {
                await sleep(2000);
                return false;
            }

            let nextMapId = this.globalpath[this.globalpath.indexOf(currentMap) + 1];
            if (
                (mapsWithTp.includes(Number(currentMap)) &&
                    mapsWithTp.includes(Number(nextMapId))) &&
                !(Number(currentMap) === 589 && Number(nextMapId) === 630 && !mapsWithTp.includes(this.globalpath[this.globalpath.indexOf(currentMap) + 2]))) {

                // javascript-obfuscator:disable
                let ZPA = await this.page.evaluate(() => {
                    return Engine.npcs.getDrawableList().filter(obj => obj.d)
                        .filter(npc =>
                            npc.d.nick === 'Astralny koncentrator' ||
                            npc.d.nick === 'Zakonnik Planu Astralnego' ||
                            npc.d.nick === 'Portal' ||
                            npc.d.nick === 'Kapitan Fork la Rush'
                        )[0]?.d;
                });
                // javascript-obfuscator:enable

                if (ZPA) {
                    const success = await move(this.page, ZPA.x, ZPA.y, false);
                    if (!success) {
                        await this.page.keyboard.press('R');
                        await sleep(getRandomDelay(350, 450));
                        await this.page.keyboard.press('1');
                        await sleep(getRandomDelay(350, 450));
                        const cityMap = {
                            1: 'Ithan',
                            2: 'Torneg',
                            9: 'Werbin',
                            33: 'Eder',
                            35: 'Karka-han',
                            114: 'Thuzal',
                            500: 'Liściaste',
                            574: 'Nithal',
                            1141: 'Trupia',
                            589: 'Tuzmer',
                            1739: 'Archipelag',
                            1740: 'Ingotię',
                            1741: 'Rem',
                            1742: 'Caneum',
                            1743: 'Magradit',
                            1744: 'Wyspę Wraków',
                            1738: 'Agii Triady'
                        };
                        if (nextMapId in cityMap) {
                            console.log("globalpath:", this.globalpath);
                            console.log("currentMap:", currentMap);
                            console.log("Index of currentMap:", this.globalpath.indexOf(currentMap));
                            console.log(nextMapId);
                            await clickText(this.page, cityMap[nextMapId]);
                            await sleep(getRandomDelay(350, 450));
                        }
                    }
                }
            } else {
                if (nextMapId) {
                    await goTo(this.page, nextMapId);
                }
            }
            return true;
        } catch (error) {
            console.log(error);
        }
    }

    async eliteTask() {
        while (true) {
            try {

                // javascript-obfuscator:disable
                const init = await this.page.evaluate(() => window.Engine && Engine.allInit);
                // javascript-obfuscator:enable
                if (!init) {
                    await sleep(150);
                    continue;
                }

                this.ws.send(JSON.stringify({
                    action: 'get-settings',
                    charID: this.account.char_id
                }));
                // javascript-obfuscator:disable
                const dead = await this.page.evaluate(() => Engine.dead);
                // javascript-obfuscator:enable
                if (this.settings.elite_settings.eliteMode && !this.settings.selling_settings.active && !dead) {
                    // javascript-obfuscator:disable
                    const currentMap = await this.page.evaluate(() => Engine.map.d.id);
                    // javascript-obfuscator:enable
                    const targetMap = this.settings.elite_settings.eliteMap;

                    if (parseInt(targetMap) != parseInt(currentMap)) {
                        const success = await this.handleGlobalPath(currentMap, targetMap);
                        if (!success) {
                            continue;
                        }
                        await sleep(2000);
                        continue;
                    }

                    //ELITE LOGIC
                    // javascript-obfuscator:disable
                    const target = await this.page.evaluate((nick) => {
                        return Engine.npcs.getDrawableList()
                            .filter(obj => obj.d)
                            .filter(npc => npc.d.nick === nick)[0]?.d;
                    }, this.settings.elite_settings.eliteName);

                    const heroPos = await this.page.evaluate(() => {
                        return { x: Engine.hero.d.x, y: Engine.hero.d.y }
                    });
                    // javascript-obfuscator:enable
                    const coords = this.settings.elite_settings.coords
                        ? this.settings.elite_settings.coords[0].split(';').map(coord => coord.split(',').map(Number))
                        : null;

                    if (target) {
                        const success = await move(this.page, target.x, target.y, true);
                        if (success) {
                            this.currentTargetCoords = coords[Math.floor(Math.random() * coords.length)];
                        } else await this.sendAttackReq();
                    } else {
                        if (!this.currentTargetCoords) {
                            this.currentTargetCoords = coords[Math.floor(Math.random() * coords.length)];
                        }
                        if (heroPos.x !== this.currentTargetCoords[0] && heroPos.y !== this.currentTargetCoords[1]) {
                            await move(this.page, this.currentTargetCoords[0], this.currentTargetCoords[1]);
                        }
                    }
                }
                await sleep(getRandomDelay(500, 1000));
            } catch (error) {
                console.log(error);
                await sleep(getRandomDelay(2999, 3400));
            }
        }
    }

    async sendAttackReq() {
        if (new Date() / 60 - this.lastAttackReq < 0.3) return;
        this.page.keyboard.press('E');
        this.lastAttackReq = new Date() / 60;
        await sleep(getRandomDelay(450, 750));
    }

    async expTask() {
        while (true) {
            try {
                // javascript-obfuscator:disable
                const init = await this.page.evaluate(() => window.Engine && Engine.allInit);
                // javascript-obfuscator:enable
                if (!init) {
                    await sleep(150);
                    continue;
                }

                this.ws.send(JSON.stringify({
                    action: 'get-settings',
                    charID: this.account.char_id
                }));

                // javascript-obfuscator:disable
                const dead = await this.page.evaluate(() => Engine.dead);
                // javascript-obfuscator:enable
                if (this.settings.exp_settings.expMode && !this.settings.selling_settings.active && !dead) {
                    // javascript-obfuscator:disable
                    let currentMap = await this.page.evaluate(() => Engine.map.d.id);
                    // javascript-obfuscator:enable
                    let maps = this.settings.exp_settings.maps.split(',').map(Number);
                    if (!maps.includes(currentMap)) {
                        const success = await this.handleGlobalPath(currentMap, maps[0]);

                        if (!success) {
                            continue;
                        }

                        await sleep(2000);
                        continue;
                    }

                    // EXP LOGIC
                    const data = await getData(this.page);
                    const monsters = data.npcs.filter((npc) => {
                        return (
                            npc.lvl >= this.settings.exp_settings.minLevel &&
                            npc.lvl <= this.settings.exp_settings.maxLevel &&
                            (
                                (npc.wt > 79 && npc.wt <= 89) ||
                                (npc.wt < 10 || (npc.wt >= 40 && npc.wt < 80))
                            )
                        );
                    });
                    const reachableMonsters = await getReachableMobs(this.page, data.hero, monsters);
                    if (reachableMonsters.length === 0) {
                        let nextIndex = !this.reverseMode ? this.currentIndex + 1 : this.currentIndex - 1;
                        if (nextIndex >= maps.length) {
                            this.reverseMode = true;
                            nextIndex = maps.length - 1;
                        } else if (nextIndex < 0) {
                            this.reverseMode = false;
                            nextIndex = 0;
                        }

                        let nextMapId = maps[nextIndex];
                        if (currentMap === nextMapId) {
                            this.currentIndex = nextIndex;
                            await sleep(getRandomDelay(400, 800));
                            continue;
                        }
                        if (currentMap !== nextMapId) {
                            const success = await goTo(this.page, nextMapId);
                            if (success) {
                                // javascript-obfuscator:disable
                                currentMap = await this.page.evaluate(() => Engine.map.d.id);
                                // javascript-obfuscator:enable
                                if (maps[nextIndex] === currentMap) {
                                    this.currentIndex = nextIndex;
                                } else {
                                    this.currentIndex = maps.findIndex((mapId, idx) => mapId === currentMap && idx !== this.currentIndex);
                                    if (this.currentIndex === -1) {
                                        this.currentIndex = 0;
                                    }
                                }
                            }
                        }
                        this.currentIndex = nextIndex;
                    } else {
                        const closestMob = await getClosestNpc(this.page, data.hero, data.npcs);
                        if (closestMob) {
                            const success = await move(this.page, closestMob.position.x, closestMob.position.y, false);
                            if (!success) {
                                // javascript-obfuscator:disable
                                const isObstacle = await this.page.evaluate((x, y) => Engine.map.col.check(x, y), closestMob.position.x, closestMob.position.y);
                                // javascript-obfuscator:enable
                                if (isObstacle >= 1 & isObstacle <= 4) {
                                    await this.sendAttackReq();
                                }

                                // javascript-obfuscator:disable
                                const dead = await this.page.evaluate(() => Engine.dead);
                                const battle = await this.page.evaluate(() => Engine.battle.show);
                                // javascript-obfuscator:enable

                                if (dead && !battle) {
                                    await this.page.keyboard.press("z");
                                }
                                continue;
                            }
                        }
                    }
                }
                await sleep(getRandomDelay(500, 1000));
            } catch (error) {
                console.log(error);
                await sleep(getRandomDelay(2999, 3400));
            }
        }
    }


    async autohealTask() {
        while (true) {
            try {
                // javascript-obfuscator:disable
                const init = await this.page.evaluate(() => window.Engine && Engine.allInit);
                // javascript-obfuscator:enable
                if (!init) {
                    await sleep(1000);
                    continue;
                }
                const autoheal = true;
                // javascript-obfuscator:disable
                const dead = await this.page.evaluate(() => Engine.dead);
                // javascript-obfuscator:enable
                if (autoheal && !dead) {
                    // javascript-obfuscator:disable
                    let { hpp, itemToUse } = await this.page.evaluate(() => {
                        const hpp = $("div.hpp > span")[0]?.innerText || '0';

                        let itemToUse = '';
                        let items = Engine.items.fetchLocationItems("g").filter(item => item._cachedStats.leczy);
                        if (items.length) {
                            items = items.sort((a, b) => a._cachedStats.leczy - b._cachedStats.leczy);
                            itemToUse = items[0].id;
                        }

                        return { hpp, itemToUse };
                    });

                    const dead = await this.page.evaluate(() => Engine.dead);
                    const battle = await this.page.evaluate(() => Engine.battle.show);
                    // javascript-obfuscator:enable
                    if (!dead && !battle) {
                        if (parseInt(hpp) <= parseInt(85)) {
                            if (itemToUse) {
                                await this.page.click(`.item-id-${itemToUse}`, { count: 2 });
                                await sleep(getRandomDelay(150, 200));
                            }
                        }
                    }
                    await sleep(getRandomDelay(250, 400));
                }
            } catch (error) {
                console.log(error);
                await sleep(getRandomDelay(2999, 3400));
            }
        }
    }

    async sellingTask() {
        while (true) {
            try {
                this.ws.send(JSON.stringify({
                    action: 'get-settings',
                    charID: this.account.char_id
                }));
                // javascript-obfuscator:disable
                const init = await this.page.evaluate(() => window.Engine && Engine.allInit);
                // javascript-obfuscator:enable
                if (!init) {
                    await sleep(2000);
                    continue;
                }
                if (!this.merchantHandler) {
                    console.log('QuestHandler nie jest init');
                    await sleep(getRandomDelay(500, 1200));
                }
                this.merchantHandler.updateSettings(this.settings, this.globalpath);
                this.merchantHandler.handleMerchant();
                await sleep(getRandomDelay(1000, 1400));
            } catch (error) {
                console.log(error);
                await sleep(getRandomDelay(1500, 3000));
            }

        }
    }

    async captchaTask() {
        while (true) {
            try {
                const init = await this.page.evaluate(() => window.Engine && Engine.allInit);
                // javascript-obfuscator:enable
                if (!init) {
                    await sleep(150);
                    continue;
                }
                await runAC(this.page);
                await sleep(getRandomDelay(300, 600));
            } catch (error) {
                console.log(error);
                await sleep(getRandomDelay(300, 600));
            }
        }
    }

    async stasisTask() {
        while (true) {
            try {
                // javascript-obfuscator:disable
                const init = await this.page.evaluate(() => window.Engine && Engine.allInit);
                // javascript-obfuscator:enable
                if (!init) {
                    await sleep(150);
                    continue;
                }
                // javascript-obfuscator:disable
                const stasisIncoming = await this.page.evaluate(() => document.querySelector('.stasis-incoming-overlay').style.display != "none" ? true : false);
                const stasisAlready = await this.page.evaluate(() => document.querySelector('.stasis-overlay').style.display != "none" ? true : false);
                // javascript-obfuscator:enable
                // javascript-obfuscator:disable
                const dead = await this.page.evaluate(() => Engine.dead);
                // javascript-obfuscator:enable
                if ((stasisIncoming || stasisAlready) && !dead) {
                    // javascript-obfuscator:disable
                    await this.page.keyboard.down('W');
                    await sleep(getRandomDelay(70, 100));
                    await this.page.keyboard.up('W');

                    await sleep(getRandomDelay(60, 80));

                    await this.page.keyboard.down('S');
                    await sleep(getRandomDelay(70, 100));
                    await this.page.keyboard.up('S');
                    // javascript-obfuscator:enable
                }
                await sleep(getRandomDelay(1500, 3000));
            } catch (error) {
                console.log(error);
                await sleep(getRandomDelay(300, 600));
            }
        }
    }

    async alertAccept() {
        while (true) {
            try {
                // javascript-obfuscator:disable
                const init = await this.page.evaluate(() => window.Engine && Engine.allInit);
                // javascript-obfuscator:enable
                if (!init) {
                    await sleep(150);
                    continue;
                }
                // javascript-obfuscator:disable
                const mAlert = await this.page.evaluate(() => document.querySelector('.mAlert') != undefined);
                // javascript-obfuscator:enable
                if (mAlert) {
                    // javascript-obfuscator:disable
                    await this.page.click('.mAlert .window-controlls .button');
                    // javascript-obfuscator:enable
                    await sleep(getRandomDelay(1000, 1300));
                }
                await sleep(getRandomDelay(1500, 3000));
            } catch (error) {
                console.log(error);
                await sleep(getRandomDelay(800, 1200));
            }
        }
    }

    async processFight() {
        while (true) {
            try {
                // javascript-obfuscator:disable
                const init = await this.page.evaluate(() => window.Engine && Engine.allInit);
                // javascript-obfuscator:enable
                if (!init) {
                    await sleep(150);
                    continue;
                }
                // javascript-obfuscator:disable
                const battle = await this.page.evaluate(() => document.querySelector('.battle-controller').style.display != 'none' ? true : false);
                // javascript-obfuscator:enable
                if (battle) {
                    // javascript-obfuscator:disable
                    const battleEnd = await this.page.evaluate(() => Engine.battle.endBattleForMe);
                    if (battleEnd) {
                        await this.page.click('.battle-controller .close-battle-ground');
                        await sleep(getRandomDelay(1000, 1300));
                    }
                    const autoFight = await this.page.evaluate(() => Engine.battle.isAutoFightActive());
                    if (!autoFight) {
                        await this.page.click('.auto-fight-btn');
                        await sleep(getRandomDelay(1000, 1300));
                    }
                }
                await sleep(getRandomDelay(1500, 3000));
            } catch (error) {
                console.log(error);
                await sleep(getRandomDelay(800, 1200));
            }

        }
    }

    async questTask() {
        while (true) {
            try {
                this.ws.send(JSON.stringify({
                    action: 'get-settings',
                    charID: this.account.char_id
                }));
                // javascript-obfuscator:disable
                const init = await this.page.evaluate(() => window.Engine && Engine.allInit);
                // javascript-obfuscator:enable
                if (!init) {
                    await sleep(150);
                    continue;
                }
                if (!this.questHandler) {
                    console.log('QuestHandler nie jest init');
                    return;
                }
                if (this.settings.quests_settings) {
                    this.questHandler.updateSettings(this.settings);
                    await this.questHandler.handleQuest();
                }
                await sleep(getRandomDelay(500, 1200));
            } catch (error) {
                console.log(error);
                await sleep(getRandomDelay(1500, 3000));
            }

        }
    }
}
module.exports = AccountProcess;