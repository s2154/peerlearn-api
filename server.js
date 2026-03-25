const express = require('express');
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();

app.use(cors());
app.use(express.json());

const SECRET_KEY = "mysecretkey";

// 🔐 OTP Store
const otpStore = {};

// ✅ DATABASE
const db = mysql.createConnection({
    host: 'sql12.freesqldatabase.com',
    user: 'sql12821119',
    password: 'GEE7CSYNkE',
    database: 'sql12821119'
});

// Connect DB
db.connect((err) => {
    if (err) {
        console.log('DB connection error:', err);
    } else {
        console.log('MySQL Connected ✅');
    }
});

// ==============================
// ROOT
// ==============================
app.get('/', (req, res) => {
    res.send('PeerLearn Backend Running 🚀');
});

// ==============================
// 🔥 SEND OTP (REGISTER / FORGOT)
// ==============================
app.get('/send-otp', async (req, res) => {
    const { email, type } = req.query;

    if (!email || !type) {
        return res.status(400).json({ message: 'Email & type required ❌' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);

    otpStore[email] = {
        otp,
        type,
        expiresAt: Date.now() + 5 * 60 * 1000
    };

    try {
        let transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            family: 4,   
            auth: {
                user: 'sotp2154@gmail.com',
                pass: 'womx ciwq sxyr mlyo'  // ← Replace with your new Gmail App Password
            }
        });

        await transporter.verify();  // ← Shows exact error in Render logs if Gmail rejects

        await transporter.sendMail({
            from: '"PeerLearn" <sotp2154@gmail.com>',
            to: email,
            subject: 'PeerLearn OTP',
            text: `Your OTP is: ${otp}`
        });

        console.log("OTP sent to:", email);

        res.json({ message: 'OTP sent ✅' });

    } catch (error) {
        console.log("OTP ERROR CODE:", error.code);
        console.log("OTP ERROR MESSAGE:", error.message);
        console.log("OTP RESPONSE:", error.response);
        res.status(500).json({ message: 'OTP failed ❌', error: error.message });
    }
});

// ==============================
// 🔥 VERIFY OTP
// ==============================
app.get('/verify-otp', (req, res) => {
    const { email, otp, username, password } = req.query;

    const record = otpStore[email];

    if (!record) {
        return res.status(400).json({ message: "No OTP found ❌" });
    }

    if (Date.now() > record.expiresAt) {
        delete otpStore[email];
        return res.status(400).json({ message: "OTP expired ⏳" });
    }

    if (record.otp == otp) {

        const type = record.type;
        delete otpStore[email];

        // 🟢 REGISTER FLOW
        if (type === "register") {

            if (!username || !password) {
                return res.status(400).json({ message: "Missing fields ❌" });
            }

            const checkSql = "SELECT * FROM users WHERE email = ?";
            db.query(checkSql, [email], (err, result) => {

                if (result.length > 0) {
                    return res.status(400).json({ message: "User already exists ❌" });
                }

                const sql = `
                    INSERT INTO users (username, email, password_hash)
                    VALUES (?, ?, ?)
                `;

                db.query(sql, [username, email, password], (err) => {
                    if (err) {
                        console.log(err);
                        return res.status(500).json({ message: "Signup failed ❌" });
                    }

                    return res.json({ message: "Account created ✅" });
                });
            });
        }

        // 🟡 FORGOT PASSWORD FLOW
        else if (type === "forgot") {
            return res.json({ message: "OTP verified, reset allowed ✅" });
        }

    } else {
        res.status(400).json({ message: "Invalid OTP ❌" });
    }
});

// ==============================
// 🔵 LOGIN
// ==============================
app.get('/login', (req, res) => {
    const { email, password } = req.query;

    const sql = 'SELECT * FROM users WHERE email = ? AND password_hash = ?';

    db.query(sql, [email, password], (err, result) => {
        if (result.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials ❌' });
        }

        const user = result[0];

        const token = jwt.sign(
            { user_id: user.user_id, email: user.email },
            SECRET_KEY,
            { expiresIn: '1h' }
        );

        res.json({
            message: 'Login success ✅',
            token,
            user
        });
    });
});

// ==============================
// 🔴 RESET PASSWORD
// ==============================
app.get('/reset-password', (req, res) => {
    const { email, newPassword } = req.query;

    const sql = "UPDATE users SET password_hash = ? WHERE email = ?";

    db.query(sql, [newPassword, email], (err) => {
        if (err) {
            return res.status(500).json({ message: "Reset failed ❌" });
        }

        res.json({ message: "Password updated ✅" });
    });
});

// ==============================
// SERVER
// ==============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} 🚀`);
});