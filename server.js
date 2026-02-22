const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');

const app = express();
const db = new sqlite3.Database('./database.db'); // Файловая БД

app.use(express.json());
app.use(express.static('public'));
app.use(session({
    secret: 'shop-secret-key',
    resave: false,
    saveUninitialized: false
}));

// Инициализация БД
db.serialize(() => {
    // Таблица товаров
    db.run("CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, name TEXT, price REAL, stock INTEGER)");
    // Таблица пользователей
    db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT UNIQUE, password TEXT)");
    // Таблица покупок
    db.run("CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, user_id INTEGER, product_name TEXT, date TEXT)");

    // Наполнение товарами, если их нет
    db.get("SELECT count(*) as count FROM products", (err, row) => {
        if (row.count === 0) {
            const stmt = db.prepare("INSERT INTO products (name, price, stock) VALUES (?, ?, ?)");
            stmt.run("Netflix Premium", 790, 15);
            stmt.run("Spotify Premium", 250, 40);
            stmt.run("YouTube Premium", 199, 10);
            stmt.finalize();
        }
    });
});

// --- API: Авторизация ---
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    const hash = await bcrypt.hash(password, 10);
    db.run("INSERT INTO users (email, password) VALUES (?, ?)", [email, hash], (err) => {
        if (err) return res.status(400).json({ error: "Email уже занят" });
        res.json({ message: "Успешная регистрация" });
    });
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.userId = user.id;
            req.session.userEmail = user.email;
            res.json({ message: "Вход выполнен", email: user.email });
        } else {
            res.status(401).json({ error: "Неверные данные" });
        }
    });
});

app.get('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: "Вышли" });
});

// --- API: Магазин ---
app.get('/api/products', (req, res) => {
    db.all("SELECT * FROM products", [], (err, rows) => res.json(rows));
});

app.get('/api/user-info', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Не в сети" });
    db.all("SELECT * FROM orders WHERE user_id = ?", [req.session.userId], (err, orders) => {
        res.json({ email: req.session.userEmail, orders });
    });
});

app.post('/api/buy', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Нужна авторизация" });
    const { productId } = req.body;

    db.get("SELECT * FROM products WHERE id = ?", [productId], (err, product) => {
        if (!product || product.stock <= 0) return res.status(400).json({ error: "Нет в наличии" });

        // Здесь имитируем платеж. Если успешно:
        db.run("UPDATE products SET stock = stock - 1 WHERE id = ?", [productId]);
        db.run("INSERT INTO orders (user_id, product_name, date) VALUES (?, ?, ?)", 
            [req.session.userId, product.name, new Date().toLocaleString()]);
        
        res.json({ message: "Покупка оформлена! Доступ в личном кабинете." });
    });
});

app.listen(3000, () => console.log('Сайт запущен: http://localhost:3000'));