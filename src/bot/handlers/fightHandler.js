const { sleep, getRandomDelay } = require('../../shared/utils/time');


const closeFight = async (page) => {
    let isClosed = await page.evaluate(() => Engine.battle.endBattleForMe && Engine.battle.show);
    if (!isClosed) {
        await page.keyboard.press('Z');
        await sleep(getRandomDelay(50, 80));
    }
    return;
};

const autoFight = async (page) => {
    let isAuto = await page.evaluate(() => Engine.battle.isAuto)
    if (!isAuto) {
        await page.keyboard.press('F');
        await sleep(getRandomDelay(50, 80));
    }
    return;
}

module.exports = { autoFight, closeFight };

