// Oprava navigace a výběru záložek
function initNavigation() {
    const navLinks = document.querySelectorAll('.main-nav a');
    const sections = document.querySelectorAll('main > section');
    const menuToggle = document.getElementById('toggle-menu');
    
    // Přepínání mezi sekcemi
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetSection = this.getAttribute('data-section');
            
            // Odstranění aktivní třídy ze všech odkazů
            navLinks.forEach(link => link.classList.remove('active'));
            
            // Přidání aktivní třídy na aktuální odkaz
            this.classList.add('active');
            
            // Skrytí všech sekcí
            sections.forEach(section => section.classList.remove('active'));
            
            // Zobrazení cílové sekce
            document.getElementById(targetSection).classList.add('active');
            
            // Zavření menu na mobilních zařízeních
            if (window.innerWidth < 768) {
                document.querySelector('.main-nav').classList.remove('show');
            }
        });
    });
    
    // Přepínání menu na mobilních zařízeních
    if (menuToggle) {
        menuToggle.addEventListener('click', function() {
            document.querySelector('.main-nav').classList.toggle('show');
        });
    }
    
    // Zavření menu při kliknutí mimo
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.main-nav') && !e.target.closest('#toggle-menu')) {
            document.querySelector('.main-nav').classList.remove('show');
        }
    });
}

// Oprava časovače
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

// Oprava výběru osoby
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
            if (personDropdown) {
                personDropdown.classList.remove('show');
            }
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
                const selectedPerson = document.getElementById('selected-person');
                const selectedRate = document.getElementById('selected-rate');
                
                if (selectedPerson) {
                    selectedPerson.textContent = person.charAt(0).toUpperCase() + person.slice(1);
                }
                
                if (selectedRate) {
                    selectedRate.textContent = rate + ' Kč/h';
                }
                
                if (personDropdown) {
                    personDropdown.classList.remove('show');
                }
                
                // Pokud běží časovač, aktualizovat výdělek
                if (timerState.running) {
                    updateEarningsDisplay();
                }
            });
        });
    }
}

// Zajištění, že funkce jsou dostupné globálně
window.initNavigation = initNavigation;
window.initTimer = initTimer;
window.initPersonSelector = initPersonSelector;

// Přepsání původních funkcí v app.js
document.addEventListener('DOMContentLoaded', function() {
    // Přepsání původních funkcí
    if (window.originalInitNavigation) {
        window.initNavigation = window.originalInitNavigation;
    }
    
    if (window.originalInitTimer) {
        window.initTimer = window.originalInitTimer;
    }
    
    if (window.originalInitPersonSelector) {
        window.initPersonSelector = window.originalInitPersonSelector;
    }
    
    console.log('Opravy funkcí navigace a časovače byly načteny');
});
