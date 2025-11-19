// Admin panel JavaScript
let currentUser = null;

// Check if admin is logged in
function checkAdminAuth() {
    const token = localStorage.getItem('admin_token');
    const user = JSON.parse(localStorage.getItem('admin_user') || 'null');

    if (token && user && user.role === 'admin') {
        currentUser = user;
        showAdminPanel();
    } else {
        showLoginForm();
    }
}


function showLoginForm() {
    document.getElementById('login-section').style.display = 'block';
    document.getElementById('admin-panel').style.display = 'none';
    document.getElementById('admin-info').style.display = 'none';
    document.getElementById('logout-btn').style.display = 'none';
}


function showAdminPanel() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'block';
    document.getElementById('admin-info').style.display = 'inline';
    document.getElementById('logout-btn').style.display = 'inline';
    document.getElementById('admin-username').textContent = currentUser.username;
    loadCars();
}


document.getElementById('admin-login-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('http://localhost:5000/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok && data.user && data.user.role === 'admin') {
            localStorage.setItem('admin_token', 'admin_logged_in'); // Simple token
            localStorage.setItem('admin_user', JSON.stringify(data.user));
            currentUser = data.user;
            showAdminPanel();
           
            if (window.location.pathname !== '/admin.html') {
                window.location.href = 'admin.html';
            }
        } else {
            showLoginMessage('Невірні дані адміністратора', 'danger');
        }
    } catch (error) {
        console.error('Login error:', error);
        showLoginMessage('Помилка підключення', 'danger');
    }
});

function showLoginMessage(message, type) {
    const messageDiv = document.getElementById('login-message');
    messageDiv.textContent = message;
    messageDiv.className = `alert alert-${type}`;
    messageDiv.style.display = 'block';
}


document.getElementById('logout-btn').addEventListener('click', function() {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    currentUser = null;
    showLoginForm();
});

// зміна даних авто 
async function loadCars() {
    try {
        const response = await fetch('http://localhost:5000/cars', { cache: 'no-cache' });
        const cars = await response.json();

        const container = document.getElementById('cars-container');
        container.innerHTML = '';

        if (cars.length === 0) {
            container.innerHTML = '<p class="text-center">Немає автомобілів для відображення</p>';
            return;
        }

        cars.forEach(car => {
            const carCard = createCarCard(car);
            container.appendChild(carCard);
        });
    } catch (error) {
        console.error('Error loading cars:', error);
        document.getElementById('cars-container').innerHTML = '<p class="text-center text-danger">Помилка завантаження автомобілів</p>';
    }
}


function createCarCard(car) {
    const col = document.createElement('div');
    col.className = 'col-lg-4 col-md-6 mb-4';

    col.innerHTML = `
        <div class="card h-100 shadow-sm">
            <img src="${car.image_url}" class="card-img-top" alt="${car.brand} ${car.model}" style="height: 200px; object-fit: cover;">
            <div class="card-body d-flex flex-column">
                <h5 class="card-title">${car.brand} ${car.model}</h5>
                <p class="card-text text-muted">${car.year} • ${car.country}</p>
                <p class="card-text">${car.description ? car.description.substring(0, 100) + '...' : 'Немає опису'}</p>
                <div class="mt-auto">
                    <p class="card-text"><strong>Ціна: $${car.price.toLocaleString()}</strong></p>
                    <button class="btn btn-primary btn-sm w-100" onclick="editCar(${car.id})">
                        <i class="fas fa-edit me-1"></i>Редагувати
                    </button>
                </div>
            </div>
        </div>
    `;

    return col;
}


function editCar(carId) {
   
    fetch(`http://localhost:5000/cars/${carId}`)
        .then(response => response.json())
        .then(car => {
          
            document.getElementById('edit-car-id').value = car.id;
            document.getElementById('edit-brand').value = car.brand;
            document.getElementById('edit-model').value = car.model;
            document.getElementById('edit-price').value = car.price;
            document.getElementById('edit-category').value = car.category;
            document.getElementById('edit-year').value = car.year;
            document.getElementById('edit-country').value = car.country;
            document.getElementById('edit-engine').value = car.engine || '';
            document.getElementById('edit-horsepower').value = car.horsepower || '';
            document.getElementById('edit-transmission').value = car.transmission || '';
            document.getElementById('edit-mileage').value = car.mileage || '';
            document.getElementById('edit-color').value = car.color || '';
            document.getElementById('edit-description').value = car.description || '';

            
            const modal = new bootstrap.Modal(document.getElementById('editModal'));
            modal.show();
        })
        .catch(error => {
            console.error('Error fetching car:', error);
            alert('Помилка завантаження даних автомобіля');
        });
}


document.getElementById('save-changes-btn').addEventListener('click', async function() {
    const carId = document.getElementById('edit-car-id').value;
    const formData = new FormData();

    
    const brand = document.getElementById('edit-brand').value;
    const model = document.getElementById('edit-model').value;
    const price = document.getElementById('edit-price').value;
    const category = document.getElementById('edit-category').value;
    const year = document.getElementById('edit-year').value;
    const country = document.getElementById('edit-country').value;
    const engine = document.getElementById('edit-engine').value;
    const horsepower = document.getElementById('edit-horsepower').value;
    const transmission = document.getElementById('edit-transmission').value;
    const mileage = document.getElementById('edit-mileage').value;
    const color = document.getElementById('edit-color').value;
    const description = document.getElementById('edit-description').value;
    const imageFile = document.getElementById('edit-image').files[0];

    
    if (!brand || !model || !price || !category || !year || !country) {
        alert('Будь ласка, заповніть всі обов\'язкові поля');
        return;
    }

  
    const carData = {
        brand,
        model,
        price: parseFloat(price),
        category,
        year: parseInt(year),
        country,
        engine,
        horsepower: horsepower ? parseInt(horsepower) : null,
        transmission,
        mileage: mileage ? parseInt(mileage) : null,
        color,
        description
    };

    try {
        let response;
        if (imageFile) {
            
            formData.append('data', JSON.stringify(carData));
            formData.append('image', imageFile);

            response = await fetch(`http://localhost:5000/cars/${carId}`, {
                method: 'PUT',
                body: formData
            });
        } else {
            
            response = await fetch(`http://localhost:5000/cars/${carId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(carData)
            });
        }

        if (response.ok) {
            alert('Автомобіль успішно оновлено!');
            bootstrap.Modal.getInstance(document.getElementById('editModal')).hide();
            loadCars(); 
        } else {
            const error = await response.json();
            alert('Помилка оновлення: ' + (error.message || 'Невідома помилка'));
        }
    } catch (error) {
        console.error('Error updating car:', error);
        alert('Помилка підключення до сервера');
    }
});


// Load users function
async function loadUsers() {
    try {
        const response = await fetch('http://localhost:5000/users', { cache: 'no-cache' });
        const users = await response.json();

        const container = document.getElementById('users-container');
        container.innerHTML = '';

        if (users.length === 0) {
            container.innerHTML = '<p class="text-center">Немає користувачів для відображення</p>';
            return;
        }

        users.forEach(user => {
            const userCard = document.createElement('div');
            userCard.className = 'col-lg-4 col-md-6 mb-4';
            userCard.innerHTML = `
                <div class="card h-100 shadow-sm">
                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title">${user.username}</h5>
                        <p class="card-text text-muted">Email: ${user.email}</p>
                        <p class="card-text text-muted">Роль: ${user.role}</p>
                        <p class="card-text text-muted">Дата реєстрації: ${new Date(user.created_at).toLocaleDateString('uk-UA')}</p>
                    </div>
                </div>
            `;
            container.appendChild(userCard);
        });
    } catch (error) {
        console.error('Error loading users:', error);
        document.getElementById('users-container').innerHTML = '<p class="text-center text-danger">Помилка завантаження користувачів</p>';
    }
}

// Load orders function
async function loadOrders() {
    try {
        const response = await fetch('http://localhost:5000/admin/orders', { cache: 'no-cache' });
        const orders = await response.json();

        const container = document.getElementById('orders-container');
        container.innerHTML = '';

        if (orders.length === 0) {
            container.innerHTML = '<p class="text-center">Немає замовлень для відображення</p>';
            return;
        }

        orders.forEach(order => {
            const orderCard = document.createElement('div');
            orderCard.className = 'col-lg-6 col-md-12 mb-4';
            orderCard.innerHTML = `
                <div class="card h-100 shadow-sm">
                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title">Замовлення #${order.id}</h5>
                        <p class="card-text text-muted">Користувач: ${order.customer_name}</p>
                        <p class="card-text text-muted">Email: ${order.email}</p>
                        <p class="card-text text-muted">Загальна сума: $${order.total_price.toLocaleString()}</p>
                        <p class="card-text text-muted">Дата: ${new Date(order.order_date).toLocaleDateString('uk-UA')}</p>
                        <p class="card-text text-muted">Статус: ${order.status}</p>
                        <div class="mt-auto">
                            <h6>Товар:</h6>
                            <ul class="list-unstyled small">
                                ${order.items.map(item => `<li>${item.car_details ? item.car_details.brand + ' ' + item.car_details.model : 'Невідомий товар'} - $${item.price.toFixed(2)} x ${item.quantity}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(orderCard);
        });
    } catch (error) {
        console.error('Error loading orders:', error);
        document.getElementById('orders-container').innerHTML = '<p class="text-center text-danger">Помилка завантаження замовлень</p>';
    }
}

// Event listeners for tabs
document.getElementById('users-tab').addEventListener('click', loadUsers);
document.getElementById('orders-tab').addEventListener('click', loadOrders);

document.addEventListener('DOMContentLoaded', checkAdminAuth);
