(function() {
    if (window.Telegram && Telegram.WebApp) {
        Telegram.WebApp.ready();
        Telegram.WebApp.expand();
        
        Telegram.WebApp.MainButton.setText('Tutup').onClick(function() {
            Telegram.WebApp.close();
        });
    }
    
    function detectTelegram() {
        return navigator.userAgent.includes('Telegram') || 
               window.location.href.includes('tgWebApp') ||
               (window.Telegram && Telegram.WebApp);
    }
    
    const originalFetch = window.fetch;
    window.fetch = function(url, options = {}) {
        if (detectTelegram()) {
            options.credentials = 'include';
            options.mode = 'cors';
            options.headers = {
                ...options.headers,
                'X-Telegram-WebApp': 'true',
                'X-Requested-With': 'XMLHttpRequest'
            };
        }
        return originalFetch(url, options);
    };
    
    document.addEventListener('DOMContentLoaded', function() {
        if (detectTelegram()) {
            document.body.classList.add('telegram-mode');
            
            const style = document.createElement('style');
            style.textContent = `
                .telegram-mode .header {
                    padding-top: env(safe-area-inset-top);
                }
                .telegram-mode .input-container {
                    padding-bottom: calc(14px + env(safe-area-inset-bottom));
                }
            `;
            document.head.appendChild(style);
        }
    });
})();