// =================================================================
// 1. ЗАГАЛЬНІ ЕЛЕМЕНТИ ТА ФУНКЦІЇ
// =================================================================

// Допоміжна функція для додавання до кошика
function addToCart(carId) {
   console.log(`Спроба додати carId: ${carId} до кошика.`); // Додайте цю діагностику
    
    fetch('http://localhost:5000/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Важливо: body повинен відправляти car_id
        body: JSON.stringify({ user_id: 1, car_id: carId }) 
    })
    .then(response => {
        // Перевірка статусу відповіді
        if (!response.ok) {
            // Якщо сервер повернув 400 або 500, переходимо до обробки помилок
            return response.json().then(err => { throw new Error(err.message || `Помилка: ${response.status}`) });
        }
        return response.json();
    })
    .then(data => {
        alert(data.message); // Це повідомлення про успіх
        // Додатково: оновіть іконку кошика або лічильник, якщо він є
    })
    .catch(error => {
        console.error('Помилка додавання до кошика:', error);
        alert('Помилка додавання: ' + error.message); // Виводимо деталі помилки
    });
}
function toggleDetails(carId) {
    const detailsContainer = document.getElementById(`details-${carId}`);
    
    // Перевіряємо, чи контейнер існує
    if (!detailsContainer) {
        console.error(`Контейнер деталей для carId ${carId} не знайдено.`);
        return;
    }
    
    // Якщо контейнер зараз прихований, показуємо його і завантажуємо дані
    if (detailsContainer.style.display === 'none') {
        
        // 1. Змінюємо текст під час завантаження
        detailsContainer.innerHTML = 'Завантаження опису...';
        detailsContainer.style.display = 'block';
        
        // 2. Робимо запит до Flask для отримання повних даних про авто
        fetch(`http://localhost:5000/cars/${carId}`)
            .then(response => {
                if (!response.ok) throw new Error(`Помилка: ${response.status}`);
                return response.json();
            })
            .then(car => {
                // ПРИПУЩЕННЯ: у базі даних є поле 'description'
               const description = car.description || "На жаль, детальний опис для цієї моделі відсутній."; 
                const detailedInfo = `
                    <div class="alert alert-light mt-2 p-3" role="alert" style="border: 1px solid #ccc;">
                        <strong>Технічні характеристики:</strong>
                        <ul class="list-unstyled mb-0 small">
                            <li><strong>Двигун:</strong> ${car.engine || 'Н/Д'}</li>
                            <li><strong>Потужність:</strong> ${car.horsepower || 'Н/Д'} к.с.</li>
                            <li><strong>Трансмісія:</strong> ${car.transmission || 'Н/Д'}</li>
                            <li><strong>Пробіг:</strong> ${car.mileage ? car.mileage.toLocaleString('uk-UA') + ' км' : 'Н/Д'}</li>
                            <li><strong>Колір:</strong> ${car.color || 'Н/Д'}</li>
                        </ul>
                    </div>
                    <p class="text-secondary small">${description}</p>
                `;
                
                detailsContainer.innerHTML = detailedInfo;
            })
            .catch(error => {
                console.error('Помилка завантаження деталей:', error);
                detailsContainer.innerHTML = 'Не вдалося завантажити опис.';
            });
            
    } else {
        // Якщо контейнер видимий, приховуємо його
        detailsContainer.style.display = 'none';
    }
}


//  ФУНКЦІЇ КОШИКА ТА ПРИДБАННЯ


// Функція для завантаження та відображення кошика
function loadCart() {
    const container = document.getElementById('cart-items-container');
    const summaryCard = document.getElementById('cart-summary');
    const totalDisplay = document.getElementById('cart-total-display');
    const loadingMessage = document.getElementById('loading-message');

    if (!container) return; // Вихід, якщо ми не на сторінці cart.html

    loadingMessage.textContent = 'Завантаження кошика...';
    summaryCard.style.display = 'none';
    container.innerHTML = '';
    let totalPrice = 0;
    const userId = 1; // Тестовий користувач

    fetch(`http://localhost:5000/cart/${userId}`) // Використовуємо маршрут з user_id
        .then(response => response.json())
        .then(items => {
            if (items.length === 0) {
                loadingMessage.textContent = 'Ваш кошик порожній.';
                return;
            }
            
            loadingMessage.style.display = 'none';

            items.forEach(item => {
                const car = item.car_details;
                // Розрахунок суми з урахуванням кількості (quantity)
                const itemTotal = car.price * item.quantity; 
                totalPrice += itemTotal;
                
                const cardHtml = `
                    <div class="col-12 mb-3">
                        <div class="card shadow-sm">
                            <div class="card-body d-flex align-items-center">
                                <img src="${car.image_url}" alt="${car.brand} ${car.model}" style="width: 100px; height: 70px; object-fit: cover;" class="me-3 rounded">
                                <div class="flex-grow-1">
                                    <h5 class="card-title mb-1">${car.brand} ${car.model} (${car.year})</h5>
                                    <p class="card-text mb-0">Кількість: <span class="fw-bold">${item.quantity}</span> x $${car.price.toLocaleString('en-US')}</p>
                                    <p class="card-text text-success fw-bold">Сума: $${itemTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                </div>
                                <button class="btn btn-danger btn-sm" onclick="removeFromCart(${item.id})">
                                    <i class="fas fa-trash"></i> Видалити
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                container.innerHTML += cardHtml;
            });

            // Оновлення підсумку
            totalDisplay.textContent = `Загальна сума: $${totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
            summaryCard.style.display = 'block';

        })
        .catch(error => {
            console.error('Помилка завантаження кошика:', error);
            loadingMessage.textContent = 'Помилка завантаження кошика.';
        });
}


// Функція для видалення елемента з кошика
function removeFromCart(itemId) {
    if (!confirm('Ви впевнені, що хочете видалити це авто з кошика?')) {
        return;
    }

    fetch(`http://localhost:5000/cart/${itemId}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message);
        loadCart(); // Перезавантажуємо кошик після видалення
    })
    .catch(error => {
        console.error('Помилка видалення:', error);
        alert('Помилка видалення товару.');
    });
}

// Функція для оформлення замовлення (Придбати)
function checkoutOrder() {
    if (!confirm('Ви підтверджуєте оформлення замовлення? Усі товари в кошику будуть придбані та видалені.')) {
        return;
    }

    fetch('http://localhost:5000/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message + ' ' + (data.total || ''));
        loadCart(); // Очищаємо/оновлюємо кошик
    })
    .catch(error => {
        console.error('Помилка оформлення:', error);
        alert('Помилка при оформленні замовлення.');
    });
}

// Допоміжна функція для визначення параметрів фільтрації
function getCountryAndBrand() {
    const urlParams = new URLSearchParams(window.location.search);
    const brand = urlParams.get('brand');
    const path = window.location.pathname;

    let country = '';
    // Визначаємо країну за назвою HTML-файлу
    if (path.includes('usa.html')) country = 'USA';
    else if (path.includes('germany.html')) country = 'Germany';
    else if (path.includes('japan.html')) country = 'Japan';

    return { country, brand };
}

function toggleSearchBox() {
    const searchBox = document.getElementById('search-box');
    const searchIcon = document.getElementById('search-icon');
    const searchInput = document.getElementById('search-input');

    // Перемикаємо клас 'active' для видимості та анімації
    searchBox.classList.toggle('active');

    if (searchBox.classList.contains('active')) {
        // Якщо розгорнуто, приховуємо іконку лупи та фокусуємо поле вводу
        searchIcon.style.display = 'none';
        searchInput.focus();
        // Показуємо кнопку пошуку
        const searchBtn = document.getElementById('search-btn');
        if (searchBtn) searchBtn.style.display = 'inline-block';
    } else {
        // Якщо згорнуто, показуємо іконку лупи та очищуємо поле
        searchIcon.style.display = 'block';
        searchInput.value = '';
        // Приховуємо кнопку пошуку
        const searchBtn = document.getElementById('search-btn');
        if (searchBtn) searchBtn.style.display = 'none';
    }
}

// =================================================================
// 2. ЛОГІКА ДЛЯ СТОРІНОК КАТАЛОГУ (4 в ряд - usa.html, germany.html, etc.)
// =================================================================

const catalogContainer = document.getElementById('car-models-container');

function generateCatalogCard(car) {
    // Видалено клас h-100. Висоту контролюємо через min-height.
    return `
        <div class="col-lg-3 col-md-4 col-sm-6 mb-4">
            <div class="card product shadow-sm d-flex flex-column" style="min-height: 420px;"> 
                
                <img src="${car.image_url || 'https://via.placeholder.com/200'}" 
                     alt="${car.brand} ${car.model}" 
                     class="card-img-top" 
                     style="height: 200px; object-fit: cover;"> 

                <div class="card-body d-flex flex-column">
                    <h5 class="card-title">${car.brand} ${car.model}</h5>
                    
                    <p class="card-text mb-1" style="color: black;">Рік: ${car.year}</p> 
                    <p class="card-text mb-2" style="color: black;">Ціна: $${car.price.toLocaleString('uk-UA')}</p> 
                    
                    <div id="details-content-${car.id}" style="display: none; margin-top: 10px; margin-bottom: 10px; color: #333; font-size: 0.9em;">
                        </div>
                   
                    <div class="d-flex justify-content-between mt-auto">
                        <button class="btn btn-info btn-sm flex-fill me-2" onclick="toggleDetails(${car.id}, this)">
                            Деталі
                        </button>
                        
                        <button class="btn btn-success btn-sm flex-fill" onclick="addToCart(${car.id})">
                            Кошик
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function toggleDetails(carId, buttonElement) {
    const detailsContainer = document.getElementById(`details-content-${carId}`);
    
    if (!detailsContainer) return; 

    // 1. Якщо контейнер видимий, приховуємо його
    if (detailsContainer.style.display === 'block') {
        detailsContainer.style.display = 'none';
        buttonElement.textContent = 'Деталі';
        return;
    }
    
    // 2. Відкриваємо поточний контейнер
    detailsContainer.style.display = 'block';
    buttonElement.textContent = 'Приховати';

    // 3. Якщо дані вже завантажені (перший клік), просто показуємо їх
    if (detailsContainer.getAttribute('data-loaded') === 'true') {
        return; 
    }

    // 4. Завантаження даних з Flask (відбувається лише один раз)
    detailsContainer.innerHTML = '<span class="text-secondary small">Завантаження опису...</span>';
    
    fetch(`http://localhost:5000/cars/${carId}`)
        .then(response => response.json())
        .then(car => {
            const description = car.description || "Детальний опис відсутній."; 
            const detailedInfo = `
                <div class="alert alert-light p-2 mb-2" role="alert" style="border: 1px solid #eee;">
                    <ul class="list-unstyled mb-0 small">
                        <li><strong>Двигун:</strong> ${car.engine || 'Н/Д'}</li>
                        <li><strong>Потужність:</strong> ${car.horsepower ? car.horsepower + ' к.с.' : 'Н/Д'}</li>
                        <li><strong>Трансмісія:</b> ${car.transmission || 'Н/Д'}</li>
                        <li><strong>Пробіг:</strong> ${car.mileage ? car.mileage.toLocaleString('uk-UA') + ' км' : 'Н/Д'}</li>
                        <li><strong>Колір:</strong> ${car.color || 'Н/Д'}</li>
                    </ul>
                </div>
                <p class="text-secondary small">${description}</p>
            `;
            
            detailsContainer.innerHTML = detailedInfo;
            detailsContainer.setAttribute('data-loaded', 'true');
        })
        .catch(error => {
            console.error('Помилка завантаження деталей:', error);
            detailsContainer.innerHTML = 'Не вдалося завантажити опис.';
        });
}

function loadCatalog() {
    if (!catalogContainer) return;

    const { country, brand } = getCountryAndBrand();
    if (!country) return;

    // Формування URL для бекенду з фільтрами
    let apiUrl = `http://localhost:5000/cars?country=${country}`;
    let titleText = `Каталог Моделей ${country}`;
    
    if (brand) {
        apiUrl += `&brand=${brand}`;
        titleText = `Моделі ${brand} (${country})`;
    }
    
    // Оновлення заголовка сторінки
    const catalogTitle = document.querySelector('.country-section h1');
    if (catalogTitle) {
         catalogTitle.textContent = titleText;
    }

    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                // Викидаємо помилку, якщо статус 400/500
                throw new Error(`Помилка сервера: Статус ${response.status}`);
            }
            return response.json();
        })
        .then(cars => {
            catalogContainer.innerHTML = '';
            if (!Array.isArray(cars)) throw new Error("Некоректний формат даних від сервера.");

            if (cars.length === 0) {
                catalogContainer.innerHTML = '<div class="col-12"><p class="text-center lead text-warning">На жаль, моделі не знайдено.</p></div>';
            } else {
                cars.forEach(car => {
                    catalogContainer.innerHTML += generateCatalogCard(car);
                });
            }
        })
        .catch(error => {
            console.error('Помилка завантаження каталогу:', error);
            // Відображаємо повідомлення про помилку, якщо щось пішло не так
            catalogContainer.innerHTML = `<div class="col-12"><p class="text-center lead text-danger">Помилка завантаження даних: ${error.message}.</p></div>`;
        });
}


// =================================================================
// 3. ЛОГІКА ДЛЯ ГОЛОВНОЇ СТОРІНКИ (Слайдер, Пошук - index.html)
// =================================================================

const productsContainer = document.getElementById('products');
const searchInput = document.getElementById('search-input');
const errorContainer = document.getElementById('error'); // Для повідомлень про помилки пошуку
const BACKEND_URL = 'http://127.0.0.1:5000/cars';
const searchIcon = document.getElementById('search-icon');
const closeBtn = document.getElementById('close-search-btn');
const searchBox = document.getElementById('search-box');
function fetchCars(query = '') {
    if (!productsContainer) return;

    const url = query ? `http://localhost:5000/cars?q=${encodeURIComponent(query)}` : 'http://localhost:5000/cars';

    fetch(url)
        .then(response => {
             if (!response.ok) throw new Error('Не вдалося отримати дані: ' + response.status);
             return response.json();
        })
        .then(cars => {
            //  1. Деініціалізація слайдера ПЕРЕД очищенням контейнера (Важливо!)
            if (typeof $ !== 'undefined' && typeof $.fn.slick !== 'undefined' && $('.slider').hasClass('slick-initialized')) {
                $('.slider').slick('unslick');
            }

            productsContainer.innerHTML = '';
            errorContainer.textContent = ''; // Очищаємо попередні помилки

            if (cars.length === 0) {
                // Відображаємо повідомлення про відсутність результатів
                if (query) {
                    alert(`Автомобілів за запитом "${query}" не знайдено.`);
                }
                errorContainer.textContent = `Автомобілів за запитом "${query}" не знайдено.`;
            } else {
                // Ваш оригінальний код для відображення карток слайдера
                cars.forEach(car => {
                    const div = document.createElement('div');
                    div.className = 'product card m-2';
                    div.innerHTML = `
                        <div class="card-body">
                            <h2 class="card-title">${car.brand} ${car.model}</h2>
                            <img src="${car.image_url || 'https://via.placeholder.com/200'}" alt="${car.brand}" class="card-img-top" onclick="window.location.href='car.html?id=${car.id}'" style="cursor: pointer;">
                            <p class="card-text">Ціна: $${car.price.toLocaleString('uk-UA')}</p>
                            <p class="card-text">Категорія: ${car.category}</p>
                            <p class="card-text">Рік: ${car.year}</p>
                            <p class="card-text">Країна: ${car.country}</p>
                            <div class="d-flex justify-content-between">
                                <button class="btn btn-primary btn-sm" onclick="window.location.href='car.html?id=${car.id}'">Переглянути деталі</button>
                                <button class="btn btn-success btn-sm" onclick="addToCart(${car.id})">Додати до кошика</button>
                            </div>
                        </div>
                    `;
                    productsContainer.appendChild(div);
                });

                // Ініціалізація Slick Слайдера
                if (typeof $ !== 'undefined' && typeof $.fn.slick !== 'undefined') {
                    // Перевіряємо, чи слайдер вже ініціалізований
                    if ($('.slider').hasClass('slick-initialized')) {
                         $('.slider').slick('unslick');
                    }
                     $('.slider').slick({
                        slidesToShow: 3,
                        slidesToScroll: 1,
                        autoplay: true,
                        autoplaySpeed: 2000,
                        responsive: [
                            { breakpoint: 768, settings: { slidesToShow: 1 } }
                        ]
                    });
                }
            }
        })
        .catch(error => {
            console.error('Помилка пошуку/завантаження головної:', error);
            errorContainer.textContent = 'Помилка: ' + error.message;
        });
}

// Функція для автозаповнення пошуку
function updateAutocomplete(query) {
    const autocompleteResults = document.getElementById('autocomplete-results');
    if (!autocompleteResults) return;

    if (query.length < 2) {
        autocompleteResults.innerHTML = '';
        autocompleteResults.style.display = 'none';
        return;
    }

    fetch(`http://localhost:5000/cars?q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(cars => {
            autocompleteResults.innerHTML = '';
            if (cars.length > 0) {
                cars.slice(0, 5).forEach(car => {
                    const item = document.createElement('div');
                    item.className = 'autocomplete-item';
                    item.textContent = `${car.brand} ${car.model}`;
                    item.onclick = () => {
                        searchInput.value = `${car.brand} ${car.model}`;
                        autocompleteResults.style.display = 'none';
                        toggleSearchBox(); // Close the search box
                        window.location.href = `car.html?id=${car.id}`;
                    };
                    autocompleteResults.appendChild(item);
                });
                autocompleteResults.style.display = 'block';
            } else {
                autocompleteResults.style.display = 'none';
            }
        })
        .catch(error => {
            console.error('Помилка автозаповнення:', error);
            autocompleteResults.style.display = 'none';
        });
}

// =================================================================
// 4. ЗАПУСК
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    //  НОВИЙ КОД: ПРИЗНАЧЕННЯ ОБРОБНИКІВ ПОШУКУ
  if (searchIcon && closeBtn) {
        // Відкриваємо пошукову стрічку по кліку на лупу
        searchIcon.addEventListener('click', (e) => {
            e.preventDefault();
            toggleSearchBox();
        });

        // Закриваємо пошукову стрічку по кліку на "X"
        closeBtn.addEventListener('click', toggleSearchBox);
    }

    // Додаємо обробник для кнопки пошуку
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
        console.log("ДІАГНОСТИКА: Кнопка 'search-btn' знайдена.");
        searchBtn.addEventListener('click', () => {
            const query = searchInput.value;
        
        // ❗ ДОДАТКОВЕ ДІАГНОСТИЧНЕ ПОВІДОМЛЕННЯ
        console.log(`ДІАГНОСТИКА: Кнопка натиснута. Запит: "${query}"`); // [2] ПЕРЕВІРКА КЛІКУ

        // Відображаємо повідомлення про завантаження, щоб бачити, що JS працює
        if (productsContainer) {
             productsContainer.innerHTML = '<div class="col-12 text-center">🔍 Шукаємо...</div>';
        }
            fetchCars(searchInput.value);
            document.getElementById('autocomplete-results').style.display = 'none';
        });
    }
    
    // 1. Запускаємо логіку каталогу (якщо знаходимо контейнер 'car-models-container')
    if (document.getElementById('car-models-container')) {
        loadCatalog();
    } 
    
    // 2. Запускаємо логіку головної сторінки (якщо знаходимо контейнер 'products')
    else if (productsContainer) {
        // fetchCars() викликається без аргументів при завантаженні
        fetchCars(); 
        
        // Перевіряємо, чи існує стрічка пошуку (тепер вона в навігації)
       if (searchInput) {
            // Прив'язуємо подію "введення" для автозаповнення
            searchInput.addEventListener('input', () => {
                updateAutocomplete(searchInput.value);
            });

            // Прив'язуємо подію "keydown" для пошуку по Enter
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    fetchCars(searchInput.value);
                    document.getElementById('autocomplete-results').style.display = 'none';
                }
            });
        }
    }
    
    // 3. Запускаємо логіку кошика
    if (document.getElementById('cart-items-container')) {
        loadCart();
        // Прив'язуємо оформлення замовлення
        document.getElementById('checkout-btn').addEventListener('click', checkoutOrder);
    }
});