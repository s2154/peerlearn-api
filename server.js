require('dotenv').config();   // 👈 ADD THIS LINE
const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());

const SECRET_KEY = "mysecretkey_changeme";

// ==============================
// 📧 NODEMAILER (Gmail) SETUP
// ==============================
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
    }
});
// ==============================
// 🗄️ SUPABASE (PostgreSQL) SETUP
// ==============================
const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});
db.connect((err) => {
    if (err) {
        console.log('❌ Supabase DB connection error:', err.message);
    } else {
        console.log('✅ Supabase PostgreSQL Connected!');
    }
});

// ==============================
// 🔐 OTP Store (In-memory)
// ==============================
const otpStore = {};

// ==============================
// ROOT
// ==============================
app.get('/', (req, res) => {
    res.send('PeerLearn Backend Running 🚀');
});

// ==============================
// 🔥 SEND OTP
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

    const mailOptions = {
        from: `"PeerLearn 🎓" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: 'PeerLearn - Your OTP Code',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 400px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #4f46e5;">PeerLearn 🎓</h2>
                <p>Hello! Your One-Time Password is:</p>
                <h1 style="letter-spacing: 8px; color: #4f46e5;">${otp}</h1>
                <p style="color: #888;">This OTP is valid for <strong>5 minutes</strong>. Do not share it with anyone.</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ OTP sent to: ${email}`);
        res.json({ message: 'OTP sent to your email ✅' });
    } catch (error) {
        console.log("❌ OTP Email Error:", error.message);
        res.status(500).json({ message: 'Failed to send OTP ❌', error: error.message });
    }
});

// ==============================
// 🔥 VERIFY OTP
// ==============================
app.get('/verify-otp', async (req, res) => {
    const { email, otp, username, password, firstName, lastName } = req.query;

    const record = otpStore[email];

    if (!record) {
        return res.status(400).json({ message: "No OTP found. Please request a new one ❌" });
    }

    if (Date.now() > record.expiresAt) {
        delete otpStore[email];
        return res.status(400).json({ message: "OTP expired ⏳. Please request a new one." });
    }

    if (record.otp == otp) {
        const type = record.type;
        delete otpStore[email];

        if (type === "register") {
            if (!username || !password || !firstName || !lastName) {
                return res.status(400).json({ message: "Missing fields ❌" });
            }

            try {
                const checkResult = await db.query(
                    "SELECT * FROM users WHERE email = $1", [email]
                );

                if (checkResult.rows.length > 0) {
                    return res.status(400).json({ message: "User already exists ❌" });
                }

                await db.query(
                    `INSERT INTO users (username, email, password_hash, first_name, last_name)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [username, email, password, firstName, lastName]
                );

                return res.json({ message: "Account created successfully ✅" });

            } catch (err) {
                console.log("DB Error:", err.message);
                return res.status(500).json({ message: "Signup failed ❌" });
            }
        }

        else if (type === "forgot") {
            return res.json({ message: "OTP verified. You can now reset your password ✅" });
        }

    } else {
        return res.status(400).json({ message: "Invalid OTP ❌" });
    }
});

// ==============================
// 🔵 LOGIN
// ==============================
app.get('/login', async (req, res) => {
    const { email, password } = req.query;

    try {
        const result = await db.query(
            'SELECT * FROM users WHERE email = $1 AND password_hash = $2',
            [email, password]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials ❌' });
        }

        const user = result.rows[0];

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

    } catch (err) {
        console.log("Login Error:", err.message);
        res.status(500).json({ message: "Login failed ❌" });
    }
});

// ==============================
// 🔴 RESET PASSWORD
// ==============================
app.get('/reset-password', async (req, res) => {
    const { email, newPassword } = req.query;

    try {
        await db.query(
            "UPDATE users SET password_hash = $1 WHERE email = $2",
            [newPassword, email]
        );

        res.json({ message: "Password updated successfully ✅" });

    } catch (err) {
        console.log("Reset Error:", err.message);
        res.status(500).json({ message: "Reset failed ❌" });
    }
});

// ==============================
// SERVER
// ==============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});