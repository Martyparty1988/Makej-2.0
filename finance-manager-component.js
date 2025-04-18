// Finance Manager Component
class FinanceManager {
    constructor() {
        this.db = null;
        this.categories = [];
        this.sharedBudget = {
            balance: 0,
            lastUpdated: new Date().toISOString()
        };
        this.rentSettings = {
            amount: 24500,
            dueDay: 1
        };
    }

    async init(database) {
        this.db = database;
        
        // Načtení nastavení
        await this.loadSettings();
        
        // Načtení kategorií
        await this.loadCategories();
        
        // Načtení společného rozpočtu
        await this.loadSharedBudget();
        
        // Inicializace formuláře pro přidání finančního záznamu
        this.initFinanceForm();
        
        // Kontrola platby nájmu
        await this.checkRentPayment();
        
        // Načtení finančních záznamů
        await this.loadFinanceRecords();
        
        // Aktualizace finančního souhrnu
        await this.updateFinanceSummary();
        
        // Inicializace grafů
        this.initCharts();
        
        console.log('Finance Manager initialized');
    }
    
    async loadSettings() {
        try {
            // Načtení nastavení nájmu
            const rentAmountSetting = await this.getSetting('rentAmount');
            const rentDaySetting = await this.getSetting('rentDay');
            
            if (rentAmountSetting) {
                this.rentSettings.amount = rentAmountSetting.value;
            }
            
            if (rentDaySetting) {
                this.rentSettings.dueDay = rentDaySetting.value;
            }
            
            // Aktualizace UI
            const rentAmountEl = document.getElementById('rent-amount');
            const rentDayEl = document.getElementById('rent-day');
            
            if (rentAmountEl) {
                rentAmountEl.value = this.rentSettings.amount;
            }
            
            if (rentDayEl) {
                rentDayEl.value = this.rentSettings.dueDay;
            }
            
            document.querySelector('.rent-amount .rent-value').textContent = `${this.rentSettings.amount.toLocaleString()} Kč`;
            document.querySelector('.rent-due .rent-value').textContent = `${this.rentSettings.dueDay}. den v měsíci`;
        } catch (error) {
            console.error('Chyba při načítání nastavení:', error);
        }
    }
    
    async getSetting(key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            
            const request = store.get(key);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    async saveSetting(key, value) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            
            const request = store.put({ key, value });
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    async loadCategories() {
        try {
            // Načtení kategorií výdajů
            const categories = await this.getAllExpenseCategories();
            this.categories = categories;
            
            // Aktualizace select elementu
            const categorySelect = document.getElementById('finance-category');
            
            if (categorySelect) {
                // Zachování první možnosti (placeholder)
                const firstOption = categorySelect.options[0];
                categorySelect.innerHTML = '';
                categorySelect.appendChild(firstOption);
                
                // Přidání kategorií
                categories.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category;
                    option.textContent = category;
                    categorySelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Chyba při načítání kategorií:', error);
        }
    }
    
    async getAllExpenseCategories() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['expenseCategories'], 'readonly');
            const store = transaction.objectStore('expenseCategories');
            
            const request = store.getAll();
            
            request.onsuccess = () => {
                const categories = request.result.map(item => item.name);
                resolve(categories);
            };
            request.onerror = () => reject(request.error);
        });
    }
    
    async loadSharedBudget() {
        try {
            const budget = await this.getSharedBudget();
            this.sharedBudget = budget;
            
            // Aktualizace UI
            const sharedBudgetEl = document.getElementById('shared-budget');
            if (sharedBudgetEl) {
                sharedBudgetEl.textContent = this.formatCurrency(budget.balance);
            }
            
            // Aktualizace grafu
            this.updateBudgetChart(budget.balance);
        } catch (error) {
            console.error('Chyba při načítání společného rozpočtu:', error);
        }
    }
    
    async getSharedBudget() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sharedBudget'], 'readonly');
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
    
    async saveSharedBudget(budgetData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sharedBudget'], 'readwrite');
            const store = transaction.objectStore('sharedBudget');
            
            const request = store.put(budgetData);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    async updateSharedBudget(amount) {
        try {
            // Aktualizace lokálního objektu
            this.sharedBudget.balance += amount;
            this.sharedBudget.lastUpdated = new Date().toISOString();
            
            // Uložení do databáze
            await this.saveSharedBudget(this.sharedBudget);
            
            // Aktualizace UI
            const sharedBudgetEl = document.getElementById('shared-budget');
            if (sharedBudgetEl) {
                sharedBudgetEl.textContent = this.formatCurrency(this.sharedBudget.balance);
            }
            
            // Aktualizace grafu
            this.updateBudgetChart(this.sharedBudget.balance);
            
            // Kontrola splácení dluhů z přebytku v rozpočtu
            if (this.sharedBudget.balance > 0) {
                await this.checkDebtPayments();
            }
            
            return this.sharedBudget.balance;
        } catch (error) {
            console.error('Chyba při aktualizaci společného rozpočtu:', error);
            throw error;
        }
    }
    
    updateBudgetChart(balance) {
        const chartEl = document.querySelector('.circular-chart .circle');
        const balanceAmountEl = document.querySelector('.balance-amount');
        
        if (chartEl && balanceAmountEl) {
            // Aktualizace částky
            balanceAmountEl.textContent = this.formatCurrency(balance);
            
            // Aktualizace barvy
            if (balance > 0) {
                chartEl.style.stroke = 'var(--success-color)';
                balanceAmountEl.style.color = 'var(--success-color)';
            } else if (balance < 0) {
                chartEl.style.stroke = 'var(--danger-color)';
                balanceAmountEl.style.color = 'var(--danger-color)';
            } else {
                chartEl.style.stroke = 'var(--secondary-color)';
                balanceAmountEl.style.color = 'var(--secondary-color)';
            }
            
            // Aktualizace grafu
            const percentage = Math.min(Math.abs(balance) / 50000 * 100, 100);
            chartEl.style.strokeDasharray = `${percentage} 100`;
        }
    }
    
    initFinanceForm() {
        const financeForm = document.getElementById('finance-form');
        
        if (financeForm) {
            financeForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                try {
                    // Získání hodnot z formuláře
                    const type = document.getElementById('finance-type').value;
                    const amount = parseFloat(document.getElementById('finance-amount').value);
                    const currency = document.getElementById('finance-currency').value;
                    const category = document.getElementById('finance-category').value;
                    const date = document.getElementById('finance-date').value;
                    const description = document.getElementById('finance-description').value;
                    
                    // Validace
                    if (!amount || isNaN(amount) || amount <= 0) {
                        this.showNotification('Zadejte platnou částku.', 'warning');
                        return;
                    }
                    
                    if (!category) {
                        this.showNotification('Vyberte kategorii.', 'warning');
                        return;
                    }
                    
                    if (!date) {
                        this.showNotification('Zadejte datum.', 'warning');
                        return;
                    }
                    
                    // Vytvoření záznamu
                    const record = {
                        id: this.generateId(),
                        type,
                        amount,
                        currency,
                        category,
                        date: new Date(date).toISOString(),
                        description,
                        createdAt: new Date().toISOString()
                    };
                    
                    // Uložení záznamu
                    await this.saveFinanceRecord(record);
                    
                    // Resetování formuláře
                    financeForm.reset();
                    
                    // Nastavení dnešního data
                    document.getElementById('finance-date').value = new Date().toISOString().substring(0, 10);
                    
                    // Informování uživatele
                    this.showNotification('Finanční záznam byl uložen.', 'success');
                } catch (error) {
                    console.error('Chyba při ukládání finančního záznamu:', error);
                    this.showNotification('Chyba při ukládání finančního záznamu.', 'error');
                }
            });
        }
        
        // Nastavení dnešního data
        const dateInput = document.getElementById('finance-date');
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().substring(0, 10);
        }
    }
    
    async saveFinanceRecord(record) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['financeRecords'], 'readwrite');
            const store = transaction.objectStore('financeRecords');
            
            const request = store.put(record);
            
            request.onsuccess = async () => {
                try {
                    // Pokud se jedná o příjem v CZK, přičíst do společného rozpočtu
                    if (record.type === 'income' && record.currency === 'CZK') {
                        await this.updateSharedBudget(record.amount);
                    }
                    
                    // Pokud se jedná o výdaj v CZK, odečíst ze společného rozpočtu
                    if (record.type === 'expense' && record.currency === 'CZK') {
                        await this.updateSharedBudget(-record.amount);
                    }
                    
                    // Aktualizace UI
                    await this.loadFinanceRecords();
                    await this.updateFinanceSummary();
                    
                    resolve(request.result);
                } catch (error) {
                    reject(error);
                }
            };
            
            request.onerror = () => reject(request.error);
        });
    }
    
    async updateFinanceRecord(record) {
        // Nejprve získáme starý záznam pro výpočet rozdílu
        const oldRecord = await this.getFinanceRecord(record.id);
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['financeRecords'], 'readwrite');
            const store = transaction.objectStore('financeRecords');
            
            const request = store.put(record);
            
            request.onsuccess = async () => {
                try {
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
                            await this.updateSharedBudget(difference);
                        }
                    }
                    
                    // Aktualizace UI
                    await this.loadFinanceRecords();
                    await this.updateFinanceSummary();
                    
                    resolve(request.result);
                } catch (error) {
                    reject(error);
                }
            };
            
            request.onerror = () => reject(request.error);
        });
    }
    
    async getFinanceRecord(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['financeRecords'], 'readonly');
            const store = transaction.objectStore('financeRecords');
            
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    async deleteFinanceRecord(id) {
        // Nejprve získáme záznam, abychom mohli provést správnou úpravu společného rozpočtu
        const record = await this.getFinanceRecord(id);
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['financeRecords'], 'readwrite');
            const store = transaction.objectStore('financeRecords');
            
            const request = store.delete(id);
            
            request.onsuccess = async () => {
                try {
                    // Úprava společného rozpočtu
                    if (record && record.currency === 'CZK') {
                        if (record.type === 'expense') {
                            await this.updateSharedBudget(record.amount);
                        } else if (record.type === 'income') {
                            await this.updateSharedBudget(-record.amount);
                        }
                    }
                    
                    // Aktualizace UI
                    await this.loadFinanceRecords();
                    await this.updateFinanceSummary();
                    
                    resolve();
                } catch (error) {
                    reject(error);
                }
            };
            
            request.onerror = () => reject(request.error);
        });
    }
    
    async getAllFinanceRecords() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['financeRecords'], 'readonly');
            const store = transaction.objectStore('financeRecords');
            
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    async loadFinanceRecords() {
        const tableBody = document.querySelector('#finance-records-table tbody');
        
        if (!tableBody) return;
        
        try {
            // Získání všech záznamů
            const records = await this.getAllFinanceRecords();
            
            // Seřazení podle data (nejnovější první)
            records.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            // Vyčištění tabulky
            tableBody.innerHTML = '';
            
            if (records.length === 0) {
                tableBody.innerHTML = '<tr class="empty-row"><td colspan="7">Žádné finanční záznamy k zobrazení</td></tr>';
                return;
            }
            
            // Naplnění tabulky
            records.forEach(record => {
                const date = new Date(record.date);
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${date.toLocaleDateString()}</td>
                    <td>${record.type === 'income' ? 'Příjem' : 'Výdaj'}</td>
                    <td>${this.formatCurrency(record.amount, record.currency)}</td>
                    <td>${record.category}</td>
                    <td>${record.description}</td>
                    <td>
                        <button class="btn action-btn edit-finance-btn" data-id="${record.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn delete-btn delete-finance-btn" data-id="${record.id}">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </td>
                `;
                
                tableBody.appendChild(row);
            });
            
            // Přidání posluchačů událostí pro tlačítka
            tableBody.querySelectorAll('.edit-finance-btn').forEach(button => {
                button.addEventListener('click', () => this.editFinanceRecord(button.getAttribute('data-id')));
            });
            
            tableBody.querySelectorAll('.delete-finance-btn').forEach(button => {
                button.addEventListener('click', () => this.deleteFinanceRecordHandler(button.getAttribute('data-id')));
            });
        } catch (error) {
            console.error('Chyba při načítání finančních záznamů:', error);
            tableBody.innerHTML = '<tr class="empty-row"><td colspan="7">Chyba při načítání finančních záznamů</td></tr>';
        }
    }
    
    async editFinanceRecord(id) {
        try {
            // Získání záznamu
            const record = await this.getFinanceRecord(id);
            
            if (!record) {
                this.showNotification('Záznam nebyl nalezen.', 'error');
                return;
            }
            
            // Naplnění formuláře
            document.getElementById('finance-id').value = record.id;
            document.getElementById('finance-type').value = record.type;
            document.getElementById('finance-amount').value = record.amount;
            document.getElementById('finance-currency').value = record.currency;
            document.getElementById('finance-category').value = record.category;
            document.getElementById('finance-date').value = new Date(record.date).toISOString().substring(0, 10);
            document.getElementById('finance-description').value = record.description || '';
            
            // Změna textu tlačítka
            document.getElementById('finance-submit').innerHTML = '<i class="fas fa-save"></i> Uložit změny';
            
            // Zobrazení tlačítka pro zrušení úpravy
            document.getElementById('finance-cancel').style.display = 'block';
            
            // Scrollování k formuláři
            document.querySelector('#finance-form').scrollIntoView({ behavior: 'smooth' });
        } catch (error) {
            console.error('Chyba při načítání záznamu:', error);
            this.showNotification('Chyba při načítání záznamu.', 'error');
        }
    }
    
    async deleteFinanceRecordHandler(id) {
        if (confirm('Opravdu chcete smazat tento finanční záznam?')) {
            try {
                await this.deleteFinanceRecord(id);
                this.showNotification('Finanční záznam byl smazán.', 'success');
            } catch (error) {
                console.error('Chyba při mazání záznamu:', error);
                this.showNotification('Chyba při mazání záznamu.', 'error');
            }
        }
    }
    
    async updateFinanceSummary() {
        try {
            // Získání všech záznamů
            const records = await this.getAllFinanceRecords();
            
            // Výpočet celkových příjmů a výdajů
            let totalIncomeCZK = 0;
            let totalIncomeEUR = 0;
            let totalIncomeUSD = 0;
            let totalExpensesCZK = 0;
            let totalExpensesEUR = 0;
            let totalExpensesUSD = 0;
            
            records.forEach(record => {
                if (record.type === 'income') {
                    if (record.currency === 'CZK') {
                        totalIncomeCZK += record.amount;
                    } else if (record.currency === 'EUR') {
                        totalIncomeEUR += record.amount;
                    } else if (record.currency === 'USD') {
                        totalIncomeUSD += record.amount;
                    }
                } else if (record.type === 'expense') {
                    if (record.currency === 'CZK') {
                        totalExpensesCZK += record.amount;
                    } else if (record.currency === 'EUR') {
                        totalExpensesEUR += record.amount;
                    } else if (record.currency === 'USD') {
                        totalExpensesUSD += record.amount;
                    }
                }
            });
            
            // Aktualizace UI
            document.getElementById('total-income-czk').textContent = this.formatCurrency(totalIncomeCZK);
            document.getElementById('total-income-eur').textContent = this.formatCurrency(totalIncomeEUR, 'EUR');
            document.getElementById('total-income-usd').textContent = this.formatCurrency(totalIncomeUSD, 'USD');
            document.getElementById('total-expenses-czk').textContent = this.formatCurrency(totalExpensesCZK);
            document.getElementById('total-expenses-eur').textContent = this.formatCurrency(totalExpensesEUR, 'EUR');
            document.getElementById('total-expenses-usd').textContent = this.formatCurrency(totalExpensesUSD, 'USD');
            
            // Aktualizace statistik
            document.querySelector('.stat-item.income .stat-value').textContent = this.formatCurrency(totalIncomeCZK);
            document.querySelector('.stat-item.expenses .stat-value').textContent = this.formatCurrency(totalExpensesCZK);
            
            // Aktualizace grafu
            this.updateFinanceChart(totalIncomeCZK, totalExpensesCZK);
        } catch (error) {
            console.error('Chyba při aktualizaci finančního souhrnu:', error);
        }
    }
    
    updateFinanceChart(income, expenses) {
        const chartCanvas = document.getElementById('finance-chart');
        
        if (!chartCanvas) return;
        
        // Kontrola, zda již existuje graf
        if (chartCanvas._chart) {
            chartCanvas._chart.destroy();
        }
        
        // Vytvoření grafu
        const ctx = chartCanvas.getContext('2d');
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
    }
    
    async checkRentPayment() {
        try {
            // Kontrola, zda je dnes den platby nájmu
            const today = new Date();
            
            if (today.getDate() === this.rentSettings.dueDay) {
                // Kontrola, zda již byl nájem zaplacen v tomto měsíci
                const rentPaidSetting = await this.getSetting(`rentPaid_${today.getFullYear()}_${today.getMonth() + 1}`);
                
                if (!rentPaidSetting || !rentPaidSetting.value) {
                    // Kontrola, zda je dostatek peněz
                    if (this.sharedBudget.balance >= this.rentSettings.amount) {
                        // Odečtení nájmu
                        await this.updateSharedBudget(-this.rentSettings.amount);
                        
                        // Označení nájmu jako zaplaceného
                        await this.saveSetting(`rentPaid_${today.getFullYear()}_${today.getMonth() + 1}`, true);
                        
                        // Aktualizace UI
                        document.getElementById('rent-status-value').innerHTML = '<i class="fas fa-check-circle"></i> Zaplaceno';
                        
                        // Informování uživatele
                        this.showNotification(`Nájem ve výši ${this.rentSettings.amount.toLocaleString()} Kč byl automaticky zaplacen.`, 'success');
                        
                        // Vytvoření finančního záznamu
                        const record = {
                            id: this.generateId(),
                            type: 'expense',
                            amount: this.rentSettings.amount,
                            currency: 'CZK',
                            category: 'Nájem',
                            date: today.toISOString(),
                            description: `Nájem za ${today.toLocaleString('cs-CZ', { month: 'long', year: 'numeric' })}`,
                            createdAt: new Date().toISOString()
                        };
                        
                        await this.saveFinanceRecord(record);
                    } else {
                        // Vytvoření dluhu
                        const debt = {
                            id: this.generateId(),
                            person: 'maru', // Výchozí osoba pro dluh nájmu
                            description: `Nájem za ${today.toLocaleString('cs-CZ', { month: 'long', year: 'numeric' })}`,
                            amount: this.rentSettings.amount,
                            currency: 'CZK',
                            date: today.toISOString(),
                            dueDate: new Date(today.getFullYear(), today.getMonth(), this.rentSettings.dueDay + 14).toISOString(),
                            creditor: 'Pronajímatel',
                            priority: 'high'
                        };
                        
                        await this.saveDebt(debt);
                        
                        // Aktualizace UI
                        document.getElementById('rent-status-value').innerHTML = '<i class="fas fa-exclamation-circle"></i> Nezaplaceno';
                        
                        // Informování uživatele
                        this.showNotification(`Nájem ve výši ${this.rentSettings.amount.toLocaleString()} Kč nemohl být zaplacen. Byl vytvořen dluh.`, 'warning');
                    }
                } else {
                    // Nájem již byl zaplacen
                    document.getElementById('rent-status-value').innerHTML = '<i class="fas fa-check-circle"></i> Zaplaceno';
                }
            }
            
            // Nastavení data příští platby
            const nextRentDate = new Date();
            
            if (nextRentDate.getDate() >= this.rentSettings.dueDay) {
                nextRentDate.setMonth(nextRentDate.getMonth() + 1);
            }
            
            nextRentDate.setDate(this.rentSettings.dueDay);
            
            document.getElementById('next-rent-date').textContent = nextRentDate.toLocaleDateString('cs-CZ');
        } catch (error) {
            console.error('Chyba při kontrole platby nájmu:', error);
        }
    }
    
    async saveDebt(debt) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['debts'], 'readwrite');
            const store = transaction.objectStore('debts');
            
            const request = store.put(debt);
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            request.onerror = () => reject(request.error);
        });
    }
    
    async checkDebtPayments() {
        try {
            // Kontrola, zda je přebytek
            if (this.sharedBudget.balance <= 0) return;
            
            // Získání aktivních dluhů
            const debts = await this.getAllDebts();
            const payments = await this.getAllPayments();
            
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
            let remainingBudget = this.sharedBudget.balance;
            
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
                        id: this.generateId(),
                        debtId: debt.id,
                        amount: paymentAmount,
                        date: new Date().toISOString(),
                        note: 'Automatická splátka ze společného rozpočtu'
                    };
                    
                    await this.savePayment(payment);
                    
                    // Odečtení z rozpočtu
                    await this.updateSharedBudget(-paymentAmount);
                    
                    // Aktualizace zbývajícího rozpočtu
                    remainingBudget -= paymentAmount;
                    
                    // Vytvoření finančního záznamu
                    const record = {
                        id: this.generateId(),
                        type: 'expense',
                        amount: paymentAmount,
                        currency: 'CZK',
                        category: 'Splátka dluhu',
                        date: new Date().toISOString(),
                        description: `Splátka dluhu: ${debt.description}`,
                        createdAt: new Date().toISOString()
                    };
                    
                    await this.saveFinanceRecord(record);
                    
                    // Informování uživatele
                    this.showNotification(`Automatická splátka dluhu "${debt.description}" ve výši ${paymentAmount.toLocaleString()} Kč.`, 'success');
                }
            }
        } catch (error) {
            console.error('Chyba při kontrole splácení dluhů:', error);
        }
    }
    
    async getAllDebts() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['debts'], 'readonly');
            const store = transaction.objectStore('debts');
            
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    async getAllPayments() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['debtPayments'], 'readonly');
            const store = transaction.objectStore('debtPayments');
            
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    async savePayment(payment) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['debtPayments'], 'readwrite');
            const store = transaction.objectStore('debtPayments');
            
            const request = store.put(payment);
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            request.onerror = () => reject(request.error);
        });
    }
    
    initCharts() {
        // Inicializace grafů
        this.updateFinanceChart(0, 0);
    }
    
    formatCurrency(amount, currency = 'CZK') {
        return `${amount.toLocaleString()} ${currency}`;
    }
    
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }
    
    showNotification(message, type = 'info') {
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
}

// Export třídy
window.FinanceManager = FinanceManager;
