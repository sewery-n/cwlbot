const { getData, searchPath, getReachableMobs } = require('./mapHandler');
const { sleep, getRandomDelay } = require('../../shared/utils/time');

const move = async (page, targetX, targetY, changingMap) => {
    await page.waitForFunction(() => window.Engine !== undefined && Engine.allInit);
    let data = await getData(page);
    const start = {
        x: data.hero.x,
        y: data.hero.y
    };

    const goal = { x: targetX, y: targetY };

    let path = await searchPath(start.x, start.y, goal.x, goal.y, data);

    if (!path || path.length === 0) {
        return;
    }

    if (!changingMap) path.pop();

    let lastCheckedPosition = { x: start.x, y: start.y };

    const moveStep = async (index) => {
        if (index >= path.length) {
            return;
        }
        let isDead = await page.evaluate(() => {
            return typeof Engine !== 'undefined' && Engine.dead;
        });
        if (isDead) {
            return;
        }
        const currentStep = { x: path[index][0], y: path[index][1] };
        const dx = currentStep.x - lastCheckedPosition.x;
        const dy = currentStep.y - lastCheckedPosition.y;
        //console.log(`Próba ruchu: dx=${dx}, dy=${dy}`);
        //console.log(`Kierunek: ${dx > 0 ? 'Prawo' : dx < 0 ? 'Lewo' : ''} ${dy > 0 ? 'Dół' : dy < 0 ? 'Góra' : ''}`);
        if (dx > 0) {
            await page.keyboard.down('D');
            await sleep(getRandomDelay(30, 50));
            await page.keyboard.up('D');
        } else if (dx < 0) {
            await page.keyboard.down('A');
            await sleep(getRandomDelay(30, 50));
            await page.keyboard.up('A');
        }

        if (dy > 0) {
            await page.keyboard.down('S');
            await sleep(getRandomDelay(30, 50));
            await page.keyboard.up('S');
        } else if (dy < 0) {
            await page.keyboard.down('W');
            await sleep(getRandomDelay(30, 50));
            await page.keyboard.up('W');
        }

        let actualPos = {
            x: await page.evaluate(() => Engine.hero.d.x),
            y: await page.evaluate(() => Engine.hero.d.y)
        }

        if (actualPos.x === lastCheckedPosition.x && actualPos.y === lastCheckedPosition.y) {
            const isObstacle = await page.evaluate((x, y) => Engine.map.col.check(x, y), path[index][0], path[index][1]);
            if (isObstacle >= 1 & isObstacle <= 4) {
                await sleep(getRandomDelay(350, 450));
                return;
            }
            path = await searchPath(actualPos.x, actualPos.y, goal.x, goal.y, data);
            if (path.length === 0) {
                return;
            }
        }
        lastCheckedPosition = actualPos;
        await moveStep(1);
    };

    await moveStep(0);
};

const getGateways = async (page) => await page.evaluate(() => Object.keys(Engine.map.getGateways()));

const getGateway = async (page, id) => {
    await page.waitForFunction(() => window.Engine !== undefined && Engine.allInit);
    await page.evaluate((gatewayId) => {
        return Engine.map.getGateways().getGtwById(gatewayId)[0];
    }, id);
}

const goTo = async (page, id) => {
    await page.waitForFunction(() => window.Engine !== undefined && Engine.allInit);

    //Gateway
    const gateway = await page.evaluate((gatewayId) => Engine.map.getGateways().getGtwById(gatewayId)[0], id);
    if (!gateway) {
        return;
    }
    let data = await getData(page);
    let cords = { x: gateway.rx, y: gateway.ry };
    if (cords.x === undefined || cords.y === undefined) {
        return;
    }

    if (data.hero.x === cords.x && data.hero.y === cords.y) {
        const currentMap = await page.evaluate(() => Engine.map.d.id);
        if (currentMap !== id) {
            await page.keyboard.press("P");
            return;
        } else {
            return;
        }
    }

    await move(page, cords.x, cords.y, true);
    await sleep(getRandomDelay(2000, 3000));
    const newMap = await page.evaluate(() => Engine.map.d.id);
    if (newMap !== id) {
        await page.keyboard.press("P");
    }
};

const getNpc = async (page, id) => {
    await page.evaluate((npc) => {
        Engine.npcs.getById(npc).d
    }, id);
}

const talkToNpc = async (page, id) => {
    await page.waitForFunction(() => window.Engine !== undefined && Engine.allInit);
    const target = await page.evaluate((id) => {
        return Engine.npcs.getDrawableList().filter(obj => {
            return obj.d;
        }).filter(npc => npc.d.id == id)
    }, id);
    if (target == undefined) {
        return;
    }
    let cords = {
        x: target[0].rx,
        y: target[0].ry
    };
    const hero = {
        x: await page.evaluate(() => Engine.hero.d.x),
        y: await page.evaluate(() => Engine.hero.d.y)
    }
    console.log(typeof cords.x, typeof hero.x);
    if(Math.abs(hero.x - cords.x) + Math.abs(hero.y - cords.y) <= 1) {
        await page.keyboard.press("R");
        return;
    }
    await move(page, target[0].rx, target[0].ry, true);
};

const clickText = async (page, text) => {
    const isElementFound = await page.evaluate((text) => {
        if (Engine.dialogue) {
            const element = [...document.querySelectorAll('li')].find(li => li.textContent.trim().includes(text.trim()));
            if (element) {
                element.click();
                return true;
            }
        }
        return false;
    }, text);
    return isElementFound;
}


module.exports = { move, goTo, talkToNpc, clickText, searchPath };