// Debt Manager Component
class DebtManager {
    constructor() {
        this.db = null;
        this.debts = [];
        this.payments = [];
    }

    async init(database) {
        this.db = database;
        
        // Inicializace formuláře pro přidání dluhu
        this.initDebtForm();
        
        // Inicializace formuláře pro přidání splátky
        this.initPaymentForm();
        
        // Načtení dluhů
        await this.loadDebts();
        
        console.log('Debt Manager initialized');
    }
    
    initDebtForm() {
        const debtForm = document.getElementById('debt-form');
        const cancelEditButton = document.getElementById('cancel-edit-debt');
        
        if (debtForm) {
            debtForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                try {
                    // Získání hodnot z formuláře
                    const id = document.getElementById('edit-debt-id').value || this.generateId();
                    const person = document.getElementById('debt-person').value;
                    const description = document.getElementById('debt-description').value;
                    const amount = parseFloat(document.getElementById('debt-amount').value);
                    const currency = document.getElementById('debt-currency').value;
                    const date = document.getElementById('debt-date').value;
                    const dueDate = document.getElementById('debt-due-date').value;
                    const creditor = document.getElementById('debt-creditor').value;
                    const priority = document.getElementById('debt-priority').value;
                    
                    // Validace
                    if (!amount || isNaN(amount) || amount <= 0) {
                        this.showNotification('Zadejte platnou částku.', 'warning');
                        return;
                    }
                    
                    if (!date) {
                        this.showNotification('Zadejte datum.', 'warning');
                        return;
                    }
                    
                    if (!dueDate) {
                        this.showNotification('Zadejte datum splatnosti.', 'warning');
                        return;
                    }
                    
                    // Vytvoření záznamu
                    const debt = {
                        id,
                        person,
                        description,
                        amount,
                        currency,
                        date: new Date(date).toISOString(),
                        dueDate: new Date(dueDate).toISOString(),
                        creditor,
                        priority,
                        createdAt: new Date().toISOString()
                    };
                    
                    // Uložení záznamu
                    await this.saveDebt(debt);
                    
                    // Resetování formuláře
                    debtForm.reset();
                    document.getElementById('edit-debt-id').value = '';
                    document.getElementById('save-debt-button').innerHTML = '<i class="fas fa-plus"></i> Přidat dluh';
                    
                    if (cancelEditButton) {
                        cancelEditButton.style.display = 'none';
                    }
                    
                    // Nastavení dnešního data
                    document.getElementById('debt-date').value = new Date().toISOString().substring(0, 10);
                    
                    // Výpočet výchozího data splatnosti (za 30 dní)
                    const defaultDueDate = new Date();
                    defaultDueDate.setDate(defaultDueDate.getDate() + 30);
                    document.getElementById('debt-due-date').value = defaultDueDate.toISOString().substring(0, 10);
                    
                    // Informování uživatele
                    this.showNotification('Dluh byl uložen.', 'success');
                } catch (error) {
                    console.error('Chyba při ukládání dluhu:', error);
                    this.showNotification('Chyba při ukládání dluhu.', 'error');
                }
            });
        }
        
        if (cancelEditButton) {
            cancelEditButton.addEventListener('click', () => {
                // Resetování formuláře
                debtForm.reset();
                document.getElementById('edit-debt-id').value = '';
                document.getElementById('save-debt-button').innerHTML = '<i class="fas fa-plus"></i> Přidat dluh';
                cancelEditButton.style.display = 'none';
                
                // Nastavení dnešního data
                document.getElementById('debt-date').value = new Date().toISOString().substring(0, 10);
                
                // Výpočet výchozího data splatnosti (za 30 dní)
                const defaultDueDate = new Date();
                defaultDueDate.setDate(defaultDueDate.getDate() + 30);
                document.getElementById('debt-due-date').value = defaultDueDate.toISOString().substring(0, 10);
            });
        }
        
        // Nastavení dnešního data
        const dateInput = document.getElementById('debt-date');
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().substring(0, 10);
        }
        
        // Výpočet výchozího data splatnosti (za 30 dní)
        const dueDateInput = document.getElementById('debt-due-date');
        if (dueDateInput && !dueDateInput.value) {
            const defaultDueDate = new Date();
            defaultDueDate.setDate(defaultDueDate.getDate() + 30);
            dueDateInput.value = defaultDueDate.toISOString().substring(0, 10);
        }
    }
    
    initPaymentForm() {
        const paymentForm = document.getElementById('payment-form');
        
        if (paymentForm) {
            paymentForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                try {
                    // Získání hodnot z formuláře
                    const debtId = document.getElementById('payment-debt-id').value;
                    const amount = parseFloat(document.getElementById('payment-amount').value);
                    const date = document.getElementById('payment-date').value;
                    const note = document.getElementById('payment-note').value;
                    
                    // Validace
                    if (!debtId) {
                        this.showNotification('Vyberte dluh.', 'warning');
                        return;
                    }
                    
                    if (!amount || isNaN(amount) || amount <= 0) {
                        this.showNotification('Zadejte platnou částku.', 'warning');
                        return;
                    }
                    
                    if (!date) {
                        this.showNotification('Zadejte datum.', 'warning');
                        return;
                    }
                    
                    // Kontrola, zda částka nepřesahuje zbývající dluh
                    const debt = await this.getDebt(debtId);
                    const debtPayments = this.payments.filter(payment => payment.debtId === debtId);
                    const totalPaid = debtPayments.reduce((sum, payment) => sum + payment.amount, 0);
                    const remaining = debt.amount - totalPaid;
                    
                    if (amount > remaining) {
                        this.showNotification(`Částka přesahuje zbývající dluh (${this.formatCurrency(remaining, debt.currency)}).`, 'warning');
                        return;
                    }
                    
                    // Vytvoření záznamu
                    const payment = {
                        id: this.generateId(),
                        debtId,
                        amount,
                        date: new Date(date).toISOString(),
                        note,
                        createdAt: new Date().toISOString()
                    };
                    
                    // Uložení záznamu
                    await this.savePayment(payment);
                    
                    // Resetování formuláře
                    paymentForm.reset();
                    
                    // Nastavení dnešního data
                    document.getElementById('payment-date').value = new Date().toISOString().substring(0, 10);
                    
                    // Informování uživatele
                    this.showNotification('Splátka byla uložena.', 'success');
                    
                    // Pokud je dluh v CZK, odečíst ze společného rozpočtu
                    if (debt.currency === 'CZK') {
                        // Vytvoření finančního záznamu
                        const record = {
                            id: this.generateId(),
                            type: 'expense',
                            amount,
                            currency: 'CZK',
                            category: 'Splátka dluhu',
                            date: new Date(date).toISOString(),
                            description: `Splátka dluhu: ${debt.description}`,
                            createdAt: new Date().toISOString()
                        };
                        
                        // Uložení finančního záznamu
                        if (window.financeManager) {
                            await window.financeManager.saveFinanceRecord(record);
                        }
                    }
                } catch (error) {
                    console.error('Chyba při ukládání splátky:', error);
                    this.showNotification('Chyba při ukládání splátky.', 'error');
                }
            });
        }
        
        // Nastavení dnešního data
        const dateInput = document.getElementById('payment-date');
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().substring(0, 10);
        }
    }
    
    async loadDebts() {
        try {
            // Načtení dluhů
            this.debts = await this.getAllDebts();
            
            // Načtení plateb
            this.payments = await this.getAllPayments();
            
            // Aktualizace UI
            this.updateDebtsUI();
            
            // Aktualizace select elementu pro splátky
            this.updatePaymentDebtSelect();
            
            // Aktualizace grafu dluhů
            this.updateDebtChart();
        } catch (error) {
            console.error('Chyba při načítání dluhů:', error);
            this.showNotification('Chyba při načítání dluhů.', 'error');
        }
    }
    
    updateDebtsUI() {
        const debtsList = document.getElementById('debts-list');
        
        if (!debtsList) return;
        
        // Vyčištění seznamu
        debtsList.innerHTML = '';
        
        if (this.debts.length === 0) {
            debtsList.innerHTML = '<div class="empty-placeholder">Žádné dluhy k zobrazení. Přidejte dluh níže.</div>';
            return;
        }
        
        // Seřazení dluhů podle priority a data splatnosti
        const sortedDebts = [...this.debts].sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
            
            if (priorityDiff !== 0) return priorityDiff;
            
            return new Date(a.dueDate) - new Date(b.dueDate);
        });
        
        // Vytvoření karet pro dluhy
        sortedDebts.forEach(debt => {
            // Výpočet zbývající částky
            const debtPayments = this.payments.filter(payment => payment.debtId === debt.id);
            const totalPaid = debtPayments.reduce((sum, payment) => sum + payment.amount, 0);
            const remaining = debt.amount - totalPaid;
            const isPaid = remaining <= 0;
            
            // Vytvoření karty
            const debtCard = document.createElement('div');
            debtCard.className = `debt-card ${isPaid ? 'paid' : ''}`;
            debtCard.dataset.id = debt.id;
            
            // Výpočet procenta splacení
            const paymentPercentage = Math.min((totalPaid / debt.amount) * 100, 100);
            
            // Výpočet zbývajících dnů
            const dueDate = new Date(debt.dueDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const daysRemaining = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
            
            // Určení stavu
            let statusClass = 'status-ok';
            let statusText = 'V pořádku';
            
            if (isPaid) {
                statusClass = 'status-paid';
                statusText = 'Splaceno';
            } else if (daysRemaining < 0) {
                statusClass = 'status-overdue';
                statusText = 'Po splatnosti';
            } else if (daysRemaining <= 7) {
                statusClass = 'status-warning';
                statusText = 'Blíží se splatnost';
            }
            
            debtCard.innerHTML = `
                <div class="debt-header">
                    <div class="debt-title">${debt.description}</div>
                    <div class="debt-status ${statusClass}">${statusText}</div>
                </div>
                <div class="debt-details">
                    <div class="debt-info">
                        <div class="debt-person">
                            <i class="fas fa-user"></i> ${debt.person === 'maru' ? 'Maru' : 'Marty'}
                        </div>
                        <div class="debt-creditor">
                            <i class="fas fa-handshake"></i> ${debt.creditor}
                        </div>
                        <div class="debt-dates">
                            <div class="debt-created">
                                <i class="fas fa-calendar-plus"></i> Vytvořeno: ${new Date(debt.date).toLocaleDateString()}
                            </div>
                            <div class="debt-due">
                                <i class="fas fa-calendar-times"></i> Splatnost: ${new Date(debt.dueDate).toLocaleDateString()}
                                ${daysRemaining > 0 && !isPaid ? `(zbývá ${daysRemaining} dní)` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="debt-amount-info">
                        <div class="debt-amount">
                            <div class="debt-amount-label">Celkem:</div>
                            <div class="debt-amount-value">${this.formatCurrency(debt.amount, debt.currency)}</div>
                        </div>
                        <div class="debt-paid">
                            <div class="debt-amount-label">Splaceno:</div>
                            <div class="debt-amount-value">${this.formatCurrency(totalPaid, debt.currency)}</div>
                        </div>
                        <div class="debt-remaining">
                            <div class="debt-amount-label">Zbývá:</div>
                            <div class="debt-amount-value">${this.formatCurrency(remaining, debt.currency)}</div>
                        </div>
                    </div>
                </div>
                <div class="debt-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${paymentPercentage}%"></div>
                    </div>
                    <div class="progress-text">${paymentPercentage.toFixed(0)}% splaceno</div>
                </div>
                <div class="debt-actions">
                    <button class="btn action-btn show-payments-btn" data-id="${debt.id}">
                        <i class="fas fa-history"></i> Historie splátek
                    </button>
                    <button class="btn action-btn add-payment-btn" data-id="${debt.id}" ${isPaid ? 'disabled' : ''}>
                        <i class="fas fa-plus"></i> Přidat splátku
                    </button>
                    <button class="btn action-btn edit-debt-btn" data-id="${debt.id}">
                        <i class="fas fa-edit"></i> Upravit
                    </button>
                    <button class="btn delete-btn delete-debt-btn" data-id="${debt.id}">
                        <i class="fas fa-trash-alt"></i> Smazat
                    </button>
                </div>
                <div class="debt-payments-history" id="payments-history-${debt.id}" style="display: none;">
                    <h4>Historie splátek</h4>
                    ${this.renderPaymentsHistory(debtPayments)}
                </div>
            `;
            
            debtsList.appendChild(debtCard);
        });
        
        // Přidání posluchačů událostí
        debtsList.querySelectorAll('.show-payments-btn').forEach(button => {
            button.addEventListener('click', () => {
                const debtId = button.getAttribute('data-id');
                const paymentsHistory = document.getElementById(`payments-history-${debtId}`);
                
                if (paymentsHistory) {
                    paymentsHistory.style.display = paymentsHistory.style.display === 'none' ? 'block' : 'none';
                    button.innerHTML = paymentsHistory.style.display === 'none' ? 
                        '<i class="fas fa-history"></i> Historie splátek' : 
                        '<i class="fas fa-times"></i> Skrýt historii';
                }
            });
        });
        
        debtsList.querySelectorAll('.add-payment-btn').forEach(button => {
            button.addEventListener('click', () => {
                const debtId = button.getAttribute('data-id');
                
                // Nastavení vybraného dluhu ve formuláři pro splátku
                const paymentDebtSelect = document.getElementById('payment-debt-id');
                if (paymentDebtSelect) {
                    paymentDebtSelect.value = debtId;
                }
                
                // Scrollování k formuláři pro splátku
                document.getElementById('payment-form').scrollIntoView({ behavior: 'smooth' });
            });
        });
        
        debtsList.querySelectorAll('.edit-debt-btn').forEach(button => {
            button.addEventListener('click', () => this.editDebt(button.getAttribute('data-id')));
        });
        
        debtsList.querySelectorAll('.delete-debt-btn').forEach(button => {
            button.addEventListener('click', () => this.deleteDebtHandler(button.getAttribute('data-id')));
        });
    }
    
    renderPaymentsHistory(payments) {
        if (payments.length === 0) {
            return '<div class="empty-placeholder">Žádné splátky k zobrazení.</div>';
        }
        
        // Seřazení plateb podle data (nejnovější první)
        const sortedPayments = [...payments].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        let html = '<div class="payments-table-container"><table class="payments-table">';
        html += '<thead><tr><th>Datum</th><th>Částka</th><th>Poznámka</th></tr></thead><tbody>';
        
        sortedPayments.forEach(payment => {
            html += `
                <tr>
                    <td>${new Date(payment.date).toLocaleDateString()}</td>
                    <td>${this.formatCurrency(payment.amount)}</td>
                    <td>${payment.note || '-'}</td>
                </tr>
            `;
        });
        
        html += '</tbody></table></div>';
        
        return html;
    }
    
    updatePaymentDebtSelect() {
        const paymentDebtSelect = document.getElementById('payment-debt-id');
        
        if (!paymentDebtSelect) return;
        
        // Zachování první možnosti (placeholder)
        const firstOption = paymentDebtSelect.options[0];
        paymentDebtSelect.innerHTML = '';
        paymentDebtSelect.appendChild(firstOption);
        
        // Filtrování dluhů, které mají zbývající částku k zaplacení
        const activeDebts = this.debts.filter(debt => {
            const debtPayments = this.payments.filter(payment => payment.debtId === debt.id);
            const totalPaid = debtPayments.reduce((sum, payment) => sum + payment.amount, 0);
            return totalPaid < debt.amount;
        });
        
        if (activeDebts.length > 0) {
            activeDebts.forEach(debt => {
                const option = document.createElement('option');
                option.value = debt.id;
                
                // Výpočet zbývající částky
                const debtPayments = this.payments.filter(payment => payment.debtId === debt.id);
                const totalPaid = debtPayments.reduce((sum, payment) => sum + payment.amount, 0);
                const remaining = debt.amount - totalPaid;
                
                option.textContent = `${debt.description} (${debt.person === 'maru' ? 'Maru' : 'Marty'}) - ${this.formatCurrency(remaining, debt.currency)}`;
                paymentDebtSelect.appendChild(option);
            });
        } else {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "-- Žádné aktivní dluhy --";
            option.disabled = true;
            paymentDebtSelect.appendChild(option);
        }
    }
    
    updateDebtChart() {
        const chartCanvas = document.getElementById('debt-chart');
        
        if (!chartCanvas) return;
        
        // Výpočet celkových dluhů podle měny
        const totalDebtsByCurrency = {};
        const totalPaidByCurrency = {};
        
        this.debts.forEach(debt => {
            if (!totalDebtsByCurrency[debt.currency]) {
                totalDebtsByCurrency[debt.currency] = 0;
                totalPaidByCurrency[debt.currency] = 0;
            }
            
            totalDebtsByCurrency[debt.currency] += debt.amount;
            
            // Výpočet splacené částky
            const debtPayments = this.payments.filter(payment => payment.debtId === debt.id);
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
    }
    
    async editDebt(id) {
        try {
            // Získání dluhu
            const debt = await this.getDebt(id);
            
            if (!debt) {
                this.showNotification('Dluh nebyl nalezen.', 'error');
                return;
            }
            
            // Naplnění formuláře
            document.getElementById('edit-debt-id').value = debt.id;
            document.getElementById('debt-person').value = debt.person;
            document.getElementById('debt-description').value = debt.description;
            document.getElementById('debt-amount').value = debt.amount;
            document.getElementById('debt-currency').value = debt.currency;
            document.getElementById('debt-date').value = new Date(debt.date).toISOString().substring(0, 10);
            document.getElementById('debt-due-date').value = new Date(debt.dueDate).toISOString().substring(0, 10);
            document.getElementById('debt-creditor').value = debt.creditor;
            document.getElementById('debt-priority').value = debt.priority;
            
            // Změna textu tlačítka
            document.getElementById('save-debt-button').innerHTML = '<i class="fas fa-save"></i> Uložit změny';
            
            // Zobrazení tlačítka pro zrušení úpravy
            document.getElementById('cancel-edit-debt').style.display = 'block';
            
            // Scrollování k formuláři
            document.getElementById('debt-form').scrollIntoView({ behavior: 'smooth' });
        } catch (error) {
            console.error('Chyba při načítání dluhu:', error);
            this.showNotification('Chyba při načítání dluhu.', 'error');
        }
    }
    
    async deleteDebtHandler(id) {
        if (confirm('Opravdu chcete smazat tento dluh? Budou smazány i všechny související splátky.')) {
            try {
                await this.deleteDebt(id);
                this.showNotification('Dluh byl smazán.', 'success');
            } catch (error) {
                console.error('Chyba při mazání dluhu:', error);
                this.showNotification('Chyba při mazání dluhu.', 'error');
            }
        }
    }
    
    async saveDebt(debt) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['debts'], 'readwrite');
            const store = transaction.objectStore('debts');
            
            const request = store.put(debt);
            
            request.onsuccess = async () => {
                try {
                    // Aktualizace lokálního pole
                    const index = this.debts.findIndex(d => d.id === debt.id);
                    
                    if (index !== -1) {
                        this.debts[index] = debt;
                    } else {
                        this.debts.push(debt);
                    }
                    
                    // Aktualizace UI
                    this.updateDebtsUI();
                    this.updatePaymentDebtSelect();
                    this.updateDebtChart();
                    
                    resolve(request.result);
                } catch (error) {
                    reject(error);
                }
            };
            
            request.onerror = () => reject(request.error);
        });
    }
    
    async getDebt(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['debts'], 'readonly');
            const store = transaction.objectStore('debts');
            
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    async deleteDebt(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['debts', 'debtPayments'], 'readwrite');
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
                    
                    // Aktualizace lokálního pole dluhů
                    this.debts = this.debts.filter(debt => debt.id !== id);
                    
                    if (paymentIds.length === 0) {
                        // Aktualizace UI
                        this.updateDebtsUI();
                        this.updatePaymentDebtSelect();
                        this.updateDebtChart();
                        
                        resolve();
                        return;
                    }
                    
                    paymentIds.forEach(paymentId => {
                        const deleteRequest = paymentStore.delete(paymentId);
                        
                        deleteRequest.onsuccess = () => {
                            deletedCount++;
                            
                            // Aktualizace lokálního pole plateb
                            this.payments = this.payments.filter(payment => payment.id !== paymentId);
                            
                            if (deletedCount === paymentIds.length) {
                                // Aktualizace UI
                                this.updateDebtsUI();
                                this.updatePaymentDebtSelect();
                                this.updateDebtChart();
                                
                                resolve();
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
    
    async getAllDebts() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['debts'], 'readonly');
            const store = transaction.objectStore('debts');
            
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
            
            request.onsuccess = async () => {
                try {
                    // Aktualizace lokálního pole
                    const index = this.payments.findIndex(p => p.id === payment.id);
                    
                    if (index !== -1) {
                        this.payments[index] = payment;
                    } else {
                        this.payments.push(payment);
                    }
                    
                    // Aktualizace UI
                    this.updateDebtsUI();
                    this.updatePaymentDebtSelect();
                    this.updateDebtChart();
                    
                    resolve(request.result);
                } catch (error) {
                    reject(error);
                }
            };
            
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
window.DebtManager = DebtManager;
