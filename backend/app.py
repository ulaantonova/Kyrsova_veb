from flask import Flask, jsonify, request, render_template
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from sqlalchemy import or_
from sqlalchemy.orm import joinedload, selectinload
import json
import os
from datetime import datetime
from flask import render_template
app = Flask(__name__)
CORS(app)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)
bcrypt = Bcrypt(app)

# ==================================
# МОДЕЛІ БАЗИ ДАНИХ (ВИПРАВЛЕНО CartItem)
# ==================================

class Car(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    brand = db.Column(db.String(50), nullable=False)
    model = db.Column(db.String(50), nullable=False)
    price = db.Column(db.Float, nullable=False)
    category = db.Column(db.String(50), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    country = db.Column(db.String(50), nullable=False)
    image_url = db.Column(db.String(200))
    description = db.Column(db.Text)
    engine = db.Column(db.String(100))        
    horsepower = db.Column(db.Integer)        
    transmission = db.Column(db.String(50))   
    mileage = db.Column(db.Integer)           
    color = db.Column(db.String(50))

    def to_dict(self):
        return {
            'id': self.id,
            'brand': self.brand,
            'model': self.model,
            'price': self.price,
            'category': self.category,
            'year': self.year,
            'country': self.country,
            'image_url': self.image_url,
            'description': self.description,
            'engine': self.engine,
            'horsepower': self.horsepower,
            'transmission': self.transmission,
            'mileage': self.mileage,
            'color': self.color
        }

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(20), default='user', nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {'id': self.id, 'username': self.username, 'email': self.email, 'role': self.role, 'created_at': self.created_at.isoformat()}

# Admin user creation
def create_admin():
    with app.app_context():
        admin = User.query.filter_by(email='admin@example.com').first()
        if not admin:
            hashed_password = bcrypt.generate_password_hash('admin123').decode('utf-8')
            admin = User(username='admin', email='admin@example.com', password=hashed_password, role='admin')
            db.session.add(admin)
            db.session.commit()
            print("Admin user created: email=admin@example.com, password=admin123")

class CartItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, default=1)
    car_id = db.Column(db.Integer, db.ForeignKey('car.id'), nullable=False)
    quantity = db.Column(db.Integer, default=1, nullable=False) # 🛑 ВИПРАВЛЕНО: ПОВЕРНУЛИ quantity

    car = db.relationship('Car', backref=db.backref('cart_items', lazy=True))

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'car_id': self.car_id,
            'quantity': self.quantity, # Повертаємо quantity
            'car_details': self.car.to_dict() if self.car else None
        }

class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    order_date = db.Column(db.DateTime, default=datetime.utcnow)
    total_price = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(50), default='Оформлено')

    user = db.relationship('User', backref=db.backref('orders', lazy=True))
    items = db.relationship('OrderItem', backref='order', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'order_date': self.order_date.isoformat(),
            'total_price': self.total_price,
            'status': self.status,
            'customer_name': self.user.username if self.user else 'Невідомий користувач',
            'email': self.user.email if self.user else 'Невідомий',
            'phone': None,  # No phone in user model
            'cars': ', '.join([f"{item.car.brand if item.car else 'Невідомий'} {item.car.model if item.car else 'товар'} (x{item.quantity})" for item in self.items]) if self.items else 'Немає товарів',
            'user': self.user.to_dict() if self.user else {'username': 'Невідомий', 'email': 'Невідомий'},
            'items': [item.to_dict() for item in self.items]
        }

class OrderItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('order.id'), nullable=False)
    car_id = db.Column(db.Integer, db.ForeignKey('car.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    price = db.Column(db.Float, nullable=False)

    car = db.relationship('Car', backref=db.backref('order_items', lazy=True))

    def to_dict(self):
        return {
            'id': self.id,
            'car_id': self.car_id,
            'quantity': self.quantity,
            'price': self.price,
            'car_details': self.car.to_dict() if self.car else None
        }
# ==================================
# API МАРШРУТИ
# ==================================

# Створення таблиць (викликається в init_db)
# with app.app_context():
#     db.create_all() # ЦЕЙ РЯДОК ПОТРІБНО ПЕРЕМІСТИТИ В init_db!

# УНІВЕРСАЛЬНИЙ МАРШРУТ /cars:
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/cars', methods=['GET'])
def get_cars():
    country = request.args.get('country')
    brand = request.args.get('brand')
    query_text = request.args.get('q') 
    category = request.args.get('category')
    
    cars_query = Car.query
    
    if country:
        cars_query = cars_query.filter_by(country=country)
    if brand:
        cars_query = cars_query.filter_by(brand=brand)
    if query_text:
        # Пошук за брендом або моделлю або комбінацією (без урахування регістру для SQLite)
        from sqlalchemy import func
        cars_query = cars_query.filter(
            or_(
                func.lower(Car.brand).like(f'%{query_text.lower()}%'),
                func.lower(Car.model).like(f'%{query_text.lower()}%'),
                func.lower(Car.brand + ' ' + Car.model).like(f'%{query_text.lower()}%')
            )
        )
    if category:
        cars_query = cars_query.filter_by(category=category)
    
    cars = cars_query.order_by(Car.brand, Car.model).all()
    
    return jsonify([car.to_dict() for car in cars])


@app.route('/cars/<int:car_id>', methods=['GET'])
def get_car_by_id(car_id):
    car = Car.query.get_or_404(car_id)
    return jsonify(car.to_dict())

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    if not username or not email or not password:
        return jsonify({"message": "Необхідно вказати ім'я користувача, email та пароль"}), 400

    # Перевірка на унікальність імені користувача
    existing_user = User.query.filter_by(username=username).first()
    if existing_user:
        return jsonify({"message": "Користувач з таким ім'ям вже існує"}), 409

    # Перевірка на унікальність email
    existing_email = User.query.filter_by(email=email).first()
    if existing_email:
        return jsonify({"message": "Користувач з таким email вже існує"}), 409

    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    new_user = User(username=username, email=email, password=hashed_password, role='user')
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"message": "Користувач створений", "user": new_user.to_dict()}), 201

@app.route('/login', methods=['POST'])
def login():
    # ... (логіка залишається без змін)
    data = request.get_json()
    user = User.query.filter_by(username=data['username']).first()
    if user and bcrypt.check_password_hash(user.password, data['password']):
        return jsonify({"message": "Авторизація успішна", "user": user.to_dict()}), 200
    return jsonify({"message": "Невірні дані"}), 401


@app.route('/cart/<int:user_id>', methods=['GET'])
def get_cart(user_id):
    #  ПОВЕРТАЄМО ПОВНІ ДЕТАЛІ АВТО завдяки to_dict()
    items = CartItem.query.filter_by(user_id=user_id).all()
    return jsonify([item.to_dict() for item in items])

@app.route('/cart', methods=['POST'])
def add_to_cart():
    #  ЛОГІКА ТЕПЕР ПРАЦЮЄ З quantity
    data = request.get_json()
    car_id = data.get('car_id')
    user_id = data.get('user_id')

    if not car_id or not user_id:
        return jsonify({"message": "Необхідно вказати ID автомобіля та користувача"}), 400

    car = Car.query.get(car_id)
    if not car:
        return jsonify({'message': 'Автомобіль не знайдено.'}), 404

    item = CartItem.query.filter_by(user_id=user_id, car_id=car_id).first()

    if item:
        # Якщо товар вже є, ЗБІЛЬШУЄМО КІЛЬКІСТЬ
        item.quantity += 1
        db.session.commit()
        return jsonify({"message": f"Кількість {car.model} у кошику збільшено до {item.quantity}."}), 200
    else:
        # Якщо товару немає, створюємо новий запис з quantity=1
        new_item = CartItem(user_id=user_id, car_id=car_id, quantity=1)
        db.session.add(new_item)
        db.session.commit()
        return jsonify({"message": f"Автомобіль {car.brand} {car.model} успішно додано до кошика!"}), 201
    
@app.route('/cart/<int:item_id>', methods=['DELETE'])
def remove_from_cart(item_id):
    # ЛОГІКА ПРАЦЮЄ З ID ЕЛЕМЕНТА КОШИКА
    data = request.get_json()
    user_id = data.get('user_id')

    if not user_id:
        return jsonify({"message": "Необхідно вказати ID користувача"}), 400

    item = CartItem.query.filter_by(id=item_id, user_id=user_id).first()

    if not item:
        return jsonify({'message': 'Елемент кошика не знайдено.'}), 404

    db.session.delete(item)
    db.session.commit()
    return jsonify({'message': 'Автомобіль успішно видалено з кошика.'})

@app.route('/checkout', methods=['POST'])
def checkout():
    # ЛОГІКА ПРАЦЮЄ З quantity
    data = request.get_json()
    user_id = data.get('user_id')

    if not user_id:
        return jsonify({"message": "Необхідно вказати ID користувача"}), 400

    items = CartItem.query.filter_by(user_id=user_id).all()

    if not items:
        return jsonify({'message': 'Ваш кошик порожній. Додайте товари для придбання.'}), 400

    total_price = sum(item.car.price * item.quantity for item in items)

    # Створюємо замовлення
    order = Order(user_id=user_id, total_price=total_price)
    db.session.add(order)
    db.session.flush()  # Щоб отримати order.id

    # Створюємо елементи замовлення
    for item in items:
        order_item = OrderItem(
            order_id=order.id,
            car_id=item.car_id,
            quantity=item.quantity,
            price=item.car.price
        )
        db.session.add(order_item)

    # Видаляємо елементи кошика
    for item in items:
        db.session.delete(item)

    db.session.commit()

    return jsonify({
        'message': ' Вітаємо! Ваше замовлення успішно оформлено!',
        'total': f'Загальна сума: ${total_price:,.2f}',
        'order_id': order.id
    }), 200

@app.route('/users', methods=['GET'])
def get_users():
    users = User.query.all()
    return jsonify([user.to_dict() for user in users])

@app.route('/orders', methods=['GET'])
def get_orders():
    orders = Order.query.all()
    return jsonify([order.to_dict() for order in orders])

@app.route('/admin/users', methods=['GET'])
def get_admin_users():
    users = User.query.all()
    return jsonify([user.to_dict() for user in users])

@app.route('/admin/orders', methods=['GET'])
def get_admin_orders():
    orders = Order.query.options(joinedload(Order.user), selectinload(Order.items).joinedload(OrderItem.car)).order_by(Order.order_date.desc()).all()
    return jsonify([order.to_dict() for order in orders])


# Обробка помилок
@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Не знайдено"}), 404

# ==================================
# ПОЧАТКОВЕ НАПОВНЕННЯ ДАНИМИ 
# ==================================
def seed_data():
    with app.app_context():
            # ... (Весь код наповнення Car моделями залишається без змін)
            ford_models = [
                Car(brand='Ford', model='Mustang GT', price=45000, category='Купе', year=2022, country='USA', image_url='img/FordMustangGT.jfif', 
                     description="Легендарний Mustang GT з V8 двигуном. Класика американського автопрому, потужний та стильний спорткар.",
                     engine='5.0L V8', horsepower=460, transmission='Автомат 10-ст', mileage=15000, color='Білий'),
                Car(brand='Ford', model='F-150 Raptor', price=65000, category='Пікап', year=2023, country='USA', image_url='img/FORD.jfif', 
                    description="Позашляховий монстр, ідеальний для будь-якої місцевості. Неперевершена потужність та витривалість.",
                    engine='3.5L V6 EcoBoost', horsepower=450, transmission='Автомат 10-ст', mileage=5000, color='Червоний'),
                Car(brand='Ford', model='Explorer', price=38000, category='Кросовер', year=2021, country='USA', image_url='img/FordExplorer.jfif',
                    description="Комфортабельний та просторий сімейний кросовер із сучасними технологіями безпеки.",
                    engine='2.3L I4 EcoBoost', horsepower=300, transmission='Автомат 10-ст', mileage=35000, color='Чорний'),
                Car(brand='Ford', model='Bronco', price=42000, category='Позашляховик', year=2023, country='USA', image_url='img/FordBronco.jfif',
                    description="Міцний позашляховик у стилі ретро, розроблений для справжніх пригод на бездоріжжі.",
                    engine='2.7L V6 EcoBoost', horsepower=330, transmission='Механіка 7-ст', mileage=10000, color='Сірий'),
            ]

            # --- МОДЕЛІ CHEVROLET (4) ---
            chevrolet_models = [
                Car(brand='Chevrolet', model='Camaro ZL1', price=39000, category='Купе', year=2021, country='USA', image_url='img/Camaro_ZL1.jfif', 
                    description="Доступний спорткар із потужним V8. Класичний американський маслкар, що поєднує стиль і швидкість.",
                    engine='6.2L V8', horsepower=455, transmission='Автомат 8-ст', mileage=25000, color='Чорний'),
                
                Car(brand='Chevrolet', model='Corvette Stingray', price=95000, category='Спорткар', year=2023, country='USA', image_url='img/corvette_stringray.jfif', 
                    description="Середньомоторний суперкар, який побив усі рекорди. Неймовірна динаміка та футуристичний дизайн.",
                    engine='6.2L V8', horsepower=495, transmission='Робот 8-ст', mileage=2000, color='Чорний'),
                    
                Car(brand='Chevrolet', model='Tahoe Z71', price=72000, category='Позашляховик', year=2024, country='USA', image_url='img/tahoe.jfif',
                    description="Повнорозмірний сімейний позашляховик з підвищеною прохідністю. Комфорт та потужність.",
                    engine='5.3L V8', horsepower=355, transmission='Автомат 10-ст', mileage=1000, color='Чорний'),

                Car(brand='Chevrolet', model='Impala', price=25000, category='Седан', year=1980, country='USA', image_url='img/chevrole-impal.jfif',
                    description="Повнорозмірний сімейний седан, відомий своєю комфортною їздою та просторим салоном.",
                    engine='3.6L V6', horsepower=305, transmission='Автомат 6-ст', mileage=55000, color='чорний'),
            ]
            tesla_models = [
                Car(brand='Tesla', model='Model S Plaid', price=130000, category='Седан', year=2024, country='USA', image_url='img/S_Plaid.jfif', 
                    description="Найшвидший серійний седан у світі. Три мотори, неймовірне прискорення та максимальна автономність.",
                    engine='Електро (3 мотори)', horsepower=1020, transmission='Одноступенева', mileage=500, color='Чорний'),
                
                Car(brand='Tesla', model='Model Y', price=47000, category='Кросовер', year=2023, country='USA', image_url='img/model_y.jfif', 
                    description="Компактний електричний кросовер, ідеальний для міста. Технологічний мінімалізм та висока безпека.",
                    engine='Електро (2 мотори)', horsepower=384, transmission='Одноступенева', mileage=12000, color='Білий'),

                Car(brand='Tesla', model='Cybertruck', price=80000, category='Пікап', year=2025, country='USA', image_url='img/cybertruck.jfif',
                    description="Радикально новий дизайн пікапа. Надміцний екзоскелет та пневматична підвіска.",
                    engine='Електро (2 мотори)', horsepower=600, transmission='Одноступенева', mileage=50, color='Чорний'),
                    
                Car(brand='Tesla', model='Model 3', price=40000, category='Седан', year=2024, country='USA', image_url='img/Model_3.jpg',
                    description="Базова модель Tesla, що забезпечує високу ефективність та доступну ціну в сегменті електрокарів.",
                    engine='Електро (1 мотор)', horsepower=283, transmission='Одноступенева', mileage=100, color='Чорний'),
            ]
            
            bmw_models = [
                Car(brand='BMW', model='M3 Competition', price=85000, category='Седан', year=2024, country='Germany', image_url='img/m3_competition.jfif', 
                    description="Високопродуктивний седан із потужним рядним шестициліндровим двигуном. Еталон спортивної керованості.",
                    engine='3.0L I6 Turbo', horsepower=510, transmission='Автомат 8-ст', mileage=500, color='Зелений'),
                
                Car(brand='BMW', model='X5 xDrive40i', price=68000, category='Кросовер', year=2023, country='Germany', image_url='img/BMW_X5.jfif', 
                    description="Розкішний та універсальний кросовер з відмінним балансом комфорту та динаміки.",
                    engine='3.0L I6 Turbo', horsepower=375, transmission='Автомат 8-ст', mileage=10000, color='Чорний'),

                Car(brand='BMW', model='m 850 sportic', price=60000, category='Седан', year=2023, country='Germany', image_url='img/m850.jfif', 
                    description="Електричний Gran Coupe з великим запасом ходу. Елегантний дизайн і нульові викиди.",
                    engine='Електро', horsepower=335, transmission='Одноступенева', mileage=8000, color='Білий'),
                
                Car(brand='BMW', model='Z4 Roadster', price=58000, category='Кабріолет', year=2022, country='Germany', image_url='img/roadster.jfif', 
                    description="Компактний спортивний родстер. Ідеальний для їзди з відкритим верхом.",
                    engine='2.0L I4 Turbo', horsepower=255, transmission='Автомат 8-ст', mileage=15000, color='Червоний'),
            ]
            
            # МОДЕЛІ MERCEDES-BENZ (4)
            mercedes_models = [
                Car(brand='Mercedes-Benz', model='C300 Sedan', price=50000, category='Седан', year=2023, country='Germany', image_url='img/mersedes_benz.jfif', 
                    description="Розкішний бізнес-седан з передовими технологіями та вишуканим салоном.",
                    engine='2.0L I4 Turbo', horsepower=255, transmission='Автомат 9-ст', mileage=12000, color='Сірий'),
                
                Car(brand='Mercedes-Benz', model='G-Class G63', price=170000, category='Позашляховик', year=2024, country='Germany', image_url='img/Mercedes_Benz_AMGg63.jfif', 
                    description="Легендарний позашляховик AMG. Максимальна розкіш та неймовірна прохідність.",
                    engine='4.0L V8 Twin-Turbo', horsepower=577, transmission='Автомат 9-ст', mileage=500, color='Чорний'),

                Car(brand='Mercedes-Benz', model='EQS 450+', price=110000, category='Седан', year=2023, country='Germany', image_url='img/Mercedes-Benz_EQS.jfif', 
                    description="Флагманський електромобіль із футуристичним дизайном та надвеликим екраном MBUX Hyperscreen.",
                    engine='Електро', horsepower=329, transmission='Одноступенева', mileage=7000, color='Синій'),

                Car(brand='Mercedes-Benz', model='AMG GT Roadster', price=155000, category='Спорткар', year=2022, country='Germany', image_url='img/Mercedes-AMG_GT.jfif', 
                    description="Спортивний кабріолет з приголомшливою динамікою та фірмовим звуком AMG.",
                    engine='4.0L V8 Twin-Turbo', horsepower=530, transmission='Робот 7-ст', mileage=10000, color='Червоний'),
            ]
            
            # МОДЕЛІ AUDI (4)
            audi_models = [
                Car(brand='Audi', model='RS 7 Sportback', price=125000, category='Седан', year=2023, country='Germany', image_url='img/Audi-rs.jfif', 
                    description="Спортивний седан із дизайном купе та потужним V8. Ідеальне поєднання розкоші та агресії.",
                    engine='4.0L V8 Twin-Turbo', horsepower=591, transmission='Автомат 8-ст', mileage=6000, color='Сірий'),
                
                Car(brand='Audi', model='Q8 e-tron', price=80000, category='Кросовер', year=2024, country='Germany', image_url='img/audi-e-tron.jfif', 
                    description="Флагманський електричний кросовер. Прогресивний дизайн та технологія повного приводу quattro.",
                    engine='Електро (2 мотори)', horsepower=402, transmission='Одноступенева', mileage=2000, color='Білий'),
                
                Car(brand='Audi', model='TT RS', price=65000, category='Купе', year=2022, country='Germany', image_url='img/Audi-TT.jfif', 
                    description="Культове спортивне купе з унікальним 5-циліндровим двигуном та захоплюючим звуком.",
                    engine='2.5L I5 Turbo', horsepower=400, transmission='Робот 7-ст', mileage=15000, color='Червоний'),

                Car(brand='Audi', model='A6 Allroad', price=45000, category='Універсал', year=2012, country='Germany', image_url='img/audi-a6.jfif',
                    description="Практичний універсал з підвищеним кліренсом та системою quattro для легкого бездоріжжя.",
                    engine='2.0L I4 Turbo', horsepower=248, transmission='Робот 7-ст', mileage=30000, color='Коричневий'),
            ]
            
            # МОДЕЛІ PORSCHE (4)
            porsche_models = [
                Car(brand='Porsche', model='911 Carrera S', price=135000, category='Спорткар', year=2023, country='Germany', image_url='img/Porsche-911.jfif', 
                    description="Легенда спортивного світу. Класичний дизайн та неперевершена динаміка задньомоторного спорткара.",
                    engine='3.0L F6 Twin-Turbo', horsepower=443, transmission='Робот 8-ст', mileage=5000, color='Жовтий'),
                
                Car(brand='Porsche', model='Taycan Turbo', price=150000, category='Седан', year=2024, country='Germany', image_url='img/Porsche-Taycan.jfif', 
                    description="Спортивний електромобіль з унікальною 800-вольтовою архітектурою для надшвидкої зарядки.",
                    engine='Електро (2 мотори)', horsepower=670, transmission='2-ст для задньої осі', mileage=1000, color='Синій'),
                
                Car(brand='Porsche', model='Cayenne Coupe', price=85000, category='Кросовер', year=2022, country='Germany', image_url='img/Porsche-cayenne.jfif', 
                    description="Потужний преміальний кросовер у кузові купе. Спортивна керованість у великому форматі.",
                    engine='3.0L V6 Turbo', horsepower=335, transmission='Автомат 8-ст', mileage=25000, color='Чорний'),

                Car(brand='Porsche', model='Boxster 718', price=70000, category='Кабріолет', year=2021, country='Germany', image_url='img/718-Boxter.jfif',
                    description="Компактний двомісний родстер з ідеальним середньомоторним компонуванням.",
                    engine='2.0L F4 Turbo', horsepower=300, transmission='Робот 7-ст', mileage=18000, color='Білий'),
            ]
            toyota_models = [
            Car(brand='Toyota', model='Supra', price=55000, category='Спорткар', year=2023, country='Japan', image_url='img/Toyota-Supra.jfif', 
                description="Легендарний спорткар, поєднання німецької інженерії та японського дизайну.", 
                engine='3.0L I6 Turbo', horsepower=382, transmission='8-Speed Automatic', mileage=0, color='Білий'),
            Car(brand='Toyota', model='Chaser', price=28000, category='Седан', year=2024, country='Japan', image_url='img/chaizer.jpg', 
                description="Надійний сімейний седан, відомий своєю економічністю та довговічністю.", 
                engine='2.5L I4', horsepower=203, transmission='8-Speed Automatic', mileage=0, color='Білий'),
            Car(brand='Toyota', model='Mark 2', price=85000, category='Позашляховик', year=2022, country='Japan', image_url='img/mark.jfif', 
                description="Культовий позашляховик, ідеальний для важкого бездоріжжя та тривалих подорожей.", 
                engine='3.5L V6 Twin-Turbo', horsepower=409, transmission='10-Speed Automatic', mileage=0, color='Білий'),
            Car(brand='Toyota', model='GR86', price=32000, category='Купе', year=2024, country='Japan', image_url='img/GR86.jfif', 
                description="Компактне спортивне купе, орієнтоване на чисте задоволення від водіння.", 
                engine='2.4L F4', horsepower=228, transmission='6-Speed Manual', mileage=500, color='Білий'),
            ]

        # --- МОДЕЛІ HONDA (4) ---
            honda_models = [
            Car(brand='Honda', model='Civic Type R', price=45000, category='Хетчбек', year=2023, country='Japan', image_url='img/Civic.jpg', 
                description="Гарячий хетчбек із агресивним дизайном та неперевершеною керованістю.", 
                engine='2.0L I4 VTEC Turbo', horsepower=315, transmission='6-Speed Manual', mileage=0, color='White'),
            Car(brand='Honda', model='Integra', price=32000, category='Кросовер', year=2024, country='Japan', image_url='img/Honda-integra.jpg', 
                description="Популярний компактний кросовер із високим рівнем безпеки та комфорту.", 
                engine='1.5L I4 Turbo', horsepower=190, transmission='CVT', mileage=0, color='Gray'),
            Car(brand='Honda', model='Accord', price=30000, category='Седан', year=2023, country='Japan', image_url='img/Accord.jfif', 
                description="Надійний та просторий бізнес-седан, відомий своєю динамікою.", 
                engine='1.5L I4 Turbo', horsepower=192, transmission='CVT', mileage=0, color='Black'),
            Car(brand='Honda', model='Pilot', price=48000, category='Позашляховик', year=2024, country='Japan', image_url='img/Pilot.jpg', 
                description="Повнорозмірний сімейний SUV з трьома рядами сидінь.", 
                engine='3.5L V6', horsepower=280, transmission='10-Speed Automatic', mileage=0, color='Brown'),
            ]

        # --- МОДЕЛІ MAZDA (4) ---
            mazda_models = [
            Car(brand='Mazda', model='MX-5 Miata', price=28000, category='Кабріолет', year=2023, country='Japan', image_url='img/miata.jpg', 
                description="Легкий спортивний родстер, орієнтований на класичні відчуття від водіння.", 
                engine='2.0L I4', horsepower=181, transmission='6-Speed Manual', mileage=1000, color='Біла'),
            Car(brand='Mazda', model='RX-7', price=27000, category='Кросовер', year=2024, country='Japan', image_url='img/Mazda.jfif', 
                description="Стильний кросовер з фірмовим дизайном Kodo та технологією Skyactiv.", 
                engine='2.5L I4', horsepower=187, transmission='6-Speed Automatic', mileage=0, color='Біла'),
            Car(brand='Mazda', model='Mazda3 Sedan', price=23000, category='Седан', year=2024, country='Japan', image_url='img/3.jfif', 
                description="Компактний седан преміальної якості з вишуканим салоном.", 
                engine='2.5L I4', horsepower=191, transmission='6-Speed Automatic', mileage=100, color='Біла'),
            Car(brand='Mazda', model='CX-90', price=48000, category='Позашляховик', year=2023, country='Japan', image_url='img/cx-90.jpg', 
                description="Новий флагманський трирядний кросовер із задньопривідною платформою.", 
                engine='3.3L I6 Turbo', horsepower=340, transmission='8-Speed Automatic', mileage=5000, color='Біла'),
            ] 

        # --- МОДЕЛІ NISSAN (4) ---
            nissan_models = [
            Car(brand='Nissan', model='GT-R (R35)', price=115000, category='Спорткар', year=2024, country='Japan', image_url='img/GT-R.jpg', 
                description="Легендарний 'Годзілла' з неймовірною динамікою. Високотехнологічний суперкар.", 
                engine='3.8L V6 Twin-Turbo', horsepower=565, transmission='6-Speed Automatic DCT', mileage=0, color='Blue'),
            Car(brand='Nissan', model='Silvia S-14', price=28000, category='Кросовер', year=2023, country='Japan', image_url='img/S14.jpg', 
                description="Популярний компактний кросовер із високим рівнем комфорту та економічності.", 
                engine='1.3L I4 Turbo', horsepower=158, transmission='CVT', mileage=0, color='White'),
            Car(brand='Nissan', model='Skyline R-34', price=35000, category='Купе', year=2020, country='Japan', image_url='img/skyline.jfif', 
                description="Класичне спортивне купе з заднім приводом та атмосферним двигуном.", 
                engine='3.7L V6', horsepower=332, transmission='6-Speed Manual', mileage=15000, color='Black'),
            Car(brand='Nissan', model='300zx', price=34000, category='Позашляховик', year=2024, country='Japan', image_url='img/300zx.jpg', 
                description="Місткий сімейний кросовер з сучасними системами безпеки.", 
                engine='2.5L I4', horsepower=181, transmission='CVT', mileage=0, color='Gray'),
            ]

            all_usa_models = ford_models + chevrolet_models + tesla_models 
            all_germany_models = bmw_models + mercedes_models + audi_models + porsche_models
            all_japan_models = toyota_models + honda_models + mazda_models + nissan_models
            db.session.add_all(all_usa_models + all_germany_models + all_japan_models)
            db.session.commit()
            print(f"База даних ініціалізована {len(all_usa_models + all_germany_models + all_japan_models)} автомобілями.")
            
# Запуск початкового наповнення
def init_db(reset=False):
    """Створює базу даних та ініціалізує її даними.
    Якщо reset=True, то всі старі дані видаляються."""
    with app.app_context():
        # Якщо потрібно скинути базу даних (для режиму розробки)
        if reset:
            print(">>> Скидання існуючої бази даних...")
            db.drop_all()

        # Створення таблиць (якщо вони не існують)
        db.create_all()

        # Ініціалізація даних
        seed_data()

        # Створення адміністратора
        create_admin()

# Запуск Flask-сервера
if __name__ == '__main__':
    # Встановлюємо режим розробки
    DEV_MODE = True  

    if DEV_MODE:
        # У режимі розробки ми автоматично скидаємо базу даних при кожному запуску
        init_db(reset=True) 
    else:
        # У виробничому режимі ми просто створюємо таблиці, якщо вони не існують
        init_db(reset=False) 
        
    app.run(debug=DEV_MODE)