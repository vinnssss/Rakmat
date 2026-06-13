CREATE DATABASE IF NOT EXISTS data_toko CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE data_toko;

-- Tabel users
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabel products (tambah kolom user_id)
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    sku VARCHAR(50),
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100),
    purchase_price DECIMAL(15,2) DEFAULT 0,
    selling_price DECIMAL(15,2) DEFAULT 0,
    stock INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabel sales (tambah kolom user_id)
CREATE TABLE IF NOT EXISTS sales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT,
    quantity INT NOT NULL,
    total_amount DECIMAL(15,2) NOT NULL,
    sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- Tabel purchases
CREATE TABLE IF NOT EXISTS purchases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT,
    quantity INT NOT NULL,
    total_amount DECIMAL(15,2) NOT NULL,
    purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- Tabel expenses (tambah kolom user_id)
CREATE TABLE IF NOT EXISTS expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    description VARCHAR(255),
    amount DECIMAL(15,2) NOT NULL,
    expense_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);



SET @dbname = DATABASE();

-- Cek & tambah user_id ke products
SET @stmt1 = IF(
    NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'products' AND COLUMN_NAME = 'user_id'
    ),
    'ALTER TABLE products ADD COLUMN user_id INT NULL AFTER id',
    'SELECT 1'
);
PREPARE stmt FROM @stmt1;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Cek & tambah user_id ke sales
SET @stmt2 = IF(
    NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'sales' AND COLUMN_NAME = 'user_id'
    ),
    'ALTER TABLE sales ADD COLUMN user_id INT NULL AFTER id',
    'SELECT 1'
);
PREPARE stmt FROM @stmt2;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Cek & tambah user_id ke expenses
SET @stmt3 = IF(
    NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'expenses' AND COLUMN_NAME = 'user_id'
    ),
    'ALTER TABLE expenses ADD COLUMN user_id INT NULL AFTER id',
    'SELECT 1'
);
PREPARE stmt FROM @stmt3;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
