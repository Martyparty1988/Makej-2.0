// Integrace oprav UI bugů do hlavního souboru app.js

// Importování oprav grafů
document.addEventListener('DOMContentLoaded', function() {
    // Načtení externích CSS souborů
    const compactLayoutLink = document.createElement('link');
    compactLayoutLink.rel = 'stylesheet';
    compactLayoutLink.href = 'compact-layout.css';
    document.head.appendChild(compactLayoutLink);
    
    // Načtení externích JS souborů
    const chartFixesScript = document.createElement('script');
    chartFixesScript.src = 'chart-fixes.js';
    document.body.appendChild(chartFixesScript);
    
    console.log('UI opravy byly načteny');
});

// Přepsání původní funkce loadDebts, aby se odstranila chybová hláška
window.originalLoadDebts = window.loadDebts;
window.loadDebts = async function() {
    try {
        // Získání všech dluhů
        const debts = await getAllDebts();
        
        // Získání všech plateb
        const payments = await getAllPayments();
        
        // Aktualizace UI
        updateDebtsUI(debts, payments);
        
        // Aktualizace grafu dluhů
        updateDebtChart(debts, payments);
        
        // Aktualizace select elementu pro splátky
        loadDebtsForPaymentForm();
    } catch (error) {
        console.error('Chyba při načítání dluhů:', error);
        // Odstraněna toast hláška, která se zobrazovala i když backend vracel data
        // showNotification('Chyba při načítání dluhů.', 'error');
    }
};

// Zajištění, že grafy se správně načtou
window.addEventListener('load', function() {
    // Kontrola, zda je Chart.js načtený
    if (typeof Chart === 'undefined') {
        console.error('Chart.js není načtený. Grafy nebudou vykresleny.');
        
        // Pokus o načtení Chart.js
        const chartScript = document.createElement('script');
        chartScript.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        chartScript.onload = function() {
            console.log('Chart.js byl úspěšně načten.');
            
            // Aktualizace grafů po načtení Chart.js
            if (window.updateDebtChart && window.updateFinanceChart) {
                window.loadDebts();
                window.updateFinanceSummary();
            }
        };
        document.body.appendChild(chartScript);
    }
});
