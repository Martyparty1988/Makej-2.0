// Načtení dluhů a zobrazení v UI
async function loadDebts() {
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
}

// Aktualizace grafu dluhů
function updateDebtChart(debts, payments) {
    const chartCanvas = document.getElementById('debt-chart');
    
    if (!chartCanvas) return;
    
    // Výpočet celkových dluhů podle měny
    const totalDebtsByCurrency = {};
    const totalPaidByCurrency = {};
    
    debts.forEach(debt => {
        if (!totalDebtsByCurrency[debt.currency]) {
            totalDebtsByCurrency[debt.currency] = 0;
            totalPaidByCurrency[debt.currency] = 0;
        }
        
        totalDebtsByCurrency[debt.currency] += debt.amount;
        
        // Výpočet splacené částky
        const debtPayments = payments.filter(payment => payment.debtId === debt.id);
        const totalPaid = debtPayments.reduce((sum, payment) => sum + payment.amount, 0);
        
        totalPaidByCurrency[debt.currency] += totalPaid;
    });
    
    // Příprava dat pro graf
    const currencies = Object.keys(totalDebtsByCurrency);
    const totalDebtsData = currencies.map(currency => totalDebtsByCurrency[currency]);
    const totalPaidData = currencies.map(currency => totalPaidByCurrency[currency]);
    const remainingData = currencies.map((currency, index) => totalDebtsData[index] - totalPaidData[index]);
    
    // Kontrola, zda již existuje graf
    if (chartCanvas._chart) {
        chartCanvas._chart.destroy();
    }
    
    // Vytvoření grafu
    const ctx = chartCanvas.getContext('2d');
    
    // Zajištění, že Chart.js je načtený
    if (typeof Chart !== 'undefined') {
        chartCanvas._chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: currencies,
                datasets: [
                    {
                        label: 'Zbývá splatit',
                        data: remainingData,
                        backgroundColor: 'rgba(220, 53, 69, 0.5)',
                        borderColor: 'rgba(220, 53, 69, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Splaceno',
                        data: totalPaidData,
                        backgroundColor: 'rgba(40, 167, 69, 0.5)',
                        borderColor: 'rgba(40, 167, 69, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value.toLocaleString();
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const currency = context.label;
                                return context.dataset.label + ': ' + context.raw.toLocaleString() + ' ' + currency;
                            }
                        }
                    }
                }
            }
        });
    } else {
        console.error('Chart.js není načtený. Graf dluhů nemůže být vykreslen.');
    }
}

// Aktualizace finančního grafu
function updateFinanceChart(income, expenses) {
    const chartCanvas = document.getElementById('finance-chart');
    
    if (!chartCanvas) return;
    
    // Kontrola, zda již existuje graf
    if (chartCanvas._chart) {
        chartCanvas._chart.destroy();
    }
    
    // Vytvoření grafu
    const ctx = chartCanvas.getContext('2d');
    
    // Zajištění, že Chart.js je načtený
    if (typeof Chart !== 'undefined') {
        chartCanvas._chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Příjmy', 'Výdaje'],
                datasets: [{
                    label: 'CZK',
                    data: [income, expenses],
                    backgroundColor: [
                        'rgba(40, 167, 69, 0.5)',
                        'rgba(220, 53, 69, 0.5)'
                    ],
                    borderColor: [
                        'rgba(40, 167, 69, 1)',
                        'rgba(220, 53, 69, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value.toLocaleString() + ' Kč';
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + context.raw.toLocaleString() + ' Kč';
                            }
                        }
                    }
                }
            }
        });
    } else {
        console.error('Chart.js není načtený. Finanční graf nemůže být vykreslen.');
    }
}
