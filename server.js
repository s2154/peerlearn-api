const express = require('express');
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

const SECRET_KEY = "mysecretkey";

// ✅ UPDATED: Use ONLINE DATABASE (NOT localhost)
const db = mysql.createConnection({
    host: 'sql12.freesqldatabase.com',   // 🔥 REPLACE
    user: 'sql12821119',                 // 🔥 YOUR USER
    password: 'GEE7CSYNkE',           // 🔥 REPLACE
    database: 'sql12821119'              // 🔥 YOUR DB
});

// Connect DB
db.connect((err) => {
    if (err) {
        console.log('DB connection error:', err);
    } else {
        console.log('MySQL Connected ✅');
    }
});

// USERS API
app.get('/users', (req, res) => {
    db.query('SELECT * FROM users', (err, result) => {
        if (err) {
            res.send(err);
        } else {
            res.json(result);
        }
    });
});

// REGISTER
app.get('/signup', (req, res) => {
    const { username, email, password, first_name, last_name } = req.query;

    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Missing fields ❌' });
    }

    const checkSql = 'SELECT * FROM users WHERE email = ?';

    db.query(checkSql, [email], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Server error ❌' });
        }

        if (result.length > 0) {
            return res.status(400).json({ message: 'Email already exists ❌' });
        }

        const sql = `
            INSERT INTO users (username, email, password_hash, first_name, last_name)
            VALUES (?, ?, ?, ?, ?)
        `;

        db.query(sql, [username, email, password, first_name, last_name], (err) => {
            if (err) {
                return res.status(500).json({ message: 'Signup failed ❌' });
            }

            res.json({ message: 'Signup successful ✅' });
        });
    });
});

// LOGIN
app.get('/login', (req, res) => {
    const { email, password } = req.query;

    const sql = 'SELECT * FROM users WHERE email = ? AND password_hash = ?';

    db.query(sql, [email, password], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Server error ❌' });
        }

        if (result.length === 0) {
            return res.status(401).json({
                message: 'Invalid email or password ❌'
            });
        }

        const user = result[0];

        const token = jwt.sign(
            { user_id: user.user_id, email: user.email },
            SECRET_KEY,
            { expiresIn: '1h' }
        );

        res.json({
            message: 'Login success ✅',
            token: token,
            user: user
        });
    });
});

// TOKEN VERIFY
function verifyToken(req, res, next) {
    const header = req.headers['authorization'];

    if (!header) {
        return res.status(401).send('No token ❌');
    }

    const token = header.split(' ')[1];

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(403).send('Invalid token ❌');
        }

        req.user = decoded;
        next();
    });
}

// PROTECTED
app.get('/profile', verifyToken, (req, res) => {
    res.json({
        message: 'Protected data ✅',
        user: req.user
    });
});

// ROOT
app.get('/', (req, res) => {
    res.send('PeerLearn Backend Running 🚀');
});

// ✅ IMPORTANT FOR RENDER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});