
const processAccount = async (account) => {
    const sanitizedCharId = String(account.char_id).replace(/[^a-zA-Z0-9-_]/g, '_');
    const userDataDir = path.join(os.homedir(), sanitizedCharId);

    const browser = await puppeteer.launch({
        headless: false,
        userDataDir,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--brave-enable-shields-web',
            '--disable-blink-features=AutomationControlled',
            '--disable-infobars',
            '--disable-dev-shm-usage',
            `--load-extension=${path.join(process.resourcesPath, 'extension')}`
        ],
        executablePath: `C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe`,
        defaultViewport: null,
    });

    const page = await browser.newPage();

    if (account.proxy.enabled) await page.authenticate({ username: acc.proxy.user, password: acc.proxy.password });

    ws = new WebSocket('ws://srv27.mikr.us:40077');
    ws.on('open', () => {
        ws.send(JSON.stringify({
            action: 'get-settings',
            charID: account.char_id
        }));
    });

    ws.on('message', (message) => {
        try {
            const messageText = message.toString();
            const parsedMessage = JSON.parse(messageText);
            if (parsedMessage.data.charID !== account.char_id)
                return;
            if (parsedMessage.type === "get-settings") {
                settings = JSON.parse(parsedMessage.data);
            }
            if (parsedMessage.type === "get-way") {
                response = JSON.parse(parsedMessage.data);
                globalpath = response.path.map(Number);
            }
        } catch (error) {
            console.error('Error while receiving message: ', error);
        }
    });

    try {
        await logInAccount(page, account);
        const tasks = [];
        tasks.push(expTask(page, account));
        tasks.push(autohealTask(page, account));
        tasks.push(autoFightTask(page));
        tasks.push(sellingTask(page, account));
        tasks.push(captchaTask(page));
        await Promise.all(tasks);
    } catch (error) {
        //console.log(error);
        await browser.close();
        await processAccount(account);
    }
}


const expTask = async (page, account) => {
    let currentIndex = 0,
        reverseMode = false;

    const TELEPORT_NPC_MAPS = [589, 1141, 9, 1, 2, 33, 35, 574, 114, 500];
    while (true) {
        try {
            const init = await page.evaluate(() => window.Engine && Engine.allInit);
            if (!init) {
                await sleep(400);
                continue;
            }
            ws.send(JSON.stringify({
                action: 'get-settings',
                charID: account.char_id
            }));
            const mode = settings.expMode || false,
                isSelling = settings.selling_settings.active;
            if (mode && !isSelling) {
                const currentMap = await page.evaluate(() => Engine.map.d.id);
                const maps = settings.maps.split(',').map(Number);
                if (!maps.includes(currentMap)) {
                    ws.send(JSON.stringify({
                        action: "get-way",
                        charID: account.char_id,
                        target: settings.maps.split(',')[0],
                        current: currentMap + ""
                    }));
                    if (!globalpath && !currentMap) {
                        await sleep(2000);
                        continue;
                    }
                    const nextMapId = globalpath[globalpath.indexOf(currentMap) + 1];
                    if (TELEPORT_NPC_MAPS.includes(Number(currentMap)) && TELEPORT_NPC_MAPS.includes(Number(nextMapId))) {
                        const ZPA = await page.evaluate(() => {
                            return Engine.npcs.getDrawableList().filter(obj => obj.d).filter(npc => npc.d.nick == 'Astralny koncentrator' || npc.d.nick == 'Zakonnik Planu Astralnego')[0]?.d;
                        });

                        if (ZPA) {
                            const success = await move(page, ZPA.x, ZPA.y, false);
                            if (!success) {
                                await page.keyboard.press('R');
                                await sleep(getRandomDelay(350, 450));
                                await page.keyboard.press('1');
                                await sleep(getRandomDelay(350, 450));
                                switch (nextMapId) {
                                    case 1:
                                        await clickText(page, 'Ithan');
                                        await sleep(getRandomDelay(350, 450));
                                        break;
                                    case 2:
                                        await clickText(page, 'Torneg');
                                        await sleep(getRandomDelay(350, 450));
                                        break;
                                    case 9:
                                        await clickText(page, 'Werbin');
                                        await sleep(getRandomDelay(350, 450));
                                        break;
                                    case 33:
                                        await clickText(page, 'Eder');
                                        await sleep(getRandomDelay(350, 450));
                                        break;
                                    case 35:
                                        await clickText(page, 'Karka-han');
                                        await sleep(getRandomDelay(350, 450));
                                        break;
                                    case 114:
                                        await clickText(page, 'Thuzal');
                                        await sleep(getRandomDelay(350, 450));
                                        break;
                                    case 500:
                                        await clickText(page, 'Liściaste');
                                        await sleep(getRandomDelay(350, 450));
                                        break;
                                    case 574:
                                        await clickText(page, 'Nithal');
                                        await sleep(getRandomDelay(350, 450));
                                        break;
                                    case 1141:
                                        await clickText(page, 'Trupia Przełęcz');
                                        await sleep(getRandomDelay(350, 450));
                                        break;
                                    case 589:
                                        await clickText(page, 'Tuzmer');
                                        await sleep(getRandomDelay(350, 450));
                                        break;
                                }
                            }
                        }
                    } else {

                        if (nextMapId) {
                            await goTo(page, nextMapId);
                        }
                    }

                    await sleep(2000);
                    continue;
                }
                globalpath = '';
                const data = await getData(page);
                const monsters = data.npcs.filter((npc) => {
                    return (
                        npc.lvl >= settings.minLevel &&
                        npc.lvl <= settings.maxLevel &&
                        (
                            (npc.wt > 79 && npc.wt <= 89 && heros) ||
                            (npc.wt < 10 || (npc.wt >= 40 && npc.wt < 80))
                        )
                    );
                });
                const reachableMonsters = await getReachableMobs(page, data.hero, monsters);
                if (reachableMonsters.length === 0) {
                    let nextIndex = !reverseMode ? currentIndex + 1 : currentIndex - 1;

                    if (nextIndex >= maps.length) {
                        reverseMode = true;
                        nextIndex = maps.length - 2;
                    } else if (nextIndex < 0) {
                        reverseMode = false;
                        nextIndex = 0;
                    }

                    let nextMapId = maps[nextIndex];
                    if (currentMap === nextMapId) {
                        currentIndex = nextIndex;
                        await sleep(getRandomDelay(400, 800));
                        continue;
                    }
                    if (currentMap !== nextMapId) {
                        const success = await goTo(page, nextMapId);
                        if (success) {
                            currentMap = await page.evaluate(() => Engine.map.d.id);

                            if (maps[nextIndex] === currentMap) {
                                currentIndex = nextIndex;
                            } else {
                                currentIndex = maps.findIndex((mapId, idx) => mapId === currentMap && idx !== currentIndex);
                                if (currentIndex === -1) {
                                    currentIndex = 0;
                                }
                            }
                        }
                    }
                    currentIndex = nextIndex;
                } else {
                    const closestMob = await getClosestNpc(page, data.hero, data.npcs);
                    if (closestMob) {
                        const success = await move(page, closestMob.position.x, closestMob.position.y, false);
                        if (!success) {
                            const isObstacle = await page.evaluate((x, y) => Engine.map.col.check(x, y), closestMob.position.x, closestMob.position.y);
                            if (isObstacle >= 1 & isObstacle <= 4) {
                                await sleep(getRandomDelay(450, 650));
                                await page.keyboard.press('E');
                            }
                            continue;
                        }
                    }
                }
            }
            await sleep(getRandomDelay(500, 1000));
        } catch (error) {
            //console.log("Blad w EXP dla konta: ", error);
            await sleep(getRandomDelay(2999, 3400));
        }
    }
}

const autohealTask = async (page, account) => {
    while (true) {
        try {
            const init = await page.evaluate(() => window.Engine && Engine.allInit);
            if (!init) {
                await sleep(2000);
                continue;
            }
            const autoheal = true;
            if (autoheal) {
                const { hpp, itemToUse } = await page.evaluate(() => {
                    const hpp = $("div.hpp > span")[0]?.innerText || '0';

                    let itemToUse = '';
                    let items = Engine.items.fetchLocationItems("g").filter(item => item._cachedStats.leczy);
                    if (items.length) {
                        items = items.sort((a, b) => a._cachedStats.leczy - b._cachedStats.leczy);
                        itemToUse = items[0].id;
                    }

                    return { hpp, itemToUse };
                });
                let isClosed = await page.evaluate(() => {
                    return typeof Engine !== 'undefined' && Engine.battle && Engine.battle.endBattleForMe && Engine.battle.show;
                });

                let isDead = await page.evaluate(() => {
                    return typeof Engine !== 'undefined' && Engine.dead;
                });
                if (!isDead || !isClosed) {
                    if (parseInt(hpp) <= parseInt(85)) {
                        if (itemToUse) {
                            await page.click(`.item-id-${itemToUse}`, { count: 2 });
                            await sleep(getRandomDelay(150, 200));
                        }
                    }
                }
            }
            await sleep(getRandomDelay(250, 400));
        } catch (error) {
            //console.log(error);
            await sleep(getRandomDelay(2999, 3400));
        }
    }
}

const autoFightTask = async (page) => {
    while (true) {
        try {
            const init = await page.evaluate(() => window.Engine && Engine.allInit);
            if (!init) {
                await sleep(2000);
                continue;
            }
            await autoFight(page);
            await sleep(getRandomDelay(200, 450));
            await fightClose(page);
            await sleep(getRandomDelay(200, 450));
        } catch (error) {
            await sleep(getRandomDelay(2999, 3400));
        }
    }
}


const sellingTask = async (page, account) => {
    while (true) {
        try {
            const init = await page.evaluate(() => window.Engine && Engine.allInit);
            if (!init) {
                await sleep(2000);
                continue;
            }

            const { active, selling_step, selling_mode, buying_mode, nonsellable, sellable } = settings.selling_settings;
            const mapsWithDisabledTP = [353, 344];
            const { freeSpace, isDialogue, isShopActive, currentMap, heroPos } = await page.evaluate(() => {
                let freeSpace = Engine.bags[0][0] - Engine.bags[0][1] + Engine.bags[1][0] - Engine.bags[1][1] + Engine.bags[2][0] - Engine.bags[2][1],
                    isDialogue = Engine.dialogue,
                    isShopActive = document.getElementsByClassName('shop-content').length > 0,
                    currentMap = Engine.map.d.id,
                    heroPos = { x: Engine.hero.d.x, y: Engine.hero.d.y };
                return { freeSpace, isDialogue, isShopActive, currentMap, heroPos }
            });
            let tpItem = await page.evaluate(() => {
                let item = Engine.items.fetchLocationItems('g').find(item => item.name === 'Zwój teleportacji na Kwieciste Przejście');
                return item ? item.id : null;
            });
            let potions = await page.evaluate(() => {
                return Engine.items.fetchLocationItems("g").filter(item => item._cachedStats.leczy);
            });
            //console.log(potions);
            if (selling_mode) {
                if ((freeSpace == 0 && selling_step == "0") || (potions == '' && selling_step == "0")) {
                    ws.send(JSON.stringify({
                        action: "setSelling",
                        charID: account.char_id,
                        active: true,
                    }));
                    ws.send(JSON.stringify({
                        action: "sellingStep",
                        charID: account.char_id,
                        step: "1"
                    }));
                }
                else if (selling_step == "1") {
                    ws.send(JSON.stringify({
                        action: "get-way",
                        charID: account.char_id,
                        target: "353",
                        current: currentMap + ""
                    }));

                    if (!mapsWithDisabledTP.includes(currentMap)) {
                        if (tpItem) {
                            await page.click(`.item-id-${tpItem}`, { count: 2 });
                            await sleep(getRandomDelay(1500, 3000));
                        } else await page.evaluate(() => message('Nie posiadasz zwijów teleportacji na Kwieciste Przejście'));
                    }

                    const nextMapId = globalpath[globalpath.indexOf(currentMap) + 1];
                    if (currentMap !== 353) {
                        await goTo(page, nextMapId);
                    } else {
                        if (heroPos.x == 7 && heroPos.y == 10) {
                            ws.send(JSON.stringify({
                                action: "sellingStep",
                                charID: account.char_id,
                                step: "2"
                            }));
                        } else await move(page, 7, 10, true);
                    }
                }
                else if (selling_step == "2") {
                    if (!isShopActive && !isDialogue) {
                        await page.keyboard.press('R');
                    }

                    if (!isShopActive && isDialogue) {
                        await clickText(page, 'Pokaż mi,');
                    }

                    if (isShopActive) {
                        const itemsToSell = await page.evaluate(() => {
                            const nonSellable = ['permbound', 'soulbound', 'unique', 'heroic', 'legendary'];
                            const sellableClasses = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 23, 29];
                            return Engine.items.fetchLocationItems('g').filter(item =>
                                sellableClasses.includes(item.cl) && !nonSellable.some(stat => item.stat.includes(stat))
                            );
                        });

                        if (itemsToSell != '') {
                            let acceptButton = `body > div.game-window-positioner.default-cursor.eq-column-size-1.chat-size-1 > div.alerts-layer.layer > div.border-window.ui-draggable.window-on-peak > div.content > div.inner-content > div > div.shop-content.normal-shop-zl > div.finalize-button.btns-spacing > div > div.label`;
                            let shopButtons = await page.$$('body > div > div.alerts-layer.layer > div.border-window.ui-draggable.window-on-peak > div.content > div.inner-content > div > div > div.great-merchamp.btns-spacing > div > div.label');
                            for (let i = 0; i < 3; i++) {
                                for (let j = 0; j < 3; j++) {
                                    await shopButtons[i].click();
                                    await sleep(getRandomDelay(499, 899));
                                    await page.click(acceptButton);
                                    await sleep(getRandomDelay(499, 899));
                                }
                            }
                        } else {
                            let acceptButton = `body > div.game-window-positioner.default-cursor.eq-column-size-1.chat-size-1 > div.alerts-layer.layer > div.border-window.ui-draggable.window-on-peak > div.content > div.inner-content > div > div.shop-content.normal-shop-zl > div.finalize-button.btns-spacing > div > div.label`;
                            if (buying_mode) {
                                if (potions == '') {
                                    await page.click('.item-id-41882', { count: 3 * 8 });
                                    await sleep(getRandomDelay(499, 899));
                                    await page.click(`.item-id-1471`, { count: 1 });
                                    await sleep(getRandomDelay(499, 899));
                                    await page.click(acceptButton);
                                }
                            }
                            const closeButton = `body > div > div.alerts-layer.layer > div.border-window.ui-draggable.window-on-peak > div.close-button-corner-decor > button`;
                            await page.click(closeButton);
                            ws.send(JSON.stringify({
                                action: "sellingStep",
                                charID: account.char_id,
                                step: "0"
                            }));
                            ws.send(JSON.stringify({
                                action: "setSelling",
                                charID: account.char_id,
                                active: false,
                            }));
                            await sleep(getRandomDelay(499, 800));
                        }
                    }
                }
            }
            await sleep(getRandomDelay(500, 1000));
        } catch (error) {
            await sleep(getRandomDelay(2999, 3400));
        }
    }
}

const captchaTask = async (page) => {
    while (true) {
        try {
            await runAC(page);
            await sleep(getRandomDelay(200, 450));
        } catch (error) {
            //console.log('error');
        }
    }
}

module.exports = processAccount;