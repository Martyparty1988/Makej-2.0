// Globální proměnné a nastavení
let RATES = {
    'maru': 275,
    'marty': 400
};

let DEDUCTION_RATES = {
    'maru': 0.3333, // 1/3
    'marty': 0.5    // 1/2
};

// Inicializace aplikace po načtení dokumentu
document.addEventListener('DOMContentLoaded', function() {
    // Inicializace databáze (IndexedDB)
    initDatabase().then(() => {
        console.log('Databáze inicializována');
        
        // Načtení a zpracování dat
        loadAllData();
        
        // Načtení uložených sazeb a srážek
        loadRatesAndDeductions();
    });

    // Nastavení aktuálního roku v patičce
    document.getElementById('footer-year').textContent = new Date().getFullYear();

    // Inicializace tmavého režimu
    initThemeToggle();

    // Inicializace navigace
    initNavigation();

    // Inicializace časovače
    initTimer();

    // Formulář pro ruční zadání záznamu
    initManualEntryForm();

    // Formulář pro přidání finančního záznamu
    initFinanceForm();

    // Inicializace správy dluhů
    initDebtManagement();

    // Inicializace filtrů a přehledů
    initFilters();

    // Inicializace grafů
    initCharts();

    // Inicializace exportu dat
    initExportFunctions();

    // Inicializace nastavení
    initSettings();

    // Nastavení dnešního data ve formulářích
    setTodaysDate();

    // Inicializace rychlých akcí
    initQuickActions();

    // Kontrola platby nájmu
    checkRentPayment();

    // Inicializace notifikací
    initNotifications();
    
    // Inicializace nastavení sazeb a srážek
    initRatesSettings();
});

// ===== DATABÁZE A PERZISTENCE =====
let db;

async function initDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('WorkTrackerDB', 1);

        request.onupgradeneeded = function(event) {
            db = event.target.result;

            // Work logs store
            if (!db.objectStoreNames.contains('workLogs')) {
                const workLogsStore = db.createObjectStore('workLogs', { keyPath: 'id' });
                workLogsStore.createIndex('person', 'person', { unique: false });
                workLogsStore.createIndex('startTime', 'startTime', { unique: false });
            }

            // Finance records store
            if (!db.objectStoreNames.contains('financeRecords')) {
                const financeStore = db.createObjectStore('financeRecords', { keyPath: 'id' });
                financeStore.createIndex('type', 'type', { unique: false });
                financeStore.createIndex('date', 'date', { unique: false });
            }

            // Categories stores
            if (!db.objectStoreNames.contains('taskCategories')) {
                db.createObjectStore('taskCategories', { keyPath: 'name' });
            }

            if (!db.objectStoreNames.contains('expenseCategories')) {
                db.createObjectStore('expenseCategories', { keyPath: 'name' });
            }

            // Debts store
            if (!db.objectStoreNames.contains('debts')) {
                const debtsStore = db.createObjectStore('debts', { keyPath: 'id' });
                debtsStore.createIndex('person', 'person', { unique: false });
                debtsStore.createIndex('date', 'date', { unique: false });
            }

            // Debt payments store
            if (!db.objectStoreNames.contains('debtPayments')) {
                const paymentsStore = db.createObjectStore('debtPayments', { keyPath: 'id' });
                paymentsStore.createIndex('debtId', 'debtId', { unique: false });
                paymentsStore.createIndex('date', 'date', { unique: false });
            }

            // Settings store
            if (!db.objectStoreNames.contains('settings')) {
                db.createObjectStore('settings', { keyPath: 'key' });
            }

            // Shared budget store
            if (!db.objectStoreNames.contains('sharedBudget')) {
                db.createObjectStore('sharedBudget', { keyPath: 'id', autoIncrement: true });
            }
        };

        request.onsuccess = function(event) {
            db = event.target.result;
            
            // Inicializační data při prvním spuštění
            initializeDefaultData();
            
            resolve();
        };

        request.onerror = function(event) {
            console.error('Chyba při otevírání databáze:', event.target.error);
            reject(event.target.error);
        };
    });
}

async function initializeDefaultData() {
    // Kontrola, zda již existují data
    const settings = await getSettings('initialized');
    if (settings && settings.value) return;

    // Výchozí kategorie úkolů
    const taskCategories = [
        'Wellness', 
        'Příprava vily', 
        'Pracovní hovor', 
        'Marketing', 
        'Administrativa'
    ];
    
    for (const category of taskCategories) {
        await addTaskCategory(category);
    }

    // Výchozí kategorie výdajů
    const expenseCategories = [
        'Nákupy', 
        'Účty', 
        'Nájem', 
        'Doprava', 
        'Zábava', 
        'Jídlo'
    ];
    
    for (const category of expenseCategories) {
        await addExpenseCategory(category);
    }

    // Výchozí nastavení nájmu
    await saveSettings('rentAmount', 24500);
    await saveSettings('rentDay', 1);
    
    // Inicializace společného rozpočtu
    await saveSharedBudget({
        balance: 0,
        lastUpdated: new Date().toISOString()
    });

    // Označení, že byla data inicializována
    await saveSettings('initialized', true);
    await saveSettings('theme', 'light');
    await saveSettings('colorTheme', 'blue');
    
    // Uložení výchozích sazeb a srážek
    await saveSettings('rates', RATES);
    await saveSettings('deductionRates', DEDUCTION_RATES);
}

// Společný rozpočet
async function saveSharedBudget(budgetData) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['sharedBudget'], 'readwrite');
        const store = transaction.objectStore('sharedBudget');
        
        const request = store.put(budgetData);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getSharedBudget() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['sharedBudget'], 'readonly');
        const store = transaction.objectStore('sharedBudget');
        
        const request = store.getAll();
        
        request.onsuccess = () => {
            if (request.result.length > 0) {
                resolve(request.result[0]);
            } else {
                resolve({ balance: 0, lastUpdated: new Date().toISOString() });
            }
        };
        request.onerror = () => reject(request.error);
    });
}

async function updateSharedBudget(amount) {
    const budget = await getSharedBudget();
    budget.balance += amount;
    budget.lastUpdated = new Date().toISOString();
    await saveSharedBudget(budget);
    
    // Aktualizace UI
    const sharedBudgetEl = document.getElementById('shared-budget');
    if (sharedBudgetEl) {
        sharedBudgetEl.textContent = formatCurrency(budget.balance);
    }
    
    // Kontrola splácení dluhů z přebytku v rozpočtu
    if (budget.balance > 0) {
        await checkDebtPayments();
    }
}

// Nastavení
async function saveSettings(key, value) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['settings'], 'readwrite');
        const store = transaction.objectStore('settings');
        
        const request = store.put({ key, value });
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getSettings(key) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['settings'], 'readonly');
        const store = transaction.objectStore('settings');
        
        const request = store.get(key);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Work logs
async function saveWorkLog(workLog) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['workLogs'], 'readwrite');
        const store = transaction.objectStore('workLogs');
        
        const request = store.put(workLog);
        
        request.onsuccess = () => {
            resolve(request.result);
            
            // Aktualizace UI a přidání srážky do společného rozpočtu
            const deductionRate = DEDUCTION_RATES[workLog.person];
            const deduction = Math.round(workLog.earnings * deductionRate);
            
            updateSharedBudget(deduction);
            loadRecentWorkLogs();
            updateTodaySummary();
            loadDeductionsSummary();
        };
        request.onerror = () => reject(request.error);
    });
}

async function updateWorkLog(workLog) {
    // Nejprve získáme starý záznam pro výpočet rozdílu srážky
    const oldWorkLog = await getWorkLog(workLog.id);
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['workLogs'], 'readwrite');
        const store = transaction.objectStore('workLogs');
        
        const request = store.put(workLog);
        
        request.onsuccess = async () => {
            // Výpočet rozdílu srážky mezi starým a novým záznamem
            if (oldWorkLog) {
                const oldDeduction = Math.round(oldWorkLog.earnings * DEDUCTION_RATES[oldWorkLog.person]);
                const newDeduction = Math.round(workLog.earnings * DEDUCTION_RATES[workLog.person]);
                const deductionDifference = newDeduction - oldDeduction;
                
                // Aktualizace společného rozpočtu o rozdíl
                if (deductionDifference !== 0) {
                    await updateSharedBudget(deductionDifference);
                }
            }
            
            // Aktualizace UI
            loadRecentWorkLogs();
            updateTodaySummary();
            loadDeductionsSummary();
            loadWorkLogs();
            
            resolve(request.result);
        };
        request.onerror = () => reject(request.error);
    });
}

async function getWorkLog(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['workLogs'], 'readonly');
        const store = transaction.objectStore('workLogs');
        
        const request = store.get(id);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function deleteWorkLog(id) {
    // Nejprve získáme záznam, abychom mohli odebrat správnou částku ze společného rozpočtu
    const workLog = await getWorkLog(id);
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['workLogs'], 'readwrite');
        const store = transaction.objectStore('workLogs');
        
        const request = store.delete(id);
        
        request.onsuccess = async () => {
            // Odebrat srážku ze společného rozpočtu
            if (workLog) {
                const deduction = Math.round(workLog.earnings * DEDUCTION_RATES[workLog.person]);
                await updateSharedBudget(-deduction);
            }
            
            // Aktualizace UI
            loadRecentWorkLogs();
            updateTodaySummary();
            loadDeductionsSummary();
            loadWorkLogs();
            
            resolve();
        };
        request.onerror = () => reject(request.error);
    });
}

async function getAllWorkLogs(filters = {}) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['workLogs'], 'readonly');
        const store = transaction.objectStore('workLogs');
        
        const request = store.getAll();
        
        request.onsuccess = () => {
            let logs = request.result;
            
            // Aplikace filtrů
            if (filters.person) {
                logs = logs.filter(log => log.person === filters.person);
            }
            
            if (filters.activity) {
                logs = logs.filter(log => log.activity === filters.activity);
            }
            
            if (filters.startDate) {
                const startDate = new Date(filters.startDate);
                startDate.setHours(0, 0, 0, 0);
                logs = logs.filter(log => new Date(log.startTime) >= startDate);
            }
            
            if (filters.endDate) {
                const endDate = new Date(filters.endDate);
                endDate.setHours(23, 59, 59, 999);
                logs = logs.filter(log => new Date(log.startTime) <= endDate);
            }
            
            resolve(logs);
        };
        request.onerror = () => reject(request.error);
    });
}

// Finance records
async function saveFinanceRecord(record) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['financeRecords'], 'readwrite');
        const store = transaction.objectStore('financeRecords');
        
        const request = store.put(record);
        
        request.onsuccess = async () => {
            // Pokud se jedná o výdaj v CZK, odečíst ze společného rozpočtu
            if (record.type === 'expense' && record.currency === 'CZK') {
                await updateSharedBudget(-record.amount);
            }
            
            // Pokud se jedná o příjem v CZK, přičíst do společného rozpočtu
            if (record.type === 'income' && record.currency === 'CZK') {
                await updateSharedBudget(record.amount);
            }
            
            // Aktualizace UI
            loadFinanceRecords();
            updateFinanceSummary();
            
            resolve(request.result);
        };
        request.onerror = () => reject(request.error);
    });
}

async function updateFinanceRecord(record) {
    // Nejprve získáme starý záznam pro výpočet rozdílu
    const oldRecord = await getFinanceRecord(record.id);
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['financeRecords'], 'readwrite');
        const store = transaction.objectStore('financeRecords');
        
        const request = store.put(record);
        
        request.onsuccess = async () => {
            // Výpočet rozdílu mezi starým a novým záznamem
            if (oldRecord && oldRecord.currency === 'CZK') {
                let difference = 0;
                
                // Výpočet rozdílu pro výdaj
                if (oldRecord.type === 'expense' && record.type === 'expense') {
                    difference = oldRecord.amount - record.amount;
                }
                // Výpočet rozdílu pro příjem
                else if (oldRecord.type === 'income' && record.type === 'income') {
                    difference = record.amount - oldRecord.amount;
                }
                // Změna typu z výdaje na příjem
                else if (oldRecord.type === 'expense' && record.type === 'income') {
                    difference = oldRecord.amount + record.amount;
                }
                // Změna typu z příjmu na výdaj
                else if (oldRecord.type === 'income' && record.type === 'expense') {
                    difference = -(oldRecord.amount + record.amount);
                }
                
                // Aktualizace společného rozpočtu o rozdíl
                if (difference !== 0 && record.currency === 'CZK') {
                    await updateSharedBudget(difference);
                }
            }
            
            // Aktualizace UI
            loadFinanceRecords();
            updateFinanceSummary();
            
            resolve(request.result);
        };
        request.onerror = () => reject(request.error);
    });
}

async function getFinanceRecord(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['financeRecords'], 'readonly');
        const store = transaction.objectStore('financeRecords');
        
        const request = store.get(id);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function deleteFinanceRecord(id) {
    // Nejprve získáme záznam, abychom mohli provést správnou úpravu společného rozpočtu
    const record = await getFinanceRecord(id);
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['financeRecords'], 'readwrite');
        const store = transaction.objectStore('financeRecords');
        
        const request = store.delete(id);
        
        request.onsuccess = async () => {
            // Úprava společného rozpočtu
            if (record && record.currency === 'CZK') {
                if (record.type === 'expense') {
                    await updateSharedBudget(record.amount);
                } else if (record.type === 'income') {
                    await updateSharedBudget(-record.amount);
                }
            }
            
            // Aktualizace UI
            loadFinanceRecords();
            updateFinanceSummary();
            
            resolve();
        };
        request.onerror = () => reject(request.error);
    });
}

async function getAllFinanceRecords() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['financeRecords'], 'readonly');
        const store = transaction.objectStore('financeRecords');
        
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Task categories
async function addTaskCategory(name) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['taskCategories'], 'readwrite');
        const store = transaction.objectStore('taskCategories');
        
        const request = store.put({ name });
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function deleteTaskCategory(name) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['taskCategories'], 'readwrite');
        const store = transaction.objectStore('taskCategories');
        
        const request = store.delete(name);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function getAllTaskCategories() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['taskCategories'], 'readonly');
        const store = transaction.objectStore('taskCategories');
        
        const request = store.getAll();
        
        request.onsuccess = () => {
            const categories = request.result.map(item => item.name);
            resolve(categories);
        };
        request.onerror = () => reject(request.error);
    });
}

// Expense categories
async function addExpenseCategory(name) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['expenseCategories'], 'readwrite');
        const store = transaction.objectStore('expenseCategories');
        
        const request = store.put({ name });
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function deleteExpenseCategory(name) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['expenseCategories'], 'readwrite');
        const store = transaction.objectStore('expenseCategories');
        
        const request = store.delete(name);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function getAllExpenseCategories() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['expenseCategories'], 'readonly');
        const store = transaction.objectStore('expenseCategories');
        
        const request = store.getAll();
        
        request.onsuccess = () => {
            const categories = request.result.map(item => item.name);
            resolve(categories);
        };
        request.onerror = () => reject(request.error);
    });
}

// Debts
async function saveDebt(debt) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['debts'], 'readwrite');
        const store = transaction.objectStore('debts');
        
        const request = store.put(debt);
        
        request.onsuccess = () => {
            resolve(request.result);
            loadDebts();
            loadDebtsForPaymentForm();
        };
        request.onerror = () => reject(request.error);
    });
}

async function updateDebt(debt) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['debts'], 'readwrite');
        const store = transaction.objectStore('debts');
        
        const request = store.put(debt);
        
        request.onsuccess = () => {
            resolve(request.result);
            loadDebts();
            loadDebtsForPaymentForm();
        };
        request.onerror = () => reject(request.error);
    });
}

async function getDebt(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['debts'], 'readonly');
        const store = transaction.objectStore('debts');
        
        const request = store.get(id);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function deleteDebt(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['debts', 'debtPayments'], 'readwrite');
        const debtStore = transaction.objectStore('debts');
        const paymentStore = transaction.objectStore('debtPayments');
        const paymentIndex = paymentStore.index('debtId');
        
        // Nejprve smazat dluh
        const debtRequest = debtStore.delete(id);
        
        debtRequest.onsuccess = () => {
            // Poté získat a smazat všechny související platby
            const paymentRequest = paymentIndex.getAllKeys(id);
            
            paymentRequest.onsuccess = () => {
                const paymentIds = paymentRequest.result;
                let deletedCount = 0;
                
                if (paymentIds.length === 0) {
                    resolve();
                    loadDebts();
                    loadDebtsForPaymentForm();
                    return;
                }
                
                paymentIds.forEach(paymentId => {
                    const deleteRequest = paymentStore.delete(paymentId);
                    
                    deleteRequest.onsuccess = () => {
                        deletedCount++;
                        if (deletedCount === paymentIds.length) {
                            resolve();
                            loadDebts();
                            loadDebtsForPaymentForm();
                        }
                    };
                    
                    deleteRequest.onerror = () => reject(deleteRequest.error);
                });
            };
            
            paymentRequest.onerror = () => reject(paymentRequest.error);
        };
        
        debtRequest.onerror = () => reject(debtRequest.error);
    });
}

async function getAllDebts() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['debts'], 'readonly');
        const store = transaction.objectStore('debts');
        
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Debt payments
async function savePayment(payment) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['debtPayments'], 'readwrite');
        const store = transaction.objectStore('debtPayments');
        
        const request = store.put(payment);
        
        request.onsuccess = () => {
            resolve(request.result);
            loadDebts();
            loadDebtsForPaymentForm();
        };
        request.onerror = () => reject(request.error);
    });
}

async function getPaymentsForDebt(debtId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['debtPayments'], 'readonly');
        const store = transaction.objectStore('debtPayments');
        const index = store.index('debtId');
        
        const request = index.getAll(debtId);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getAllPayments() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['debtPayments'], 'readonly');
        const store = transaction.objectStore('debtPayments');
        
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Načtení všech dat pro inicializaci
async function loadAllData() {
    try {
        // Načtení kategorií
        await loadCategories();
        
        // Načtení posledních záznamů o práci
        await loadRecentWorkLogs();
        
        // Aktualizace souhrnů
        await updateTodaySummary();
        await updateFinanceSummary();
        
        // Načtení finančních záznamů
        await loadFinanceRecords();
        
        // Načtení dluhů
        await loadDebts();
        await loadDebtsForPaymentForm();
        
        // Načtení přehledu srážek
        await loadDeductionsSummary();
        
        // Aktualizace grafů
        await updateCharts();
    } catch (error) {
        console.error('Chyba při načítání dat:', error);
        showNotification('Chyba při načítání dat. Zkuste obnovit stránku.', 'error');
    }
}

// ===== TMAVÝ REŽIM =====
async function initThemeToggle() {
    const themeSetting = await getSettings('theme');
    const theme = themeSetting ? themeSetting.value : 'light';
    
    // Aplikace tématu při načtení stránky
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
        document.getElementById('checkbox').checked = true;
        document.getElementById('theme-toggle').checked = true;
    }
    
    // Přepínač v hlavičce
    const headerToggle = document.getElementById('checkbox');
    if (headerToggle) {
        headerToggle.addEventListener('change', async function() {
            document.body.classList.toggle('dark-mode');
            await saveSettings('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
            
            // Synchronizace s přepínačem v nastavení
            const settingsToggle = document.getElementById('theme-toggle');
            if (settingsToggle) {
                settingsToggle.checked = document.body.classList.contains('dark-mode');
            }
        });
    }
    
    // Přepínač v nastavení
    const settingsToggle = document.getElementById('theme-toggle');
    if (settingsToggle) {
        settingsToggle.addEventListener('change', async function() {
            document.body.classList.toggle('dark-mode');
            await saveSettings('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
            
            // Synchronizace s přepínačem v hlavičce
            const headerToggle = document.getElementById('checkbox');
            if (headerToggle) {
                headerToggle.checked = document.body.classList.contains('dark-mode');
            }
        });
    }
    
    // Nastavení barevného schématu
    const colorThemeSetting = await getSettings('colorTheme');
    const colorTheme = colorThemeSetting ? colorThemeSetting.value : 'blue';
    
    document.documentElement.style.setProperty('--primary-color', getColorValue(colorTheme));
    document.documentElement.style.setProperty('--primary-light', getLightColorValue(colorTheme));
    document.documentElement.style.setProperty('--primary-dark', getDarkColorValue(colorTheme));
    
    // Označení aktivní barvy
    document.querySelectorAll('.color-option').forEach(option => {
        option.classList.remove('active');
        if (option.getAttribute('data-color') === colorTheme) {
            option.classList.add('active');
        }
    });
    
    // Nastavení posluchače událostí pro barevné přepínače
    document.querySelectorAll('.color-option').forEach(option => {
        option.addEventListener('click', async function() {
            const color = this.getAttribute('data-color');
            document.documentElement.style.setProperty('--primary-color', getColorValue(color));
            document.documentElement.style.setProperty('--primary-light', getLightColorValue(color));
            document.documentElement.style.setProperty('--primary-dark', getDarkColorValue(color));
            
            document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('active'));
            this.classList.add('active');
            
            await saveSettings('colorTheme', color);
        });
    });
}

function getColorValue(color) {
    switch(color) {
        case 'blue': return '#0d6efd';
        case 'green': return '#28a745';
        case 'purple': return '#6f42c1';
        case 'orange': return '#fd7e14';
        default: return '#0d6efd';
    }
}

function getLightColorValue(color) {
    switch(color) {
        case 'blue': return '#4d94ff';
        case 'green': return '#48d368';
        case 'purple': return '#9270d8';
        case 'orange': return '#ff9f45';
        default: return '#4d94ff';
    }
}

function getDarkColorValue(color) {
    switch(color) {
        case 'blue': return '#0a58ca';
        case 'green': return '#1e7e34';
        case 'purple': return '#5a32a3';
        case 'orange': return '#d96909';
        default: return '#0a58ca';
    }
}

// ===== NAVIGACE =====
function initNavigation() {
    // Menu toggle
    const menuToggle = document.getElementById('toggle-menu');
    const mainNav = document.querySelector('.main-nav');

    if (menuToggle) {
        menuToggle.addEventListener('click', function() {
            mainNav.classList.toggle('show');
        });
    }

    // Navigační odkazy
    const navLinks = document.querySelectorAll('.main-nav a');

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();

            // Skrytí menu na mobilních zařízeních po kliknutí
            mainNav.classList.remove('show');

            // Odstranění aktivní třídy ze všech odkazů
            navLinks.forEach(l => l.classList.remove('active'));

            // Přidání aktivní třídy na aktuální odkaz
            this.classList.add('active');

            // Zobrazení příslušné sekce
            const targetId = this.getAttribute('data-section');
            document.querySelectorAll('main > section').forEach(section => {
                section.classList.remove('active');
            });

            document.getElementById(targetId).classList.add('active');

            // Aktualizace URL hash
            window.location.hash = targetId;
        });
    });

    // Kontrola URL hash při načtení stránky
    if (window.location.hash) {
        const targetId = window.location.hash.substring(1);
        const targetLink = document.querySelector(`.main-nav a[data-section="${targetId}"]`);

        if (targetLink) {
            targetLink.click();
        }
    }
}

// ===== NAČTENÍ KATEGORIÍ =====
async function loadCategories() {
    try {
        // Načtení kategorií úkolů
        const taskCategories = await getAllTaskCategories();
        const taskSelects = document.querySelectorAll('#task-select, #manual-activity, #filter-activity');

        taskSelects.forEach(select => {
            // Zachování první možnosti (placeholder)
            const firstOption = select.options[0];
            select.innerHTML = '';
            select.appendChild(firstOption);

            // Přidání kategorií
            taskCategories.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                select.appendChild(option);
            });
        });

        // Načtení kategorií výdajů
        const expenseCategories = await getAllExpenseCategories();
        const financeCategory = document.getElementById('finance-category');

        if (financeCategory) {
            // Zachování první možnosti (placeholder)
            const firstOption = financeCategory.options[0];
            financeCategory.innerHTML = '';
            financeCategory.appendChild(firstOption);

            // Přidání kategorií
            expenseCategories.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                financeCategory.appendChild(option);
            });
        }

        // Zobrazení seznamů kategorií v nastavení
        displayCategoryLists(taskCategories, expenseCategories);

    } catch (error) {
        console.error('Chyba při načítání kategorií:', error);
        showNotification('Chyba při načítání kategorií', 'error');
    }
}

// Zobrazení seznamů kategorií v nastavení
function displayCategoryLists(taskCategories, expenseCategories) {
    // Seznam kategorií úkolů
    const taskCategoriesList = document.getElementById('task-categories-list');
    
    if (taskCategoriesList) {
        taskCategoriesList.innerHTML = '';

        if (taskCategories.length === 0) {
            taskCategoriesList.innerHTML = '<li class="empty-placeholder">Žádné kategorie úkolů.</li>';
        } else {
            taskCategories.forEach(category => {
                const li = document.createElement('li');
                li.innerHTML = `
                    ${category}
                    <button class="btn delete-btn" data-category="${category}" data-type="task">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                `;
                taskCategoriesList.appendChild(li);
            });

            // Posluchače událostí pro tlačítka smazání
            taskCategoriesList.querySelectorAll('.delete-btn').forEach(button => {
                button.addEventListener('click', deleteCategoryHandler);
            });
        }
    }

    // Seznam kategorií výdajů
    const expenseCategoriesList = document.getElementById('expense-categories-list');

    if (expenseCategoriesList) {
        expenseCategoriesList.innerHTML = '';

        if (expenseCategories.length === 0) {
            expenseCategoriesList.innerHTML = '<li class="empty-placeholder">Žádné kategorie výdajů.</li>';
        } else {
            expenseCategories.forEach(category => {
                const li = document.createElement('li');
                li.innerHTML = `
                    ${category}
                    <button class="btn delete-btn" data-category="${category}" data-type="expense">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                `;
                expenseCategoriesList.appendChild(li);
            });

            // Posluchače událostí pro tlačítka smazání
            expenseCategoriesList.querySelectorAll('.delete-btn').forEach(button => {
                button.addEventListener('click', deleteCategoryHandler);
            });
        }
    }
}

// Obsluha smazání kategorie
async function deleteCategoryHandler() {
    const category = this.getAttribute('data-category');
    const type = this.getAttribute('data-type');

    if (confirm(`Opravdu chcete smazat kategorii "${category}"?`)) {
        try {
            if (type === 'task') {
                await deleteTaskCategory(category);
            } else if (type === 'expense') {
                await deleteExpenseCategory(category);
            }

            // Aktualizace seznamů a select elementů
            await loadCategories();
            showNotification('Kategorie byla smazána', 'success');
        } catch (error) {
            console.error('Chyba při mazání kategorie:', error);
            showNotification('Chyba při mazání kategorie', 'error');
        }
    }
}

// Načtení dluhů pro formulář splátky
async function loadDebtsForPaymentForm() {
    const paymentDebtSelect = document.getElementById('payment-debt-id');

    if (!paymentDebtSelect) return;

    // Zachování první možnosti (placeholder)
    const firstOption = paymentDebtSelect.options[0];
    paymentDebtSelect.innerHTML = '';
    paymentDebtSelect.appendChild(firstOption);

    try {
        const debts = await getAllDebts();
        const payments = await getAllPayments();

        // Filtrování dluhů, které mají zbývající částku k zaplacení
        const activeDebts = debts.filter(debt => {
            const debtPayments = payments.filter(payment => payment.debtId === debt.id);
            const totalPaid = debtPayments.reduce((sum, payment) => sum + payment.amount, 0);
            return totalPaid < debt.amount;
        });

        if (activeDebts.length > 0) {
            activeDebts.forEach(debt => {
                const option = document.createElement('option');
                option.value = debt.id;
                
                // Výpočet zbývající částky
                const debtPayments = payments.filter(payment => payment.debtId === debt.id);
                const totalPaid = debtPayments.reduce((sum, payment) => sum + payment.amount, 0);
                const remaining = debt.amount - totalPaid;
                
                option.textContent = `${debt.description} (${debt.person === 'maru' ? 'Maru' : 'Marty'}) - ${formatCurrency(remaining)} ${debt.currency}`;
                paymentDebtSelect.appendChild(option);
            });
        } else {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "-- Žádné aktivní dluhy --";
            option.disabled = true;
            paymentDebtSelect.appendChild(option);
        }
    } catch (error) {
        console.error('Chyba při načítání dluhů:', error);
        showNotification('Chyba při načítání dluhů', 'error');
    }
}

// Nastavení dnešního data ve formulářích
function setTodaysDate() {
    const today = new Date().toISOString().substring(0, 10);
    const dateInputs = document.querySelectorAll('input[type="date"]');

    dateInputs.forEach(input => {
        if (!input.value) {
            input.value = today;
        }
    });
}

// ===== ČASOVAČ =====
let timerState = {
    running: false,
    startTime: null,
    pausedTime: 0,
    timerInterval: null,
    person: 'maru',
    activity: '',
    subcategory: '',
    note: ''
};

function initTimer() {
    // Elementy časovače
    const startBtn = document.getElementById('timer-start');
    const stopBtn = document.getElementById('timer-stop');
    const taskSelect = document.getElementById('task-select');
    const taskSubcategory = document.getElementById('task-subcategory');
    const taskNote = document.getElementById('task-note');
    
    // Inicializace dropdown pro výběr osoby
    initPersonSelector();
    
    // Posluchače událostí pro tlačítka časovače
    if (startBtn) {
        startBtn.addEventListener('click', startTimer);
    }

    if (stopBtn) {
        stopBtn.addEventListener('click', stopTimer);
    }

    // Posluchač události pro výběr úkolu
    if (taskSelect) {
        taskSelect.addEventListener('change', function() {
            timerState.activity = this.value;
        });
    }
    
    // Posluchač události pro podkategorii
    if (taskSubcategory) {
        taskSubcategory.addEventListener('input', function() {
            timerState.subcategory = this.value;
        });
    }

    // Posluchač události pro poznámku
    if (taskNote) {
        taskNote.addEventListener('input', function() {
            timerState.note = this.value;
        });
    }
    
    // Obnovení běžícího časovače z lokálního úložiště
    restoreTimerState();
}

function initPersonSelector() {
    const personDropdown = document.getElementById('person-dropdown');
    const dropdownToggle = document.querySelector('.dropdown-toggle');
    
    // Toggle dropdown
    if (dropdownToggle) {
        dropdownToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            personDropdown.classList.toggle('show');
        });
    }
    
    // Kliknutí mimo dropdown - zavřít
    document.addEventListener('click', function(event) {
        if (!event.target.matches('.dropdown-toggle') && !event.target.closest('.dropdown-toggle')) {
            personDropdown.classList.remove('show');
        }
    });
    
    // Výběr osoby
    if (personDropdown) {
        const dropdownItems = personDropdown.querySelectorAll('.dropdown-item');
        
        dropdownItems.forEach(item => {
            item.addEventListener('click', function() {
                const person = this.getAttribute('data-person');
                const rate = RATES[person];
                
                timerState.person = person;
                
                // Aktualizace UI
                document.getElementById('selected-person').textContent = person.charAt(0).toUpperCase() + person.slice(1);
                document.getElementById('selected-rate').textContent = rate + ' Kč/h';
                
                personDropdown.classList.remove('show');
                
                // Pokud běží časovač, aktualizovat výdělek
                if (timerState.running) {
                    updateEarningsDisplay();
                }
            });
        });
    }
}

// Spuštění časovače
function startTimer() {
    // Kontrola, zda je vybrán úkol
    const taskSelect = document.getElementById('task-select');
    if (!taskSelect || !taskSelect.value) {
        showNotification('Vyberte prosím úkol před spuštěním časovače.', 'warning');
        return;
    }

    // Aktualizace stavu tlačítek
    document.getElementById('timer-start').disabled = true;
    document.getElementById('timer-stop').disabled = false;

    timerState.running = true;
    timerState.activity = taskSelect.value;
    timerState.subcategory = document.getElementById('task-subcategory').value;
    timerState.note = document.getElementById('task-note').value;

    if (!timerState.startTime) {
        // První spuštění
        timerState.startTime = new Date().getTime() - timerState.pausedTime;
    } else {
        // Obnovení po pauze
        timerState.startTime = new Date().getTime() - timerState.pausedTime;
    }

    // Spuštění intervalu pro aktualizaci časovače
    timerState.timerInterval = setInterval(updateTimer, 1000);

    // Přidání třídy pro animaci
    document.querySelector('.timer-display-container').classList.add('timer-running');
    
    // Uložení stavu časovače
    saveTimerState();
    
    // Zobrazení časovače v hlavičce
    const headerTimer = document.getElementById('header-timer');
    const headerTimerPerson = document.getElementById('header-timer-person');
    const headerTimerActivity = document.getElementById('header-timer-activity');
    
    if (headerTimer) headerTimer.classList.remove('hidden');
    if (headerTimerPerson) headerTimerPerson.textContent = timerState.person.charAt(0).toUpperCase() + timerState.person.slice(1);
    if (headerTimerActivity) headerTimerActivity.textContent = timerState.activity;
    
    // Oznámení uživateli
    showNotification('Časovač byl spuštěn.', 'success');
}

// Zastavení a uložení časovače
function stopTimer() {
    if (!timerState.startTime) return;

    // Zastavení časovače
    clearInterval(timerState.timerInterval);
    
    // Aktualizace stavu tlačítek
    document.getElementById('timer-start').disabled = false;
    document.getElementById('timer-stop').disabled = true;
    
    // Odstranění třídy pro animaci
    const timerDisplayContainer = document.querySelector('.timer-display-container');
    if (timerDisplayContainer) {
        timerDisplayContainer.classList.remove('timer-running');
    }

    // Výpočet celkového času a výdělku
    const endTime = new Date().getTime();
    const totalTime = endTime - timerState.startTime;
    const totalHours = totalTime / (1000 * 60 * 60);
    const rate = RATES[timerState.person];
    const earnings = totalHours * rate;
    const deductionRate = DEDUCTION_RATES[timerState.person];
    const deduction = earnings * deductionRate;

    // Vytvoření záznamu o práci
    const workLog = {
        id: generateId(),
        person: timerState.person,
        activity: timerState.activity,
        subcategory: timerState.subcategory,
        note: timerState.note,
        startTime: new Date(timerState.startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        duration: totalTime,
        earnings: Math.round(earnings)
    };

    // Uložení záznamu
    saveWorkLog(workLog).then(() => {
        // Resetování časovače
        resetTimer();
        
        // Informování uživatele
        showNotification(`Záznam byl uložen. Výdělek: ${Math.round(earnings)} Kč, Srážka: ${Math.round(deduction)} Kč.`, 'success');
    }).catch(error => {
        console.error('Chyba při ukládání záznamu:', error);
        showNotification('Chyba při ukládání záznamu.', 'error');
    });
}

// Aktualizace zobrazení časovače
function updateTimer() {
    if (!timerState.running || !timerState.startTime) return;

    const currentTime = new Date().getTime();
    const elapsedTime = currentTime - timerState.startTime;

    // Formátování času a aktualizace digitů
    updateTimerDigits(elapsedTime);

    // Aktualizace zobrazení výdělku
    updateEarningsDisplay();

    // Aktualizace časovače v hlavičce
    const headerTimerTime = document.getElementById('header-timer-time');
    if (headerTimerTime) {
        headerTimerTime.textContent = formatTime(elapsedTime);
    }
    
    // Uložení stavu časovače
    saveTimerState();
}

// Aktualizace jednotlivých digitů časovače
function updateTimerDigits(ms) {
    let seconds = Math.floor(ms / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);

    seconds = seconds % 60;
    minutes = minutes % 60;
    
    // Rozdělení na jednotlivé číslice
    const hoursTens = Math.floor(hours / 10);
    const hoursOnes = hours % 10;
    const minutesTens = Math.floor(minutes / 10);
    const minutesOnes = minutes % 10;
    const secondsTens = Math.floor(seconds / 10);
    const secondsOnes = seconds % 10;
    
    // Aktualizace digitů
    const hoursTensEl = document.getElementById('hours-tens');
    const hoursOnesEl = document.getElementById('hours-ones');
    const minutesTensEl = document.getElementById('minutes-tens');
    const minutesOnesEl = document.getElementById('minutes-ones');
    const secondsTensEl = document.getElementById('seconds-tens');
    const secondsOnesEl = document.getElementById('seconds-ones');
    
    if (hoursTensEl) hoursTensEl.textContent = hoursTens;
    if (hoursOnesEl) hoursOnesEl.textContent = hoursOnes;
    if (minutesTensEl) minutesTensEl.textContent = minutesTens;
    if (minutesOnesEl) minutesOnesEl.textContent = minutesOnes;
    if (secondsTensEl) secondsTensEl.textContent = secondsTens;
    if (secondsOnesEl) secondsOnesEl.textContent = secondsOnes;
}

// Formátování času v milisekundách na HH:MM:SS
function formatTime(ms) {
    let seconds = Math.floor(ms / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);

    seconds = seconds % 60;
    minutes = minutes % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Formátování času v milisekundách na hodiny a minuty
function formatTimeDuration(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
}

// Aktualizace zobrazení výdělku
function updateEarningsDisplay() {
    if (!timerState.startTime) return;
    
    const currentTime = new Date().getTime();
    const elapsedTime = currentTime - timerState.startTime;
    const hours = elapsedTime / (1000 * 60 * 60);
    const rate = RATES[timerState.person];
    const earnings = hours * rate;
    const deductionRate = DEDUCTION_RATES[timerState.person];
    const deduction = earnings * deductionRate;

    const currentEarningsEl = document.getElementById('current-earnings');
    const currentDeductionEl = document.getElementById('current-deduction');
    
    if (currentEarningsEl) currentEarningsEl.textContent = `${Math.round(earnings)} Kč`;
    if (currentDeductionEl) currentDeductionEl.textContent = `${Math.round(deduction)} Kč`;
}

// Resetování časovače
function resetTimer() {
    // Zastavení časovače
    clearInterval(timerState.timerInterval);

    // Resetování stavu časovače
    timerState.running = false;
    timerState.startTime = null;
    timerState.pausedTime = 0;
    timerState.activity = '';
    timerState.subcategory = '';
    timerState.note = '';

    // Aktualizace zobrazení
    const digitElements = [
        'hours-tens', 'hours-ones', 'minutes-tens', 'minutes-ones', 'seconds-tens', 'seconds-ones'
    ];
    
    digitElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.textContent = '0';
    });
    
    const currentEarningsEl = document.getElementById('current-earnings');
    const currentDeductionEl = document.getElementById('current-deduction');
    
    if (currentEarningsEl) currentEarningsEl.textContent = '0 Kč';
    if (currentDeductionEl) currentDeductionEl.textContent = '0 Kč';

    // Aktualizace stavu tlačítek
    const startBtn = document.getElementById('timer-start');
    const stopBtn = document.getElementById('timer-stop');
    
    if (startBtn) startBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = true;
    
    // Resetování formuláře
    const taskSelect = document.getElementById('task-select');
    const taskSubcategory = document.getElementById('task-subcategory');
    const taskNote = document.getElementById('task-note');
    
    if (taskSelect) taskSelect.value = '';
    if (taskSubcategory) taskSubcategory.value = '';
    if (taskNote) taskNote.value = '';
    
    // Odstranění třídy pro animaci
    const timerDisplayContainer = document.querySelector('.timer-display-container');
    if (timerDisplayContainer) {
        timerDisplayContainer.classList.remove('timer-running');
    }

    // Skrytí časovače v hlavičce
    const headerTimer = document.getElementById('header-timer');
    if (headerTimer) {
        headerTimer.classList.add('hidden');
    }
    
    // Vyčištění stavu časovače v lokálním úložišti
    localStorage.removeItem('timerState');
}

// Uložení stavu časovače do lokálního úložiště
function saveTimerState() {
    if (timerState.running) {
        localStorage.setItem('timerState', JSON.stringify({
            running: timerState.running,
            startTime: timerState.startTime,
            pausedTime: timerState.pausedTime,
            person: timerState.person,
            activity: timerState.activity,
            subcategory: timerState.subcategory,
            note: timerState.note
        }));
    }
}

// Obnovení stavu časovače z lokálního úložiště
function restoreTimerState() {
    const savedState = localStorage.getItem('timerState');
    
    if (savedState) {
        try {
            const state = JSON.parse(savedState);
            
            // Kontrola, zda byl časovač spuštěn
            if (state.running) {
                // Obnovení stavu
                timerState.running = state.running;
                timerState.startTime = state.startTime;
                timerState.pausedTime = state.pausedTime;
                timerState.person = state.person;
                timerState.activity = state.activity;
                timerState.subcategory = state.subcategory;
                timerState.note = state.note;
                
                // Aktualizace UI
                const selectedPersonEl = document.getElementById('selected-person');
                const selectedRateEl = document.getElementById('selected-rate');
                const taskSelectEl = document.getElementById('task-select');
                const taskSubcategoryEl = document.getElementById('task-subcategory');
                const taskNoteEl = document.getElementById('task-note');
                
                if (selectedPersonEl) selectedPersonEl.textContent = timerState.person.charAt(0).toUpperCase() + timerState.person.slice(1);
                if (selectedRateEl) selectedRateEl.textContent = RATES[timerState.person] + ' Kč/h';
                if (taskSelectEl) taskSelectEl.value = timerState.activity;
                if (taskSubcategoryEl) taskSubcategoryEl.value = timerState.subcategory;
                if (taskNoteEl) taskNoteEl.value = timerState.note;
                
                // Spuštění časovače
                timerState.timerInterval = setInterval(updateTimer, 1000);
                updateTimer();
                
                // Aktualizace stavu tlačítek
                const startBtn = document.getElementById('timer-start');
                const stopBtn = document.getElementById('timer-stop');
                
                if (startBtn) startBtn.disabled = true;
                if (stopBtn) stopBtn.disabled = false;
                
                // Přidání třídy pro animaci
                const timerDisplayContainer = document.querySelector('.timer-display-container');
                if (timerDisplayContainer) {
                    timerDisplayContainer.classList.add('timer-running');
                }
                
                // Zobrazení časovače v hlavičce
                const headerTimer = document.getElementById('header-timer');
                const headerTimerPerson = document.getElementById('header-timer-person');
                const headerTimerActivity = document.getElementById('header-timer-activity');
                
                if (headerTimer) headerTimer.classList.remove('hidden');
                if (headerTimerPerson) headerTimerPerson.textContent = timerState.person.charAt(0).toUpperCase() + timerState.person.slice(1);
                if (headerTimerActivity) headerTimerActivity.textContent = timerState.activity;
            }
        } catch (error) {
            console.error('Chyba při obnovení stavu časovače:', error);
            localStorage.removeItem('timerState');
        }
    }
}

// ===== RUČNÍ ZADÁNÍ ZÁZNAMU =====
function initManualEntryForm() {
    const manualEntryForm = document.getElementById('manual-entry-form');
    const cancelEditButton = document.getElementById('cancel-edit-button');

    if (manualEntryForm) {
        manualEntryForm.addEventListener('submit', function(e) {
            e.preventDefault();

            // Kontrola, zda je vybrán úkol
            if (!document.getElementById('manual-activity').value) {
                showNotification('Vyberte prosím úkol.', 'warning');
                return;
            }

            // Získání hodnot z formuláře
            const id = document.getElementById('edit-log-id').value || generateId();
            const person = document.getElementById('manual-person').value;
            const date = document.getElementById('manual-date').value;
            const startTime = document.getElementById('manual-start-time').value;
            const endTime = document.getElementById('manual-end-time').value;
            const breakTime = parseInt(document.getElementById('manual-break-time').value) || 0;
            const activity = document.getElementById('manual-activity').value;
            const subcategory = document.getElementById('manual-subcategory').value;
            const note = document.getElementById('manual-note').value;

            // Vytvoření objektů Date pro začátek a konec
            const startDateTime = new Date(`${date}T${startTime}`);
            const endDateTime = new Date(`${date}T${endTime}`);

            // Kontrola, zda je konec po začátku
            if (endDateTime <= startDateTime) {
                showNotification('Konec musí být po začátku.', 'warning');
                return;
            }

            // Výpočet doby trvání v milisekundách
            let duration = endDateTime - startDateTime;
            
            // Odečtení pauzy
            duration -= breakTime * 60 * 1000;
            
            // Kontrola, zda je doba trvání kladná
            if (duration <= 0) {
                showNotification('Doba trvání musí být kladná.', 'warning');
                return;
            }
            
            // Výpočet výdělku
            const hours = duration / (1000 * 60 * 60);
            const rate = RATES[person];
            const earnings = Math.round(hours * rate);

            // Vytvoření záznamu
            const workLog = {
                id,
                person,
                activity,
                subcategory,
                note,
                startTime: startDateTime.toISOString(),
                endTime: endDateTime.toISOString(),
                duration,
                earnings
            };

            // Uložení záznamu
            saveWorkLog(workLog).then(() => {
                // Resetování formuláře
                manualEntryForm.reset();
                document.getElementById('edit-log-id').value = '';
                document.getElementById('save-log-button').innerHTML = '<i class="fas fa-plus"></i> Přidat záznam';
                cancelEditButton.style.display = 'none';
                
                // Nastavení dnešního data
                setTodaysDate();
                
                // Informování uživatele
                showNotification('Záznam byl uložen.', 'success');
            }).catch(error => {
                console.error('Chyba při ukládání záznamu:', error);
                showNotification('Chyba při ukládání záznamu.', 'error');
            });
        });
    }

    if (cancelEditButton) {
        cancelEditButton.addEventListener('click', function() {
            // Resetování formuláře
            manualEntryForm.reset();
            document.getElementById('edit-log-id').value = '';
            document.getElementById('save-log-button').innerHTML = '<i class="fas fa-plus"></i> Přidat záznam';
            cancelEditButton.style.display = 'none';
            
            // Nastavení dnešního data
            setTodaysDate();
        });
    }
}

// ===== NASTAVENÍ SAZEB A SRÁŽEK =====
function initRatesSettings() {
    // Inicializace ovládacích prvků pro sazby a srážky
    const maruRateInput = document.getElementById('maru-rate');
    const martyRateInput = document.getElementById('marty-rate');
    const maruDeductionSlider = document.getElementById('maru-deduction-slider');
    const maruDeductionInput = document.getElementById('maru-deduction');
    const martyDeductionSlider = document.getElementById('marty-deduction-slider');
    const martyDeductionInput = document.getElementById('marty-deduction');
    const saveRatesButton = document.getElementById('save-rates-settings');
    
    // Synchronizace slideru a inputu pro srážky Maru
    if (maruDeductionSlider && maruDeductionInput) {
        maruDeductionSlider.addEventListener('input', function() {
            maruDeductionInput.value = this.value;
        });
        
        maruDeductionInput.addEventListener('input', function() {
            maruDeductionSlider.value = this.value;
        });
    }
    
    // Synchronizace slideru a inputu pro srážky Marty
    if (martyDeductionSlider && martyDeductionInput) {
        martyDeductionSlider.addEventListener('input', function() {
            martyDeductionInput.value = this.value;
        });
        
        martyDeductionInput.addEventListener('input', function() {
            martyDeductionSlider.value = this.value;
        });
    }
    
    // Uložení sazeb a srážek
    if (saveRatesButton) {
        saveRatesButton.addEventListener('click', async function() {
            try {
                // Získání hodnot z formuláře
                const maruRate = parseInt(maruRateInput.value) || 275;
                const martyRate = parseInt(martyRateInput.value) || 400;
                const maruDeduction = parseFloat(maruDeductionInput.value) / 100 || 0.3333;
                const martyDeduction = parseFloat(martyDeductionInput.value) / 100 || 0.5;
                
                // Aktualizace globálních proměnných
                RATES = {
                    'maru': maruRate,
                    'marty': martyRate
                };
                
                DEDUCTION_RATES = {
                    'maru': maruDeduction,
                    'marty': martyDeduction
                };
                
                // Uložení do databáze
                await saveSettings('rates', RATES);
                await saveSettings('deductionRates', DEDUCTION_RATES);
                
                // Aktualizace UI
                updatePersonDropdown();
                
                // Pokud běží časovač, aktualizovat výdělek
                if (timerState.running) {
                    updateEarningsDisplay();
                }
                
                // Informování uživatele
                showNotification('Nastavení sazeb a srážek bylo uloženo.', 'success');
            } catch (error) {
                console.error('Chyba při ukládání sazeb a srážek:', error);
                showNotification('Chyba při ukládání sazeb a srážek.', 'error');
            }
        });
    }
}

// Aktualizace dropdown menu pro výběr osoby
function updatePersonDropdown() {
    const personDropdown = document.getElementById('person-dropdown');
    
    if (personDropdown) {
        const dropdownItems = personDropdown.querySelectorAll('.dropdown-item');
        
        dropdownItems.forEach(item => {
            const person = item.getAttribute('data-person');
            item.setAttribute('data-rate', RATES[person]);
            
            // Pokud je aktuálně vybraná osoba, aktualizovat zobrazení sazby
            if (timerState.person === person) {
                document.getElementById('selected-rate').textContent = RATES[person] + ' Kč/h';
            }
        });
    }
}

// Načtení uložených sazeb a srážek
async function loadRatesAndDeductions() {
    try {
        // Načtení sazeb
        const ratesSetting = await getSettings('rates');
        if (ratesSetting && ratesSetting.value) {
            RATES = ratesSetting.value;
            
            // Aktualizace UI
            const maruRateInput = document.getElementById('maru-rate');
            const martyRateInput = document.getElementById('marty-rate');
            
            if (maruRateInput) maruRateInput.value = RATES.maru;
            if (martyRateInput) martyRateInput.value = RATES.marty;
            
            // Aktualizace dropdown menu
            updatePersonDropdown();
        }
        
        // Načtení srážek
        const deductionRatesSetting = await getSettings('deductionRates');
        if (deductionRatesSetting && deductionRatesSetting.value) {
            DEDUCTION_RATES = deductionRatesSetting.value;
            
            // Aktualizace UI
            const maruDeductionSlider = document.getElementById('maru-deduction-slider');
            const maruDeductionInput = document.getElementById('maru-deduction');
            const martyDeductionSlider = document.getElementById('marty-deduction-slider');
            const martyDeductionInput = document.getElementById('marty-deduction');
            
            if (maruDeductionSlider) maruDeductionSlider.value = DEDUCTION_RATES.maru * 100;
            if (maruDeductionInput) maruDeductionInput.value = DEDUCTION_RATES.maru * 100;
            if (martyDeductionSlider) martyDeductionSlider.value = DEDUCTION_RATES.marty * 100;
            if (martyDeductionInput) martyDeductionInput.value = DEDUCTION_RATES.marty * 100;
        }
    } catch (error) {
        console.error('Chyba při načítání sazeb a srážek:', error);
    }
}

// ===== RUČNÍ ZADÁNÍ ZÁZNAMU =====
function initManualEntryForm() {
    const manualEntryForm = document.getElementById('manual-entry-form');
    const cancelEditButton = document.getElementById('cancel-edit-button');

    if (manualEntryForm) {
        manualEntryForm.addEventListener('submit', function(e) {
            e.preventDefault();

            // Kontrola, zda je vybrán úkol
            if (!document.getElementById('manual-activity').value) {
                showNotification('Vyberte prosím úkol.', 'warning');
                return;
            }

            // Získání hodnot z formuláře
            const id = document.getElementById('edit-log-id').value || generateId();
            const person = document.getElementById('manual-person').value;
            const date = document.getElementById('manual-date').value;
            const startTime = document.getElementById('manual-start-time').value;
            const endTime = document.getElementById('manual-end-time').value;
            const breakTime = parseInt(document.getElementById('manual-break-time').value) || 0;
            const activity = document.getElementById('manual-activity').value;
            const subcategory = document.getElementById('manual-subcategory').value;
            const note = document.getElementById('manual-note').value;

            // Vytvoření objektů Date pro začátek a konec
            const startDateTime = new Date(`${date}T${startTime}`);
            const endDateTime = new Date(`${date}T${endTime}`);

            // Kontrola, zda je konec po začátku
            if (endDateTime <= startDateTime) {
                showNotification('Konec musí být po začátku.', 'warning');
                return;
            }

            // Výpočet doby trvání v milisekundách
            let duration = endDateTime - startDateTime;
            
            // Odečtení pauzy
            duration -= breakTime * 60 * 1000;
            
            // Kontrola, zda je doba trvání kladná
            if (duration <= 0) {
                showNotification('Doba trvání musí být kladná.', 'warning');
                return;
            }
            
            // Výpočet výdělku
            const hours = duration / (1000 * 60 * 60);
            const rate = RATES[person];
            const earnings = Math.round(hours * rate);

            // Vytvoření záznamu
            const workLog = {
                id,
                person,
                activity,
                subcategory,
                note,
                startTime: startDateTime.toISOString(),
                endTime: endDateTime.toISOString(),
                duration,
                earnings
            };

            // Uložení záznamu
            saveWorkLog(workLog).then(() => {
                // Resetování formuláře
                manualEntryForm.reset();
                document.getElementById('edit-log-id').value = '';
                document.getElementById('save-log-button').innerHTML = '<i class="fas fa-plus"></i> Přidat záznam';
                cancelEditButton.style.display = 'none';
                
                // Nastavení dnešního data
                setTodaysDate();
                
                // Informování uživatele
                showNotification('Záznam byl uložen.', 'success');
            }).catch(error => {
                console.error('Chyba při ukládání záznamu:', error);
                showNotification('Chyba při ukládání záznamu.', 'error');
            });
        });
    }

    if (cancelEditButton) {
        cancelEditButton.addEventListener('click', function() {
            // Resetování formuláře
            manualEntryForm.reset();
            document.getElementById('edit-log-id').value = '';
            document.getElementById('save-log-button').innerHTML = '<i class="fas fa-plus"></i> Přidat záznam';
            cancelEditButton.style.display = 'none';
            
            // Nastavení dnešního data
            setTodaysDate();
        });
    }
}

// Načtení posledních záznamů
async function loadRecentWorkLogs() {
    const tableBody = document.querySelector('#recent-logs-table tbody');
    
    if (!tableBody) return;
    
    try {
        // Získání všech záznamů
        const logs = await getAllWorkLogs();
        
        // Seřazení podle času (nejnovější první)
        logs.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
        
        // Omezení na posledních 10 záznamů
        const recentLogs = logs.slice(0, 10);
        
        // Vyčištění tabulky
        tableBody.innerHTML = '';
        
        if (recentLogs.length === 0) {
            tableBody.innerHTML = '<tr class="empty-row"><td colspan="7">Žádné nedávné záznamy k zobrazení</td></tr>';
            return;
        }
        
        // Naplnění tabulky
        recentLogs.forEach(log => {
            const startDate = new Date(log.startTime);
            const endDate = new Date(log.endTime);
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${startDate.toLocaleDateString()}</td>
                <td>${log.person === 'maru' ? 'Maru' : 'Marty'}</td>
                <td>${log.activity}${log.subcategory ? ` (${log.subcategory})` : ''}</td>
                <td>${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                <td>${formatTimeDuration(log.duration)}</td>
                <td>${formatCurrency(log.earnings)}</td>
                <td>
                    <button class="btn action-btn edit-log-btn" data-id="${log.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn delete-btn delete-log-btn" data-id="${log.id}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
        
        // Přidání posluchačů událostí pro tlačítka
        tableBody.querySelectorAll('.edit-log-btn').forEach(button => {
            button.addEventListener('click', editWorkLog);
        });
        
        tableBody.querySelectorAll('.delete-log-btn').forEach(button => {
            button.addEventListener('click', deleteWorkLogHandler);
        });
    } catch (error) {
        console.error('Chyba při načítání záznamů:', error);
        tableBody.innerHTML = '<tr class="empty-row"><td colspan="7">Chyba při načítání záznamů</td></tr>';
    }
}

// Obsluha úpravy záznamu
async function editWorkLog() {
    const id = this.getAttribute('data-id');
    
    try {
        // Získání záznamu
        const log = await getWorkLog(id);
        
        if (!log) {
            showNotification('Záznam nebyl nalezen.', 'error');
            return;
        }
        
        // Naplnění formuláře
        document.getElementById('edit-log-id').value = log.id;
        document.getElementById('manual-person').value = log.person;
        
        const startDate = new Date(log.startTime);
        document.getElementById('manual-date').value = startDate.toISOString().substring(0, 10);
        document.getElementById('manual-start-time').value = startDate.toTimeString().substring(0, 5);
        
        const endDate = new Date(log.endTime);
        document.getElementById('manual-end-time').value = endDate.toTimeString().substring(0, 5);
        
        document.getElementById('manual-break-time').value = '0';
        document.getElementById('manual-activity').value = log.activity;
        document.getElementById('manual-subcategory').value = log.subcategory || '';
        document.getElementById('manual-note').value = log.note || '';
        
        // Změna textu tlačítka
        document.getElementById('save-log-button').innerHTML = '<i class="fas fa-save"></i> Uložit změny';
        
        // Zobrazení tlačítka pro zrušení úpravy
        document.getElementById('cancel-edit-button').style.display = 'block';
        
        // Scrollování k formuláři
        document.querySelector('.manual-entry').scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        console.error('Chyba při načítání záznamu:', error);
        showNotification('Chyba při načítání záznamu.', 'error');
    }
}

// Obsluha smazání záznamu
function deleteWorkLogHandler() {
    const id = this.getAttribute('data-id');
    
    if (confirm('Opravdu chcete smazat tento záznam?')) {
        deleteWorkLog(id).then(() => {
            showNotification('Záznam byl smazán.', 'success');
        }).catch(error => {
            console.error('Chyba při mazání záznamu:', error);
            showNotification('Chyba při mazání záznamu.', 'error');
        });
    }
}

// Aktualizace dnešního souhrnu
async function updateTodaySummary() {
    try {
        // Získání dnešního data
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Získání všech záznamů
        const logs = await getAllWorkLogs({
            startDate: today.toISOString()
        });
        
        // Výpočet celkového času a výdělku
        let totalDuration = 0;
        let totalEarnings = 0;
        let totalDeductions = 0;
        
        logs.forEach(log => {
            totalDuration += log.duration;
            totalEarnings += log.earnings;
            totalDeductions += Math.round(log.earnings * DEDUCTION_RATES[log.person]);
        });
        
        // Aktualizace UI
        document.getElementById('total-hours-today').textContent = formatTimeDuration(totalDuration);
        document.getElementById('total-earnings-today').textContent = formatCurrency(totalEarnings);
        document.getElementById('total-deductions-today').textContent = formatCurrency(totalDeductions);
        document.getElementById('net-earnings-today').textContent = formatCurrency(totalEarnings - totalDeductions);
    } catch (error) {
        console.error('Chyba při aktualizaci dnešního souhrnu:', error);
    }
}

// Formátování měny
function formatCurrency(amount) {
    return `${amount.toLocaleString()} Kč`;
}

// Generování ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// ===== NOTIFIKACE =====
function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    
    if (!container) return;
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    let icon = '';
    switch (type) {
        case 'success':
            icon = '<i class="fas fa-check-circle notification-icon"></i>';
            break;
        case 'error':
            icon = '<i class="fas fa-exclamation-circle notification-icon"></i>';
            break;
        case 'warning':
            icon = '<i class="fas fa-exclamation-triangle notification-icon"></i>';
            break;
        default:
            icon = '<i class="fas fa-info-circle notification-icon"></i>';
    }
    
    notification.innerHTML = `
        ${icon}
        <div class="notification-content">${message}</div>
        <button class="notification-close"><i class="fas fa-times"></i></button>
        <div class="notification-progress"></div>
    `;
    
    container.appendChild(notification);
    
    // Automatické zavření po 5 sekundách
    const timeout = setTimeout(() => {
        notification.remove();
    }, 5000);
    
    // Zavření po kliknutí na křížek
    notification.querySelector('.notification-close').addEventListener('click', () => {
        clearTimeout(timeout);
        notification.remove();
    });
}

// ===== INICIALIZACE NASTAVENÍ =====
function initSettings() {
    // Přidání kategorie úkolu
    const addTaskCategoryButton = document.getElementById('add-task-category');
    const newTaskCategoryInput = document.getElementById('new-task-category');
    
    if (addTaskCategoryButton && newTaskCategoryInput) {
        addTaskCategoryButton.addEventListener('click', async function() {
            const category = newTaskCategoryInput.value.trim();
            
            if (!category) {
                showNotification('Zadejte název kategorie.', 'warning');
                return;
            }
            
            try {
                await addTaskCategory(category);
                newTaskCategoryInput.value = '';
                await loadCategories();
                showNotification('Kategorie byla přidána.', 'success');
            } catch (error) {
                console.error('Chyba při přidávání kategorie:', error);
                showNotification('Chyba při přidávání kategorie.', 'error');
            }
        });
    }
    
    // Přidání kategorie výdajů
    const addExpenseCategoryButton = document.getElementById('add-expense-category');
    const newExpenseCategoryInput = document.getElementById('new-expense-category');
    
    if (addExpenseCategoryButton && newExpenseCategoryInput) {
        addExpenseCategoryButton.addEventListener('click', async function() {
            const category = newExpenseCategoryInput.value.trim();
            
            if (!category) {
                showNotification('Zadejte název kategorie.', 'warning');
                return;
            }
            
            try {
                await addExpenseCategory(category);
                newExpenseCategoryInput.value = '';
                await loadCategories();
                showNotification('Kategorie byla přidána.', 'success');
            } catch (error) {
                console.error('Chyba při přidávání kategorie:', error);
                showNotification('Chyba při přidávání kategorie.', 'error');
            }
        });
    }
    
    // Uložení nastavení nájmu
    const saveRentSettingsButton = document.getElementById('save-rent-settings');
    
    if (saveRentSettingsButton) {
        saveRentSettingsButton.addEventListener('click', async function() {
            const rentAmount = parseFloat(document.getElementById('rent-amount').value) || 24500;
            const rentDay = parseInt(document.getElementById('rent-day').value) || 1;
            
            try {
                await saveSettings('rentAmount', rentAmount);
                await saveSettings('rentDay', rentDay);
                
                // Aktualizace UI
                document.querySelector('.rent-amount .rent-value').textContent = `${rentAmount.toLocaleString()} Kč`;
                document.querySelector('.rent-due .rent-value').textContent = `${rentDay}. den v měsíci`;
                
                showNotification('Nastavení nájmu bylo uloženo.', 'success');
            } catch (error) {
                console.error('Chyba při ukládání nastavení nájmu:', error);
                showNotification('Chyba při ukládání nastavení nájmu.', 'error');
            }
        });
    }
    
    // Zálohování dat
    const backupDataButton = document.getElementById('backup-data');
    
    if (backupDataButton) {
        backupDataButton.addEventListener('click', async function() {
            try {
                // Získání všech dat
                const workLogs = await getAllWorkLogs();
                const financeRecords = await getAllFinanceRecords();
                const taskCategories = await getAllTaskCategories();
                const expenseCategories = await getAllExpenseCategories();
                const debts = await getAllDebts();
                const payments = await getAllPayments();
                const sharedBudget = await getSharedBudget();
                
                // Vytvoření objektu s daty
                const data = {
                    workLogs,
                    financeRecords,
                    taskCategories,
                    expenseCategories,
                    debts,
                    payments,
                    sharedBudget,
                    rates: RATES,
                    deductionRates: DEDUCTION_RATES,
                    exportDate: new Date().toISOString()
                };
                
                // Vytvoření Blob a stažení
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `makej-backup-${new Date().toISOString().substring(0, 10)}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                showNotification('Data byla úspěšně zálohována.', 'success');
            } catch (error) {
                console.error('Chyba při zálohování dat:', error);
                showNotification('Chyba při zálohování dat.', 'error');
            }
        });
    }
    
    // Import dat
    const importDataInput = document.getElementById('import-data-input');
    
    if (importDataInput) {
        importDataInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            
            if (!file) return;
            
            const reader = new FileReader();
            
            reader.onload = async function(e) {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    if (confirm('Opravdu chcete obnovit data ze zálohy? Tato akce přepíše všechna existující data.')) {
                        // Smazání všech existujících dat
                        await clearAllData();
                        
                        // Import dat
                        await importData(data);
                        
                        // Obnovení stránky
                        window.location.reload();
                    }
                } catch (error) {
                    console.error('Chyba při importu dat:', error);
                    showNotification('Chyba při importu dat.', 'error');
                }
            };
            
            reader.readAsText(file);
        });
    }
    
    // Smazání všech dat
    const clearAllDataButton = document.getElementById('clear-all-data');
    
    if (clearAllDataButton) {
        clearAllDataButton.addEventListener('click', async function() {
            if (confirm('Opravdu chcete smazat všechna data? Tato akce je nevratná.')) {
                try {
                    await clearAllData();
                    
                    // Obnovení stránky
                    window.location.reload();
                } catch (error) {
                    console.error('Chyba při mazání dat:', error);
                    showNotification('Chyba při mazání dat.', 'error');
                }
            }
        });
    }
}

// Smazání všech dat
async function clearAllData() {
    return new Promise((resolve, reject) => {
        try {
            // Smazání databáze
            const request = indexedDB.deleteDatabase('WorkTrackerDB');
            
            request.onsuccess = function() {
                resolve();
            };
            
            request.onerror = function(event) {
                reject(event.target.error);
            };
        } catch (error) {
            reject(error);
        }
    });
}

// Import dat
async function importData(data) {
    // Inicializace databáze
    await initDatabase();
    
    // Import kategorií úkolů
    if (data.taskCategories) {
        for (const category of data.taskCategories) {
            await addTaskCategory(category);
        }
    }
    
    // Import kategorií výdajů
    if (data.expenseCategories) {
        for (const category of data.expenseCategories) {
            await addExpenseCategory(category);
        }
    }
    
    // Import záznamů o práci
    if (data.workLogs) {
        for (const log of data.workLogs) {
            await saveWorkLog(log);
        }
    }
    
    // Import finančních záznamů
    if (data.financeRecords) {
        for (const record of data.financeRecords) {
            await saveFinanceRecord(record);
        }
    }
    
    // Import dluhů
    if (data.debts) {
        for (const debt of data.debts) {
            await saveDebt(debt);
        }
    }
    
    // Import plateb
    if (data.payments) {
        for (const payment of data.payments) {
            await savePayment(payment);
        }
    }
    
    // Import společného rozpočtu
    if (data.sharedBudget) {
        await saveSharedBudget(data.sharedBudget);
    }
    
    // Import sazeb a srážek
    if (data.rates) {
        await saveSettings('rates', data.rates);
    }
    
    if (data.deductionRates) {
        await saveSettings('deductionRates', data.deductionRates);
    }
}

// ===== INICIALIZACE RYCHLÝCH AKCÍ =====
function initQuickActions() {
    // Implementace rychlých akcí
}

// ===== KONTROLA PLATBY NÁJMU =====
async function checkRentPayment() {
    try {
        // Získání nastavení nájmu
        const rentAmountSetting = await getSettings('rentAmount');
        const rentDaySetting = await getSettings('rentDay');
        
        const rentAmount = rentAmountSetting ? rentAmountSetting.value : 24500;
        const rentDay = rentDaySetting ? rentDaySetting.value : 1;
        
        // Aktualizace UI
        document.querySelector('.rent-amount .rent-value').textContent = `${rentAmount.toLocaleString()} Kč`;
        document.querySelector('.rent-due .rent-value').textContent = `${rentDay}. den v měsíci`;
        
        // Kontrola, zda je dnes den platby nájmu
        const today = new Date();
        
        if (today.getDate() === rentDay) {
            // Kontrola, zda již byl nájem zaplacen v tomto měsíci
            const rentPaidSetting = await getSettings(`rentPaid_${today.getFullYear()}_${today.getMonth() + 1}`);
            
            if (!rentPaidSetting || !rentPaidSetting.value) {
                // Získání společného rozpočtu
                const budget = await getSharedBudget();
                
                // Kontrola, zda je dostatek peněz
                if (budget.balance >= rentAmount) {
                    // Odečtení nájmu
                    await updateSharedBudget(-rentAmount);
                    
                    // Označení nájmu jako zaplaceného
                    await saveSettings(`rentPaid_${today.getFullYear()}_${today.getMonth() + 1}`, true);
                    
                    // Aktualizace UI
                    document.getElementById('rent-status-value').innerHTML = '<i class="fas fa-check-circle"></i> Zaplaceno';
                    
                    // Informování uživatele
                    showNotification(`Nájem ve výši ${rentAmount.toLocaleString()} Kč byl automaticky zaplacen.`, 'success');
                } else {
                    // Vytvoření dluhu
                    const debt = {
                        id: generateId(),
                        person: 'maru', // Výchozí osoba pro dluh nájmu
                        description: `Nájem za ${today.toLocaleString('cs-CZ', { month: 'long', year: 'numeric' })}`,
                        amount: rentAmount,
                        currency: 'CZK',
                        date: today.toISOString(),
                        dueDate: new Date(today.getFullYear(), today.getMonth(), rentDay + 14).toISOString(),
                        creditor: 'Pronajímatel',
                        priority: 'high'
                    };
                    
                    await saveDebt(debt);
                    
                    // Aktualizace UI
                    document.getElementById('rent-status-value').innerHTML = '<i class="fas fa-exclamation-circle"></i> Nezaplaceno';
                    
                    // Informování uživatele
                    showNotification(`Nájem ve výši ${rentAmount.toLocaleString()} Kč nemohl být zaplacen. Byl vytvořen dluh.`, 'warning');
                }
            }
        }
        
        // Nastavení data příští platby
        const nextRentDate = new Date();
        
        if (nextRentDate.getDate() >= rentDay) {
            nextRentDate.setMonth(nextRentDate.getMonth() + 1);
        }
        
        nextRentDate.setDate(rentDay);
        
        document.getElementById('next-rent-date').textContent = nextRentDate.toLocaleDateString('cs-CZ');
    } catch (error) {
        console.error('Chyba při kontrole platby nájmu:', error);
    }
}

// ===== INICIALIZACE NOTIFIKACÍ =====
function initNotifications() {
    // Implementace notifikací
}

// ===== INICIALIZACE FILTRŮ =====
function initFilters() {
    // Implementace filtrů
}

// ===== INICIALIZACE GRAFŮ =====
function initCharts() {
    // Implementace grafů
}

// ===== INICIALIZACE EXPORTU DAT =====
function initExportFunctions() {
    // Implementace exportu dat
}

// ===== INICIALIZACE SPRÁVY DLUHŮ =====
function initDebtManagement() {
    // Implementace správy dluhů
}

// ===== INICIALIZACE FORMULÁŘE PRO PŘIDÁNÍ FINANČNÍHO ZÁZNAMU =====
function initFinanceForm() {
    // Implementace formuláře pro přidání finančního záznamu
}

// ===== NAČTENÍ FINANČNÍCH ZÁZNAMŮ =====
function loadFinanceRecords() {
    // Implementace načtení finančních záznamů
}

// ===== AKTUALIZACE FINANČNÍHO SOUHRNU =====
function updateFinanceSummary() {
    // Implementace aktualizace finančního souhrnu
}

// ===== NAČTENÍ PŘEHLEDU SRÁŽEK =====
function loadDeductionsSummary() {
    // Implementace načtení přehledu srážek
}

// ===== NAČTENÍ DLUHŮ =====
function loadDebts() {
    // Implementace načtení dluhů
}

// ===== NAČTENÍ PRACOVNÍCH ZÁZNAMŮ =====
function loadWorkLogs() {
    // Implementace načtení pracovních záznamů
}

// ===== AKTUALIZACE GRAFŮ =====
function updateCharts() {
    // Implementace aktualizace grafů
}

// ===== KONTROLA SPLÁCENÍ DLUHŮ =====
async function checkDebtPayments() {
    try {
        // Získání společného rozpočtu
        const budget = await getSharedBudget();
        
        // Kontrola, zda je přebytek
        if (budget.balance <= 0) return;
        
        // Získání aktivních dluhů
        const debts = await getAllDebts();
        const payments = await getAllPayments();
        
        // Filtrování dluhů, které mají zbývající částku k zaplacení
        const activeDebts = debts.filter(debt => {
            const debtPayments = payments.filter(payment => payment.debtId === debt.id);
            const totalPaid = debtPayments.reduce((sum, payment) => sum + payment.amount, 0);
            return totalPaid < debt.amount && debt.currency === 'CZK';
        });
        
        if (activeDebts.length === 0) return;
        
        // Seřazení dluhů podle priority
        activeDebts.sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
        
        // Splácení dluhů
        let remainingBudget = budget.balance;
        
        for (const debt of activeDebts) {
            if (remainingBudget <= 0) break;
            
            // Výpočet zbývající částky k zaplacení
            const debtPayments = payments.filter(payment => payment.debtId === debt.id);
            const totalPaid = debtPayments.reduce((sum, payment) => sum + payment.amount, 0);
            const remaining = debt.amount - totalPaid;
            
            // Výpočet částky k zaplacení
            const paymentAmount = Math.min(remaining, remainingBudget);
            
            if (paymentAmount > 0) {
                // Vytvoření platby
                const payment = {
                    id: generateId(),
                    debtId: debt.id,
                    amount: paymentAmount,
                    date: new Date().toISOString(),
                    note: 'Automatická splátka ze společného rozpočtu'
                };
                
                await savePayment(payment);
                
                // Odečtení z rozpočtu
                await updateSharedBudget(-paymentAmount);
                
                // Aktualizace zbývajícího rozpočtu
                remainingBudget -= paymentAmount;
                
                // Informování uživatele
                showNotification(`Automatická splátka dluhu "${debt.description}" ve výši ${paymentAmount.toLocaleString()} Kč.`, 'success');
            }
        }
    } catch (error) {
        console.error('Chyba při kontrole splácení dluhů:', error);
    }
}
