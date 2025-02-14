const { sleep, getRandomDelay } = require('../../shared/utils/time');

let isResolvingCaptcha = false;

const getAnswers = async (page, img) => {
    try {
        const response = await fetch('http://157.173.107.251:30069/solve', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ image: img })
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        const answers = data.answer || [];

        await page.evaluate((ans) => {
            ans.forEach(answ => {
                const randomTimeout = Math.floor(Math.random() * 3000) + 1000;
                setTimeout(() => {
                    Engine.captcha.addSelectedAnswer(answ);
                }, randomTimeout);
            });
        }, answers);

        await page.evaluate((ans) => {
            const confirmCaptchaInterval = setInterval(() => {
                const sortedAnswers = [...ans].sort();
                const sortedSelectedAnswers = [...Engine.captcha.getSelectedAnswer()].sort();
                if (JSON.stringify(sortedAnswers) === JSON.stringify(sortedSelectedAnswers)) {
                    Engine.captcha.confirmOnClick({ isTrusted: true });
                    clearInterval(confirmCaptchaInterval);
                }
            }, Math.floor(Math.random() * 3000) + 1000);
        }, answers)
        isResolvingCaptcha = false;
        await sleep(getRandomDelay(1500, 3000));
    } catch (error) {
        console.log(error);
    }
};

const runAC = async(page) => {
    let lock = await page.evaluate(() => !Engine.lock.list.includes('captcha'));
    if(isResolvingCaptcha || lock){
        return;
    }
    const captchaImage = await page.evaluate(() => {
        return document.querySelector('.captcha__image img').getAttribute('src');
    });
    isResolvingCaptcha = true;
    await getAnswers(page, captchaImage);
} 

module.exports = { runAC };