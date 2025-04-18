// Konfigurační soubor pro načítání souborů z online úložiště
const CONFIG = {
    // Základní URL pro CDN nebo GitHub Pages
    // Změňte tuto URL na vaše vlastní úložiště
    baseUrl: 'https://cdn.jsdelivr.net/gh/Martyparty1988/Makej-2.0@main/',
    
    // Seznam souborů, které se mají načíst z online úložiště
    files: {
        css: [
            'compact-layout.css',
            'responsive-iphone.css'
        ],
        js: [
            'chart-fixes.js',
            'navigation-timer-fixes.js',
            'ui-fixes.js'
        ]
    },
    
    // Funkce pro načtení všech souborů
    loadAllFiles: function() {
        // Načtení CSS souborů
        this.files.css.forEach(file => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = this.baseUrl + file;
            document.head.appendChild(link);
            console.log(`Načten CSS soubor: ${file}`);
        });
        
        // Načtení JS souborů
        this.files.js.forEach(file => {
            const script = document.createElement('script');
            script.src = this.baseUrl + file;
            script.defer = true;
            document.body.appendChild(script);
            console.log(`Načten JS soubor: ${file}`);
        });
    },
    
    // Inicializace
    init: function() {
        // Kontrola, zda je aplikace online
        if (navigator.onLine) {
            this.loadAllFiles();
            console.log('Soubory načteny z online úložiště');
        } else {
            console.warn('Aplikace je offline, používají se lokální soubory');
            // Zde můžete přidat kód pro načtení lokálních souborů
        }
    }
};

// Spuštění načítání souborů po načtení DOMu
document.addEventListener('DOMContentLoaded', function() {
    CONFIG.init();
});
