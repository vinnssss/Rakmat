const mysql = require('mysql2/promise');
require('dotenv').config();

// Membuat pool koneksi ke MySQL/MariaDB
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Tes koneksi saat server start
db.getConnection()
    .then(conn => {
        console.log(`✅ Berhasil terhubung ke database "${process.env.DB_NAME}"!`);
        conn.release();
    })
    .catch(err => {
        console.error("❌ Gagal terhubung ke database:", err.message);
        console.error("   Pastikan MySQL/MariaDB sudah berjalan & kredensial di .env sudah benar.");
    });

module.exports = db;
