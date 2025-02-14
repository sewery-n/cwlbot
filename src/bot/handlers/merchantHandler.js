const { move, talkToNpc, clickText, goTo } = require("./movementHandler");
const { sleep, getRandomDelay } = require('../../shared/utils/time');
const { getData, getReachableMobs, getClosestNpc } = require("./mapHandler");
const InventoryHandler = require("./InventoryHandler");


class MerchantHandler extends InventoryHandler {
    constructor(page, account, settings, ws, globalpath, handleGlobalPath) {
        super(page);
        this.page = page;
        this.settings = settings;
        this.ws = ws;
        this.account = account;
        this.steps = [];
        this.globalpath = globalpath;
        this.currentStep = this.settings.selling_settings.selling_step;
        this.handleGlobalPath = handleGlobalPath;
    }

    async handleMerchant() {
        if (!this.settings.selling_settings) return;
        await this.executeStep(this.currentStep);
    }

    async isDialoguesOpen() {
        return this.page.evaluate(() => Engine.dialogue);
    }

    updateSettings(newSettings, globalpath) {
        this.settings = newSettings;
        this.globalpath = globalpath;
    }

    async nextStep() {
        this.currentStep++;
        this.settings.selling_settings.selling_step = this.currentStep;
        this.ws.send(JSON.stringify({
            action: "sellingStep",
            charID: this.account.char_id,
            step: String(this.currentStep)
        }));
    }


    async clearSteps() {
        this.currentStep = 0;
        this.settings.selling_settings.selling_step = this.currentStep;
        this.ws.send(JSON.stringify({
            action: "setSelling",
            charID: this.account.char_id,
            active: false
        }));
        this.ws.send(JSON.stringify({
            action: "sellingStep",
            charID: this.account.char_id,
            step: "0"
        }));
    }

    async findAndUseTeleport(id) {
        const teleport = await this.page.evaluate(id => {
            return Engine.items.fetchLocationItems("g").find(item => Number(item._cachedStats.teleport.split(',')[0]) === Number(id))?.id;
        }, id);

        if (!teleport) return false;
        await this.page.click(`.item-id-${teleport}`, { count: 2 });
        return true;
    }

    async chooseBestPotion() {
        const maxHp = await this.page.evaluate(() => Engine.hero.d.warrior_stats.maxhp);
        const targetHp = maxHp * 0.25;
        const availablePotions = {
            41876: 200,
            41877: 250,
            41878: 500,
            41879: 1000,
            41880: 2000,
            41881: 5000,
            41882: 10000,
            41883: 20000,
            41884: 30000,
            41885: 40000,
            41886: 50000,
            41887: 60000,
            41888: 70000,
            41889: 80000,
            41890: 90000,
            41891: 100000,
            41892: 125000,
            41893: 175000,
            41894: 200000
        };

        return Object.keys(availablePotions).reduce((bestPotion, potionId) => {
            const healAmount = availablePotions[potionId];
            return Math.abs(targetHp - healAmount) < Math.abs(targetHp - availablePotions[bestPotion]) ? potionId : bestPotion;
        }, Object.keys(availablePotions)[0]);
    }

    async buyItemsIfNeeded(items) {
        let shopOpen = await this.page.evaluate(() => document.getElementsByClassName('shop-content').length > 0);
        if (!shopOpen) return false;

        const shopItems = await this.page.evaluate(() => {
            return Object.values(Engine.shop.items).map(item => ({ id: item.id, name: item.name }));
        });

        const missingItems = (await Promise.all(
            items.map(async name => ({
                name,
                hasItem: await this.hasItemInInventory(name)
            }))
        )).filter(item => !item.hasItem);

        if (missingItems.length === 0) return true;

        for (const item of missingItems) {
            let itemNames = Array.isArray(item.name) ? item.name : [item.name];
            for (const name of itemNames) {
                const shopItem = shopItems.find(shopItem => shopItem.name === name);
                if (shopItem) {
                    await this.page.click(`.item-id-${shopItem.id}`);
                    await sleep(getRandomDelay(150, 200));
                    break;
                }
            }
        }

        const acceptButton = `body > div.game-window-positioner.default-cursor.eq-column-size-1.chat-size-1 > div.alerts-layer.layer > div.border-window.ui-draggable.window-on-peak > div.content > div.inner-content > div > div.shop-content.normal-shop-zl > div.finalize-button.btns-spacing > div > div.label`;
        await this.page.click(acceptButton);

        await sleep(getRandomDelay(1000, 1500));

        const updatedItems = await Promise.all(
            items.map(async name => ({
                name,
                hasItem: await this.hasItemInInventory(name)
            }))
        );

        if (updatedItems.every(item => item.hasItem)) {
            const closeButton = `body > div > div.alerts-layer.layer > div.border-window.ui-draggable.window-on-peak > div.close-button-corner-decor > button`;
            await this.page.click(closeButton);
            return true;
        } else {
            return false;
        }
    }

    async getPotionsAmount() {
        return await this.page.evaluate(() => {
            return Object.values(Engine.items.fetchLocationItems("g").filter(item => item.stat.includes('leczy'))).length;
        });
    }

    async executeStep(step) {
        try {
            const steps = [
                async () => {
                    if (!this.settings.selling_settings.buying_mode || !this.settings.selling_settings.selling_mode) return;
                    const dead = await this.page.evaluate(() => Engine.dead);
                    if (dead) return;
                    const space = await this.getFreeSpace();
                    console.log(space);
                    const potions = await this.getPotionsAmount();
                    if (space == 0 || potions == 0) {
                        this.ws.send(JSON.stringify({ action: "setSelling", charID: this.account.char_id, active: true }));
                        await this.nextStep();
                    }
                },

                async () => {
                    if (!this.settings.selling_settings.active) return;
                    const currentMap = await this.page.evaluate(() => Engine.map.d.id);
                    if (currentMap !== Number(this.settings.selling_settings.seller_idMap)) {
                        await this.handleGlobalPath(currentMap, Number(this.settings.selling_settings.seller_idMap));
                    } else {
                        await this.nextStep();
                    }
                },

                async () => {
                    if (!this.settings.selling_settings.active) return;
                    if (!(await this.page.evaluate(() => Engine.dialogue))) {
                        await talkToNpc(this.page, Number(this.settings.selling_settings.seller_id));
                    } else {
                        await this.nextStep();
                    }
                },
                async () => {
                    if (!this.settings.selling_settings.active) return;
                    const isShopOpen = await this.page.evaluate(() => document.querySelector('.shop-content'));
                    if (isShopOpen) {
                        await this.nextStep();
                    } else {
                        const binds = this.settings.selling_settings.seller_dialogs;
                        for (const bind of binds) {
                            await this.page.keyboard.press(bind);
                            await sleep(getRandomDelay(200, 400));
                        }
                    }
                },
                // Krok 5
                async () => {
                    if (!this.settings.selling_settings.active) return;

                    const isShopOpen = await this.page.evaluate(() =>
                        document.querySelector('.shop-content') !== null
                    );

                    if (isShopOpen) {

                        const itemsToSell = await this.page.evaluate(() => {
                            const nonSellable = ['permbound', 'soulbound', 'unique', 'heroic', 'legendary'];
                            const sellableClasses = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 23, 29];
                            return Object.values(Engine.items.fetchLocationItems('g')).filter(item =>
                                sellableClasses.includes(item.cl) && !nonSellable.some(stat => item.stat.includes(stat))
                            ).length;
                        });


                        if (itemsToSell > 0) {
                            const shopButtons = await this.page.$$('div.great-merchamp.btns-spacing > div > div.label');

                            if (shopButtons.length < 3) {
                                return;
                            }

                            const acceptButton = `div.finalize-button.btns-spacing > div > div.label`;

                            for (let i = 0; i < 3; i++) {
                                for (let j = 0; j < 3; j++) {
                                    if (!shopButtons[i]) continue;

                                    await shopButtons[i].click();
                                    await sleep(getRandomDelay(499, 899));

                                    await this.page.click(acceptButton);
                                    await sleep(getRandomDelay(499, 899));
                                }
                            }
                        }

                        if ((this.settings.selling_settings.seller_id !== this.settings.selling_settings.buyer_id) && this.settings.selling_settings.buying_mode) {
                            await this.page.keyboard.press('Escape');
                            await sleep(getRandomDelay(499, 899));
                            await this.nextStep();
                            return;
                        }

                        if (this.settings.selling_settings.buying_mode) {
                            const acceptButton = `div.finalize-button.btns-spacing > div > div.label`;
                            let potions = await this.getPotionsAmount();
                            if (potions === 0) {
                                const bestPotionId = await this.chooseBestPotion();
                                console.log(`🛍 Kupuję mikstury ID: ${bestPotionId}`);
                                await this.page.click(`.item-id-${bestPotionId}`, { count: 3 * 5 });
                                await this.page.click(acceptButton);
                            }

                            const tpId = Number(this.settings.selling_settings.seller_tpMap);
                            if (tpId === 344) {
                                const haveTp = await this.hasItemInInventory('Zwój teleportacji na Kwieciste Przejście');
                                if (!haveTp) {
                                    await this.page.click(`.item-id-1471`, { count: 1 });
                                    await this.page.click(acceptButton);
                                }
                            }

                            await this.page.keyboard.press('Escape');
                            await sleep(getRandomDelay(399, 699));

                            potions = await this.getPotionsAmount();
                            if (potions > 0) {
                                await this.clearSteps();
                            }
                        }
                    } else console.log("❌ Sklep nie został otwarty, coś poszło nie tak");
                },

                async () => {
                    if (!this.settings.selling_settings.active) return;
                    if (this.settings.selling_settings.buying_mode) {
                        const currentMap = await this.page.evaluate(() => Engine.map.d.id);
                        if (currentMap != Number(this.settings.selling_settings.buyer_idMap)) {
                            await this.handleGlobalPath(currentMap, this.settings.selling_settings.buyer_idMap);
                        } else {
                            await this.nextStep();
                        }
                    }
                },

                async () => {
                    if (!this.settings.selling_settings.active) return;
                    if (!(await this.page.evaluate(() => Engine.dialogue))) {
                        await talkToNpc(this.page, Number(this.settings.selling_settings.buyer_id));
                    } else {
                        await this.nextStep();
                    }
                },

                async () => {
                    if (!this.settings.selling_settings.active) return;
                    const isShopOpen = await this.page.evaluate(() => document.querySelector('.shop-content'));
                    if (isShopOpen) {
                        await this.nextStep();
                    } else {
                        const binds = this.settings.selling_settings.buyer_dialogs;
                        for (const bind of binds) {
                            await this.page.keyboard.press(bind);
                            await sleep(getRandomDelay(200, 400));
                        }
                    }
                },

                async () => {
                    if (!this.settings.selling_settings.active) return;
                    const isShopOpen = await this.page.evaluate(() => document.getElementsByClassName('shop-content').length > 0);
                    if (isShopOpen) {

                        let potions = await this.getPotionsAmount();
                        if (potions == 0) {
                            const acceptButton = `div.finalize-button.btns-spacing > div > div.label`;
                            const bestPotionId = await this.chooseBestPotion();
                            console.log(`🛍 Kupuję mikstury ID: ${bestPotionId}`);
                            await this.page.click(`.item-id-${bestPotionId}`, { count: 15 });
                            await sleep(getRandomDelay(399, 699));
                            await this.page.click(acceptButton);
                        }

                        const tpId = Number(this.settings.selling_settings.seller_tpMap);
                        if (tpId === 344) {
                            const haveTp = await this.hasItemInInventory('Zwój teleportacji na Kwieciste Przejście');
                            if (!haveTp) {
                                await this.page.click(`.item-id-1471`, { count: 1 });
                                await this.page.click(acceptButton);
                            }
                        }

                        await this.page.keyboard.press('Escape');
                        await sleep(getRandomDelay(399, 699));

                        potions = await this.getPotionsAmount();
                        if (potions > 0) {
                            console.log("✅ Zakupy zakończone, czyszczę kroki");
                            await this.clearSteps();
                        }

                    }
                }
            ];

            if (steps[step]) await steps[step]();
        } catch (error) {
            console.error('Błąd w executeStep: ', error);
        }
    }
}

module.exports = MerchantHandler;