const log = (message, type = 'info') => {
    const timestamp = new Date().toISOString();
    console[type === 'error' ? 'error' : 'log'](`[${timestamp}] ${message}`);
};

module.exports = { log };