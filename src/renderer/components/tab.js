document.querySelectorAll('.tablist button').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.tablist button').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        const tabId = button.id.replace('tab-', '');
        document.querySelectorAll('.panels > div').forEach(panel => {
            if(panel.id === 'panel-discord'){
                
            }
            else if (panel.id === 'panel-' + tabId) {
                panel.style.display = 'block';
            } else {
                panel.style.display = 'none';
            }
        });
    });
});