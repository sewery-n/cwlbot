const { sleep, getRandomDelay } = require('../../shared/utils/time');

const logInAccount = async (page, credentials) => {
    await sleep(getRandomDelay(2000, 6000));
    await page.goto('https://margonem.pl');
    await sleep(getRandomDelay(2000, 8000));

    const newPlayer = await page.$('body > div.wrapper > div.landing-body > div > p:nth-child(7)');
    if (newPlayer) {
        await newPlayer.click();
        await sleep(getRandomDelay(500, 1500));
    }
    await sleep(2000);

    const isLogged = await page.$('#js-login-box > div.box-enter > div > div');
    if (!isLogged) {
        await page.waitForSelector('#login-input');
        await page.type('#login-input', credentials.login);
        await sleep(getRandomDelay(2000, 4000));
        await page.type('#login-password', credentials.password);
        await sleep(getRandomDelay(2000, 4000));

        await page.click('#js-login-btn');
        await page.waitForNavigation();
    }

    const closeGameInfo = await page.$('.close-game-info');
    if (closeGameInfo) {
        await closeGameInfo.click();
        await sleep(getRandomDelay(500, 1500));
    }

    await page.waitForSelector('#js-login-box > div.box-enter > div > div');
    await sleep(getRandomDelay(2000, 4000));
    await page.click('.select-char');
    await page.waitForSelector(`.charc[data-id="${credentials.char_id}"]`);
    await page.click(`.charc[data-id="${credentials.char_id}"]`);
    await sleep(getRandomDelay(2000, 4000));
    await page.click('#js-login-box > div.box-enter > div > div');
}

module.exports = { logInAccount };