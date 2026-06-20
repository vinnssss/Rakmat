const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const db = require('./db');

const app = express();

app.use(cors());
app.use(express.json());

// ✅ FIX: Pastikan folder upload ada sebelum dipakai (Git tidak menyimpan folder kosong,
// jadi folder ini bisa hilang saat deploy ke Railway). Folder otomatis dibuat saat server start.
const uploadDir = path.join(__dirname, '../src/assets/images/');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log(`📁 Folder upload dibuat: ${uploadDir}`);
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// ✅ FIX: Backend dan Frontend itu 2 server terpisah di Railway.
// Tanpa baris ini, gambar yang di-upload tersimpan di backend
// tapi tidak bisa diakses lewat URL dari luar (jadi tidak akan pernah tampil).
// Baris ini membuat folder gambar bisa diakses publik via:
// https://rakmat-production.up.railway.app/assets/images/namafile.jpg
app.use('/assets/images', express.static(uploadDir));

app.get('/api/products', async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ status: 'error', message: 'User ID tidak ditemukan.' });

    try {
        const [rows] = await db.query('SELECT * FROM products WHERE user_id = ? ORDER BY id DESC', [user_id]);
        res.json({ status: 'success', data: rows });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ status: 'error', message: 'User ID tidak ditemukan.' });

    try {
        const [rows] = await db.query('SELECT * FROM products WHERE id = ? AND user_id = ?', [id, user_id]);
        if (rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Produk tidak ditemukan atau bukan milik Anda.' });
        }
        res.json({ status: 'success', data: rows[0] });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.post('/api/products', upload.single('image'), async (req, res) => {
    const { name, price, stock, category, user_id } = req.body;
    if (!user_id) return res.status(400).json({ status: 'error', message: 'Sesi login tidak valid. Silakan login ulang!' });

    const imageFilename = req.file ? req.file.filename : null;
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();

        const [existing] = await connection.query(
            `SELECT id, stock FROM products WHERE LOWER(name) = LOWER(?) AND LOWER(category) = LOWER(?) AND user_id = ? LIMIT 1`,
            [name.trim(), (category || '').trim(), user_id]
        );

        if (existing.length > 0) {
            const existingId = existing[0].id;
            let updateQuery = `UPDATE products SET stock = stock + ?, selling_price = ?, purchase_price = ?`;
            let queryParams = [Number(stock), Number(price), Number(price)];

            if (imageFilename) {
                updateQuery += `, image = ?`;
                queryParams.push(imageFilename);
            }
            
            updateQuery += ` WHERE id = ? AND user_id = ?`;
            queryParams.push(existingId, user_id);

            await connection.query(updateQuery, queryParams);
            await connection.query(
                `INSERT INTO expenses (description, amount, user_id) VALUES (?, ?, ?)`,
                [`Modal pembelian produk: ${name.trim()} (restok)`, Number(price) * Number(stock), user_id]
            );
            await connection.commit();
            res.json({ status: 'success', message: `Stok produk "${name.trim()}" berhasil ditambah!`, id: existingId });
        } else {
            const [result] = await connection.query(
                `INSERT INTO products (sku, name, category, purchase_price, selling_price, stock, user_id, image)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                ['BRG' + Date.now(), name.trim(), (category || '').trim(), Number(price), Number(price), Number(stock), user_id, imageFilename]
            );
            await connection.query(
                `INSERT INTO expenses (description, amount, user_id) VALUES (?, ?, ?)`,
                [`Modal pembelian produk: ${name.trim()}`, Number(price) * Number(stock), user_id]
            );
            await connection.commit();
            res.json({ status: 'success', message: 'Produk baru berhasil ditambahkan!', id: result.insertId });
        }
    } catch (error) {
        await connection.rollback();
        console.error("Database Error:", error);
        res.status(500).json({ status: 'error', message: error.message });
    } finally {
        connection.release();
    }
});

app.delete('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ status: 'error', message: 'User ID tidak ditemukan.' });

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [rows] = await connection.query('SELECT name FROM products WHERE id = ? AND user_id = ?', [id, user_id]);
        if (rows.length === 0) throw new Error('Produk tidak ditemukan atau bukan milik Anda.');
        
        const product = rows[0];
        const deskripsiPengeluaran = `Modal pembelian produk: ${product.name}`;
        
        await connection.query('DELETE FROM products WHERE id = ? AND user_id = ?', [id, user_id]);
        await connection.query(
            'UPDATE expenses SET amount = 0 WHERE description = ? AND user_id = ? LIMIT 1',
            [deskripsiPengeluaran, user_id]
        );
        await connection.commit();
        res.json({ status: 'success', message: 'Produk berhasil dihapus!' });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ status: 'error', message: error.message });
    } finally {
        connection.release();
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [users] = await db.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
        if (users.length > 0) {
            res.json({ status: 'success', message: 'Login berhasil', user: { id: users[0].id, username: users[0].username, name: users[0].name } });
        } else {
            res.status(401).json({ status: 'error', message: 'Username atau password salah!' });
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.post('/api/register', async (req, res) => {
    const { name, username, password } = req.body;
    if (!name || !username || !password) return res.status(400).json({ status: 'error', message: 'Wajib diisi.' });
    if (password.length < 6) return res.status(400).json({ status: 'error', message: 'Password minimal 6 karakter.' });
    
    try {
        const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [username.trim()]);
        if (existing.length > 0) return res.status(409).json({ status: 'error', message: 'Username sudah dipakai.' });
        
        await db.query('INSERT INTO users (username, password, name) VALUES (?, ?, ?)', [username.trim(), password, name.trim()]);
        res.json({ status: 'success', message: 'Akun berhasil dibuat!' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/dashboard-stats', async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ status: 'error', message: 'User ID tidak ditemukan.' });

    try {
        const [totalSales]    = await db.query('SELECT COALESCE(SUM(total_amount), 0) as total FROM sales WHERE user_id = ?', [user_id]);
        const [totalExpenses] = await db.query('SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE user_id = ?', [user_id]);

        const penjualan = Number(totalSales[0].total);
        const pengeluaran = Number(totalExpenses[0].total);
        res.json({
            status: 'success',
            data: { totalPenjualan: penjualan, totalPengeluaran: pengeluaran, totalKeuntungan: penjualan - pengeluaran }
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.post('/api/sales', async (req, res) => {
    const { product_id, quantity, total_amount, user_id } = req.body;
    if (!user_id) return res.status(400).json({ status: 'error', message: 'Sesi login tidak valid.' });

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [rows] = await connection.query('SELECT stock FROM products WHERE id = ? AND user_id = ?', [product_id, user_id]);
        if (rows.length === 0) throw new Error('Produk tidak ditemukan atau bukan milik Anda!');
        if (rows[0].stock < quantity) throw new Error('Stok tidak cukup!');
        
        await connection.query('UPDATE products SET stock = stock - ? WHERE id = ? AND user_id = ?', [quantity, product_id, user_id]);
        await connection.query(
            'INSERT INTO sales (product_id, quantity, total_amount, user_id) VALUES (?, ?, ?, ?)',
            [product_id, quantity, total_amount, user_id]
        );
        await connection.commit();
        res.json({ status: 'success', message: 'Penjualan berhasil dicatat!' });
    } catch (error) {
        await connection.rollback();
        res.status(400).json({ status: 'error', message: error.message });
    } finally {
        connection.release();
    }
});

app.get('/api/categories', async (req, res) => {
    const { user_id } = req.query;
    try {
        const [rows] = await db.query(
            'SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != "" AND user_id = ? ORDER BY category', [user_id]
        );
        res.json({ status: 'success', data: rows });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/laporan/grafik-bulanan', async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ status: 'error', message: 'User ID tidak ditemukan.' });

    try {
        const [dataPenjualan] = await db.query(`
            SELECT MONTH(sale_date) AS bulan, YEAR(sale_date) AS tahun, COALESCE(SUM(total_amount), 0) AS total
            FROM sales WHERE YEAR(sale_date) = YEAR(CURDATE()) AND user_id = ? GROUP BY YEAR(sale_date), MONTH(sale_date) ORDER BY MONTH(sale_date)
        `, [user_id]);

        const [dataPembelian] = await db.query(`
            SELECT MONTH(expense_date) AS bulan, YEAR(expense_date) AS tahun, COALESCE(SUM(amount), 0) AS total
            FROM expenses WHERE YEAR(expense_date) = YEAR(CURDATE()) AND user_id = ? GROUP BY YEAR(expense_date), MONTH(expense_date) ORDER BY MONTH(expense_date)
        `, [user_id]);

        const penjualanBulanan = Array(12).fill(0);
        const pembelianBulanan = Array(12).fill(0);

        dataPenjualan.forEach(row => { penjualanBulanan[row.bulan - 1] = Number(row.total); });
        dataPembelian.forEach(row => { pembelianBulanan[row.bulan - 1] = Number(row.total); });

        const totalPenjualan = penjualanBulanan.reduce((a, b) => a + b, 0);
        const totalPembelian = pembelianBulanan.reduce((a, b) => a + b, 0);

        const [produkTerjual] = await db.query('SELECT COALESCE(SUM(quantity), 0) AS total FROM sales WHERE YEAR(sale_date) = YEAR(CURDATE()) AND user_id = ?', [user_id]);
        const [stokRendah] = await db.query('SELECT COUNT(*) AS total FROM products WHERE stock < 10 AND stock > 0 AND user_id = ?', [user_id]);
        const [stokHabis] = await db.query('SELECT COUNT(*) AS total FROM products WHERE stock <= 0 AND user_id = ?', [user_id]);

        res.json({
            status: 'success',
            data: {
                penjualanBulanan, pembelianBulanan, totalPenjualan, totalPembelian,
                totalKeuntungan: totalPenjualan - totalPembelian,
                produkTerjual: Number(produkTerjual[0].total),
                stokRendah: Number(stokRendah[0].total),
                stokHabis: Number(stokHabis[0].total)
            }
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/dashboard/grafik-bulanan', async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ status: 'error', message: 'User ID tidak ditemukan.' });

    try {
        const [dataPenjualan] = await db.query(`
            SELECT MONTH(sale_date) AS bulan, COALESCE(SUM(total_amount), 0) AS total
            FROM sales WHERE YEAR(sale_date) = YEAR(CURDATE()) AND user_id = ? GROUP BY MONTH(sale_date) ORDER BY MONTH(sale_date)
        `, [user_id]);

        const [dataPengeluaran] = await db.query(`
            SELECT MONTH(expense_date) AS bulan, COALESCE(SUM(amount), 0) AS total
            FROM expenses WHERE YEAR(expense_date) = YEAR(CURDATE()) AND user_id = ? GROUP BY MONTH(expense_date) ORDER BY MONTH(expense_date)
        `, [user_id]);

        const penjualanBulanan = Array(12).fill(0);
        const pengeluaranBulanan = Array(12).fill(0);

        dataPenjualan.forEach(row => { penjualanBulanan[row.bulan - 1] = Number(row.total); });
        dataPengeluaran.forEach(row => { pengeluaranBulanan[row.bulan - 1] = Number(row.total); });

        res.json({ status: 'success', data: { penjualanBulanan, pengeluaranBulanan } });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/', (req, res) => {
    res.send('Backend hidup');
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server Backend berjalan di http://localhost:${PORT}`);
});