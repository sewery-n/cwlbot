const { machineIdSync } = require('node-machine-id');
const axios = require('axios');
const AccountProcess = require('./services/processAccount');

module.exports = {
    startBot: async function (account) {
        try {
            const hwid = machineIdSync();
            const response = await axios.post('http://srv27.mikr.us:40077/check-hwid', { hwid });
            if(response.data.license) {
                new AccountProcess(account);
                return;
            }
        } catch (error) {
            console.log(error);
        }
    }
}