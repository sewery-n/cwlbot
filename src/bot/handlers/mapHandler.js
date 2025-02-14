const PF = require('pathfinding');
const getData = async (page) => {
    await page.waitForFunction(() => window.Engine !== undefined && Engine.allInit);
    const data = {
        collisions: await page.evaluate(() => {
            const { x, y } = Engine.map.d;
            
            const collisions = Array.from({ length: y }, (_, row) =>
                Array.from({ length: x }, (_, col) => {
                    const isBlocked = Engine.map.col.check(col, row) ? 1 : 0;
                    return isBlocked;
                })
            );
            return collisions;
        }),
        hero: {
            x: await page.evaluate(() => Engine.hero.d.x),
            y: await page.evaluate(() => Engine.hero.d.y),
            stop: await page.evaluate(() => Engine.hero.stop)
        },
        npcs: await page.evaluate(() =>
            Engine.npcs.getDrawableList()
                .filter(obj => obj.d)
                .filter(npc => npc.d.type === 2 || npc.d.type === 3)
                .map(npc => ({
                    id: npc.d.id,
                    type: npc.d.type,
                    lvl: npc.d.lvl,
                    position: { x: npc.d.x, y: npc.d.y },
                    grp: npc.d.grp ? npc.d.grp : null,
                    wt: npc.d.wt
                }))
        ),
        map: {
            x: await page.evaluate(() => Engine.map.d.x),
            y: await page.evaluate(() => Engine.map.d.y)
        }
    };
    return data;
};

const searchPath = async (startX, startY, goalX, goalY, data) => {
    // Sprawdzenie, czy współrzędne docelowe są w zakresie tablicy
    if (!Array.isArray(data.collisions) || !data.collisions[goalY] || typeof data.collisions[goalY][goalX] === 'undefined') {
        console.error(`Invalid collision data for coordinates (${goalX}, ${goalY})`);
        return [];
    }

    // Jeśli cel jest przeszkodą, tymczasowo go odblokowujemy
    const originalValue = data.collisions[goalY][goalX];
    if (originalValue === 1) {
        data.collisions[goalY][goalX] = 0;
    }

    try {
        const grid = new PF.Grid(data.collisions);
        const finder = new PF.AStarFinder();
        const path = finder.findPath(startX, startY, goalX, goalY, grid);

        return path;
    } catch (error) {
        console.error('Error while finding path:', error);
        return [];
    } finally {
        // Przywrócenie oryginalnej wartości w collisions (żeby nie zmieniać danych wejściowych)
        if (originalValue === 1) {
            data.collisions[goalY][goalX] = 1;
        }
    }
};

const getReachableMobs = async (page, hero, npcs) => {
    let data = await getData(page);
    if (!Array.isArray(npcs)) {
        throw new TypeError('Expected npcs to be an array');
    }

    const reachableMobs = await Promise.all(
        npcs.map(async (npc) => {
            const path = await searchPath(hero.x, hero.y, npc.position.x, npc.position.y, data);
            return path.length > 0 ? { npc, pathLength: path.length } : null;
        })
    );

    return reachableMobs.filter(Boolean);
};

const getAvailableEntries = async (page) => {
    const entries = await page.evaluate(() => {
        const gateways = Engine.map.getGateways();
        return Object.keys(gateways.townnames).map(id => {
            const [gateway] = gateways.getGtwById(id);
            return {
                id,
                name: gateways.townnames[id],
                x: gateway.rx,
                y: gateway.ry
            };
        });
    });
    return entries;
}

const getClosestNpc = async (page, hero, npcs) => {
    if (!Array.isArray(npcs)) {
        throw new TypeError('Expected npcs to be an array');
    }


    const targetGroupId = npcs.find(npc => npc.grp)?.grp;
    const reachableMobs = await getReachableMobs(page, hero, npcs);


    return reachableMobs.reduce((closest, { npc, pathLength }) => {
        if (closest === null || pathLength < closest.pathLength) {
            return { npc, pathLength }; 
        }
        return closest;
    }, null)?.npc;
};

const isReachable = async (page, hero, target) => {
    const data = await getData(page);
    const path = aStar(hero, target.position, data.collisions);

    return path.length > 0;
}

const manhattanDistance = (start, end) => {
    return Math.abs(start.x - end.x) + Math.abs(start.y - end.y);
}

module.exports = { 
    getData, 
    getClosestNpc, 
    getReachableMobs,
    searchPath,
    getAvailableEntries
};