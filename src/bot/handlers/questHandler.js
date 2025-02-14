const { move, talkToNpc, clickText, goTo } = require("./movementHandler");
const { sleep, getRandomDelay } = require('../../shared/utils/time');
const { getData, getReachableMobs, getClosestNpc } = require("./mapHandler");

class QuestHandler {
    constructor(page, charId, settings, ws) {
        this.page = page;
        this.settings = settings;
        this.ws = ws;
        this.steps = [];
        this.charID = charId;
        this.currentStep = null;
        this.lastAttackReq = new Date() / 60;
        this.prof = null;
    }

    async handleQuest() {


        if(!this.settings.quests_settings) return;
        this.currentStep = this.settings.quests_settings.quest_step;
        
        const { quest_mode, selected, quest_step } = this.settings.quests_settings;
        if (!quest_mode) return;



        const isDialoguesOpen = await this.isDialoguesOpen();

        if (this.steps.length === 0) {
            await this.loadSteps();
            this.prof = await this.page.evaluate(() => Engine.hero.d.prof);
        }

        await this.executeStep(quest_step, isDialoguesOpen);
    }

    async isDialoguesOpen() {
        return this.page.evaluate(() => Engine.dialogue);
    }

    updateSettings(newSettings) {
        this.settings = newSettings;
    }

    async checkMapAndMove(targetMap, x, y) {
        const map = await this.page.evaluate(() => Engine.map.d.id);
        if (Number(map) === Number(targetMap)) {
            await move(this.page, x, y, false);
        } else {
            await this.nextStep();
        }
    }

    async isEquipped(id) {
        return await this.page.evaluate((id) => {
            return Object.values(Engine.heroEquipment.getEqItems()).some(item => item.id == id);
        }, id);
    }


    filterMonstersByLevel(npcs, min, max) {
        return npcs.filter(npc => npc.lvl >= min && npc.lvl <= max);
    }

    async equipItems(page, itemNames) {
        const itemsToWear = await page.evaluate((itemNames) => {
            return Engine.items.fetchLocationItems('g')
                .filter(item => itemNames.includes(item.name))
                .map(item => ({ id: item.id, name: item.name }));
        }, itemNames);

        const unequippedItems = (await Promise.all(
            itemsToWear.map(async item => ({
                ...item,
                equipped: await this.isEquipped(item.id)
            }))
        )).filter(item => !item.equipped);

        if (unequippedItems.length === 0) {
            return true;
        }

        for (const item of unequippedItems) {
            await this.page.click(`.item-id-${item.id}`, { count: 2 });
            await sleep(getRandomDelay(150, 200));
        }

        return false;
    }

    async sendAttackReq() {
        if (new Date() / 60 - this.lastAttackReq < 0.3) return;
        this.page.keyboard.press('E');
        this.lastAttackReq = new Date() / 60;
        await sleep(getRandomDelay(450, 750));
    }

    async findAndAttackMonsters(page, min, max, questStep) {
        const data = await getData(page);
        const monsters = this.filterMonstersByLevel(data.npcs, min, max);
        const reachableMonsters = await getReachableMobs(page, data.hero, monsters);

        if (reachableMonsters.length === 0) {
            this.nextStep();
            return true;
        }

        const closestMob = await getClosestNpc(page, data.hero, data.npcs);
        if (!closestMob) return;

        const success = await move(page, closestMob.position.x, closestMob.position.y, false);
        if (!success) {
            const isObstacle = await page.evaluate((x, y) => Engine.map.col.check(x, y), closestMob.position.x, closestMob.position.y);
            if (isObstacle >= 1 && isObstacle <= 4) {
                await this.sendAttackReq();
            }
        }
    }


    async hasItemInInventory(page, name) {
        return await page.evaluate(name => {
            return Engine.items.fetchLocationItems('g').some(item => item.name === name);
        }, name);
    }

    async buyItemsIfNeeded(page, items) {
        let shopOpen = await this.page.evaluate(() => document.getElementsByClassName('shop-content').length > 0);
        if (!shopOpen) return false;

        const shopItems = await this.page.evaluate(() => {
            return Object.values(Engine.shop.items).map(item => ({ id: item.id, name: item.name }));
        });


        const missingItems = (await Promise.all(
            items.map(async name => ({
                name,
                hasItem: await this.hasItemInInventory(page, name)
            }))
        )).filter(item => !item.hasItem);

        if (missingItems.length === 0) return true;

        console.log(missingItems);
        for (const item of missingItems) {

            let itemNames = Array.isArray(item.name) ? item.name : [item.name];
            for (const name of itemNames) {
                const shopItem = shopItems.find(shopItem => shopItem.name === name);
                if (shopItem) {
                    await page.click(`.item-id-${shopItem.id}`);
                    await sleep(getRandomDelay(150, 200));
                    break;
                }
            }
        }

        const acceptButton = `body > div.game-window-positioner.default-cursor.eq-column-size-1.chat-size-1 > div.alerts-layer.layer > div.border-window.ui-draggable.window-on-peak > div.content > div.inner-content > div > div.shop-content.normal-shop-zl > div.finalize-button.btns-spacing > div > div.label`;
        await page.click(acceptButton);

        await sleep(getRandomDelay(1000, 1500));

        const updatedItems = await Promise.all(
            items.map(async name => ({
                name,
                hasItem: await this.hasItemInInventory(page, name)
            }))
        );

        if (updatedItems.every(item => item.hasItem)) {
            console.log('Wszystkie przedmioty zostaly zakupione!');
            const closeButton = `body > div > div.alerts-layer.layer > div.border-window.ui-draggable.window-on-peak > div.close-button-corner-decor > button`;
            await this.page.click(closeButton);
            return true;
        } else {
            console.log('Niektore przedmioty nie zostaly zakupione.');
            return false;
        }
    }

    async pickupItem(name) {
        const availableItems = await this.page.evaluate((name) => {
            return Object.values(Engine.npcs.check()).filter(obj => obj.d).filter(obj => obj.d.nick == name);
        }, name);
        const heroPos = await this.page.evaluate(() => ({
            x: Engine.hero.d.x,
            y: Engine.hero.d.y
        }));

        const closest = availableItems
            .map(item => ({
                id: item.d.id,
                nick: item.d.nick,
                x: item.d.x,
                y: item.d.y,
                distance: Math.abs(heroPos.x - item.d.x) + Math.abs(heroPos.y - item.d.y)
            }))
            .sort((a, b) => a.distance - b.distance);

        if (closest.length === 0) return false;

        const success = await move(this.page, closest[0].x, closest[0].y, false);
        if (!success) {
            await this.page.keyboard.press('N');
            return false;
        }

        await this.page.keyboard.press('N');
        return true;
    }

    async craftItem(id, name, amount = 1) {
        const isCraftingOpen = await this.page.evaluate(() => Engine.crafting.opened);
        if (!isCraftingOpen) await this.page.keyboard.press('/');


        if (await this.hasItemInInventory(this.page, name)) {
            await this.page.keyboard.press('Escape');
            return true;
        }


        await this.page.click(`.recipe-id-${id}`);
        await sleep(getRandomDelay(350, 600));
        await this.page.click('.use-recipe-btn');


        if (await this.hasItemInInventory(this.page, name)) {
            console.log('Mikstura w eq');
            await this.page.keyboard.press('Escape');
            return true;
        }
        return false;
    }


    async barterItem(id, item, name) {
        const useButton = 'body > div.game-window-positioner.default-cursor.eq-column-size-1.chat-size-1 > div.alerts-layer.layer > div.border-window.ui-draggable.barter-window.window-on-peak > div.content > div.inner-content > div > div.right-column > div.right-scroll.scroll-wrapper.classic-bar > div.scroll-pane > div.additional-container > div.button.small.green';
        let isBarterOpen = await this.page.evaluate(() => Engine.barter);


        if (await this.hasItemInInventory(this.page, name)) {
            await this.page.keyboard.press('Escape');
            return true;
        }

        let req = 't=barter&id=51&offerId=1616&action=use&usesCount=1&available=0&desiredItem=25611&ev=1739211955.425704&browser_token=213278866';


        console.log('klikam');


        if (await this.hasItemInInventory(this.page, name)) {
            await this.page.keyboard.press('Escape');
            return true;
        }
        return false;
    }


    async nextStep() {
        this.currentStep = Number(this.currentStep) + 1;
        this.settings.quests_settings.quest_step = this.currentStep;
        this.ws.send(JSON.stringify({
            action: "questStep",
            charID: this.charID,
            step: String(this.currentStep)
        }));
    }

    async waitUntil(condition, timeout = 5000, interval = 100) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            if (await condition()) return true;
            await sleep(interval);
        }
        return false;
    }

    async loadSteps() {
        const questData = await this.fetchQuestStepsFromServer();

        this.steps = questData.map(step => {
            switch (step.type) {
                case "dialogue":
                    console.log('dialog');
                    return async (isDialoguesOpen) => {
                        if (isDialoguesOpen) {
                            await this.nextStep();
                        } else {
                            await talkToNpc(this.page, step.npcId);
                        }
                    };

                case "skipTalk":
                    return async (isDialoguesOpen) => {
                        if (isDialoguesOpen) {
                            await this.waitUntil(async () => {
                                await this.page.keyboard.press("1");
                                await sleep(100);
                                return !(await this.isDialoguesOpen());
                            }, 5000);
                        }
                        await this.nextStep();
                    };

                case "move":
                    return async () => {
                        await move(this.page, step.x, step.y, step.instant);
                    }

                case "moveTo":
                    return async () => {
                        await this.checkMapAndMove(step.current, step.x, step.y);
                    };

                case "equip":
                    return async () => {
                        console.log('equip');
                        const allEquipped = await this.equipItems(this.page, step.items);
                        if (allEquipped) await this.nextStep();
                    };

                case "fight":
                    return async () => {
                        await this.findAndAttackMonsters(this.page, step.minLevel, step.maxLevel);
                    };

                case "buy":
                    return async () => {
                        const allBought = await this.buyItemsIfNeeded(this.page, step.items);
                        if (allBought) await this.nextStep();
                    };

                case "pickup":
                    return async () => {
                        if (await this.hasItemInInventory(this.page, step.item)) {
                            await this.nextStep();
                            return;
                        }
                        await this.pickupItem(step.item);
                    };

                case "clickText":
                    return async () => {
                        await clickText(this.page, step.text);
                        await this.nextStep();
                    };

                case "attack":
                    return async () => {
                        const target = await this.page.evaluate((name) => {
                            return Engine.npcs.getDrawableList().filter(obj => obj.d).find(obj => obj.d.nick == name);
                        }, step.name);

                        if(!target) this.nextStep();

                        const success = await move(this.page, target.rx, target.ry, false);
                        if (!success) {
                            await this.page.keyboard.press('E');
                        } else await this.nextStep();
                    };

                case "useItem":
                    return async () => {
                        const item = await this.page.evaluate((name) => {
                            return Engine.items.fetchLocationItems('g').find(item => item.name == name)?.id
                        }, step.name);

                        if (item) {
                            await this.page.click(`.item-id-${item}`, { count: 2 });
                            await sleep(getRandomDelay(150, 300));
                        } else await this.nextStep();
                    };

                case "craft":
                    return async () => {
                        const itemToCraft = await this.craftItem(step.id, step.name, step.amount);
                        if (itemToCraft) await this.nextStep();
                    };

                case "barter":
                    return async () => {
                        const barterItem = await this.barterItem(step.id, step.item, step.name);
                        if (barterItem) await this.nextStep();
                    }

                case "doItWhile":
                    return async () => {
                        let doIt = await this.page.evaluate((doItId, doIt) => {
                            return $(`p[data-quest-id="${doItId}"]`)[0].innerText !== doIt;
                        }, step.doItId, step.doIt);
                        let currentIndex = 0;
                        let forward = true;
                        let maps = step.doItMaps;
                        while (doIt) {
                            const success = await this.findAndAttackMonsters(this.page, 10, 20, 96);

                            if (success) {
                                if (forward) {
                                    if (currentIndex < maps.length - 1) {
                                        currentIndex++;
                                    } else {
                                        forward = false;
                                        currentIndex--;
                                    }
                                } else {
                                    if (currentIndex > 0) {
                                        currentIndex--;
                                    } else {
                                        forward = true;
                                        currentIndex++;
                                    }
                                }
                                await goTo(this.page, maps[currentIndex]);
                            }
                            doIt = await this.page.evaluate((doItId, doIt) => {
                                return $(`p[data-quest-id="${doItId}"]`)[0].innerText !== doIt;
                            }, step.doItId, step.doIt);
                        }
                        this.nextStep();
                    };

                case "goTo":
                    return async () => {
                        const map = await this.page.evaluate(() => Engine.map.d.id);
                        if (Number(map) != Number(step.id)) {
                            await goTo(this.page, step.id);
                        }
                        this.nextStep();
                    };

                default:
                    return async () => console.log('Nieznany krok questa: ', step);
            }
        });
    }

    async fetchQuestStepsFromServer() {
        return [
            { type: "dialogue", npcId: 178339 },
            { type: "skipTalk" },
            { type: "equip", items: ["Łuk młodego łowcy", "Krótkie strzały", "Żelazna tarcza", "Wyszczerbiony miecz", "Uszkodzona różdżka", "Uszkodzony orb", "Wyszczerbiony sztylet"] },
            { type: "dialogue", npcId: 178339 },
            { type: "skipTalk" },
            { type: "attack", name: "Pająk piwniczak" },
            { type: "dialogue", npcId: 178339 },
            { type: "skipTalk" },
            { type: "moveTo", x: 7, y: 20, current: 1456 },
            { type: "dialogue", npcId: 178362 },
            { type: "skipTalk" },
            { type: "dialogue", npcId: 178365 },
            { type: "skipTalk" },
            { type: "dialogue", npcId: 178370 },
            { type: "skipTalk" },
            { type: "dialogue", npcId: 178365 },
            { type: "skipTalk" },
            { type: "useItem", name: "Szkatułka poskromiciela" },
            { type: "dialogue", npcId: 181266 },
            { type: "skipTalk" },
            { type: "dialogue", npcId: 178389 },
            { type: "skipTalk" },
            { type: "equip", items: ["Hełm otwarty", "Zakrzywiony miecz rycerza", "Lekka zbroja płytowa", "Płaszcz adepta", "Różdzka adepta", "Kaftan wędrowca", "Jesionowa kusza"] },
            { type: "moveTo", x: 54, y: 16, current: 707 },
            { type: "fight", minLevel: 5, maxLevel: 5 },
            { type: "dialogue", npcId: 189492 },
            { type: "skipTalk" },
            { type: "moveTo", x: 9, y: 16, current: 1508 },
            { type: "dialogue", npcId: 178389 },
            { type: "skipTalk" },
            { type: "dialogue", npcId: 189809 },
            { type: "skipTalk" },
            { type: "buy", items: ["Mieszanka ziół gojących"] },
            { type: "dialogue", npcId: 178389 },
            { type: "skipTalk" },
            { type: "dialogue", npcId: 178488 },
            { type: "skipTalk" },
            { type: "equip", items: ["Stalowa tarcza", "Orb druida", "Jelenie strzały", "Śmiercionośny szpikulec"] },
            { type: "moveTo", x: 45, y: 6, current: 707 },
            { type: "fight", minLevel: 9, maxLevel: 10 },
            { type: "moveTo", x: 17, y: 30, current: 1540 },
            { type: "dialogue", npcId: 178488 },
            { type: "skipTalk" },
            {
                type: "buy",
                items: ["Buty rycerskie", 'Skórzane łachmany', 'Rękawice ochronne', 'Zamknięty hełm', "Szpada", "Średnia tarcza"]
            },
            { type: "equip", items: ["Buty rycerskie", "Skórzane łachmany", "Rękawice ochronne", "Zamknięty hełm", "Szpada", "Średnia tarcza", "Krótki refleksyjny łuk", "Czerwone strzały", "Szpada", "Nożyk", "Różdżka maga", "Orb letniego błysku"] },
            { type: "dialogue", npcId: 181471 },
            { type: "skipTalk" },
            { type: "dialogue", npcId: 162040 },
            { type: "skipTalk" },
            { type: "moveTo", x: 10, y: 48, current: 707 },
            { type: "fight", minLevel: 10, maxLevel: 12 },
            { type: "moveTo", x: 11, y: 27, current: 1835 },
            { type: "pickup", item: "Rumianek" },
            { type: "moveTo", x: 3, y: 14, current: 3969 },
            { type: "dialogue", npcId: 162040 },
            { type: "skipTalk" },
            { type: "useItem", name: "Szkatułka poskromiciela II" },
            { type: "useItem", name: "Recepta na miksturę uzdrawiającą" },
            { type: "craft", id: 595, name: "Mikstura śmiałków", amount: 1 },
            { type: "dialogue", npcId: 162040 },
            { type: "skipTalk" },
            { type: "moveTo", x: 0, y: 31, current: 707 },
            { type: "dialogue", npcId: 191235 },
            { type: "skipTalk" },
            { type: "dialogue", npcId: 175174 },
            { type: "skipTalk" },
            { type: "barter", id: 51, item: 1616, name: "Unikatowe rękawice śmiałka" },
            { type: "dialogue", npcId: 175174 },
            { type: "skipTalk" },
            { type: "dialogue", npcId: 191235 },
            { type: "skipTalk" },
            {
                type: "buy",
                items: ["Hełm garnczkowy", "Pierścień mocy wody", "Naszyjnik mocy wody", "Zbroja segmentowa", "Wzmocniony miecz półtoraręczny", "Wzmocniona tarcza"]
            },
            {
                type: "equip",
                items: ["Unikatowe rękawice śmiałka", "Hełm garnczkowy", "Pierścień mocy wody", "Naszyjnik mocy wody", "Zbroja segmentowa", "Wzmocniony miecz półtoraręczny", "Wzmocniona tarcza"]
            },
            { type: "moveTo", x: 34, y: 46, current: 368 },
            { type: "fight", minLevel: 14, maxLevel: 16 },
            { type: "moveTo", x: 26, y: 24, current: 968 },
            { type: "dialogue", npcId: 175174 },
            { type: "skipTalk" },
            { type: "barter", id: 51, item: 1629, name: "Wzmocniony napierśnik z wilczej skóry" },
            { type: "dialogue", npcId: 160885 },
            { type: "skipTalk" },
            { type: "moveTo", x: 0, y: 33, current: 368 },
            { type: "dialogue", npcId: 181123 },
            { type: "skipTalk" },
            { type: "pickup", item: "Szałwia" },
            { type: "pickup", item: "Nagietek" },
            { type: "dialogue", npcId: 181123 },
            { type: "clickText", text: "rośliny" },
            { type: "skipTalk" },
            { type: "useItem", name: "Recepta na większą miksturę uzdrawiającą" },
            { type: "craft", id: 596, name: "Większa mikstura śmiałków", amount: 1 },
            { type: "dialogue", npcId: 181123 },
            { type: "clickText", text: "miksturę," },
            { type: "skipTalk" },
            { type: "moveTo", x: 74, y: 21, current: 12 },
            { type: "doItWhile", doItId: "1865", doIt: "Odnajdź komnatę Astratusa.", doItMaps: [3741, 175, 174] },
            { type: "moveTo", x: 34, y: 19, current: 174 },
            { type: "moveTo", x: 3, y: 7, current: 175 },
            { type: "moveTo", x: 3, y: 3, current: 3741 },
            { type: "attack", name: "Czarnoksiężnik Astratus" },
            { type: "moveTo", x: 11, y: 14, current: 4712 },
            { type: "goTo", id: 12 },
            { type: "dialogue", npcId: 181123 },
            { type: "clickText", text: "Astratusa!" },
            { type: "skipTalk" },
            { type: "goTo", id: 368 },
            { type: "dialogue", npcId: 21946 },
            { type: "skipTalk" },
            { type: "fight", minLevel: 21, maxLevel: 21 },
            { type: "dialogue", npcId: 254615 },
            { type: "skipTalk" },
            { type: "moveTo", x: 19, y: 18, current: 1083 },
            { type: "attack", name: "Ranna Mushita" },
            { type: "useItem", name: "Szkatułka poskromiciela III" },
            { type: "moveTo", x: 34, y: 37, current: 1088 },
            { type: "dialogue", npcId: 254615 },
            { type: "skipTalk" },
            { type: "dialogue", npcId: 21977 },
            { type: "clickText", text: "Muszę" },
            { type: "skipTalk" },
            { type: "goTo", id: 12 },
            { type: "dialogue", npcId: 181123 },
            { type: "clickText", text: "Nie" },
            { type: "skipTalk" },
        ];
    }

    async executeStep(step, isDialoguesOpen) {
        if (this.steps[step]) {
            await this.steps[step](isDialoguesOpen);
        }
    }
}

module.exports = QuestHandler;