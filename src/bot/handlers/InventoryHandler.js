class InventoryHandler {
    constructor(page) {
        this.page = page;
    }

    async getFreeSpace() {
        return await this.page.evaluate(() => {
            return Engine.bags[0][0] - Engine.bags[0][1] + Engine.bags[1][0] - Engine.bags[1][1] + Engine.bags[2][0] - Engine.bags[2][1];
        });
    }

    async getPotionsAmount() {
        return await this.page.evaluate(() => {
            return Engine.items.fetchLocationItems("g").filter(item => item._cachedStats.leczy);
        });
    }

    async hasItemInInventory(name) {
        return await this.page.evaluate(name => {
            return Engine.items.fetchLocationItems('g').some(item => item.name === name);
        }, name);
    }
}

module.exports = InventoryHandler;