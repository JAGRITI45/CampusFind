
const express = require("express");
const path = require("path");
const mysql = require("mysql2/promise");

const app = express();
const PORT = 3000;

// ========================================
// 1. DATABASE CONNECTION
// ========================================

const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: process.env.DB_PASSWORD,
    database: "lost_found_db",
    waitForConnections: true,
    connectionLimit: 10
});

// ========================================
// 2. MIDDLEWARE
// ========================================

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ========================================
// 3. TEST DATABASE CONNECTION
// ========================================

app.get("/api/test", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT DATABASE() AS db");

        res.json({
            message: "MySQL connected successfully!",
            database: rows[0].db
        });
    } catch (error) {
        console.error("Database test error:", error.message);
        res.status(500).json({
            message: "Database connection failed."
        });
    }
});

// ========================================
// 4. GET, SEARCH AND FILTER ITEMS
// ========================================

app.get("/api/items", async (req, res) => {
    try {
        const search = (req.query.search || "").trim();
        const type = req.query.type || "All";

        if (!["All", "Lost", "Found"].includes(type)) {
            return res.status(400).json({
                message: "Invalid report type."
            });
        }

        let sql = `
            SELECT
                id,
                item_name,
                category,
                description,
                location,
                DATE_FORMAT(item_date, '%Y-%m-%d') AS item_date,
                item_type,
                status
            FROM items
            WHERE 1 = 1
        `;

        const values = [];

        if (search) {
            sql += `
                AND (
                    item_name LIKE ?
                    OR category LIKE ?
                    OR location LIKE ?
                )
            `;

            const term = `%${search}%`;
            values.push(term, term, term);
        }

        if (type !== "All") {
            sql += " AND item_type = ?";
            values.push(type);
        }

        sql += " ORDER BY id DESC";

        const [items] = await db.execute(sql, values);
        res.json(items);

    } catch (error) {
        console.error("Load items error:", error.message);
        res.status(500).json({
            message: "Could not load items."
        });
    }
});

// ========================================
// 5. GET CONTACT DETAILS
// ========================================

app.get("/api/items/:id/contact", async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id < 1) {
            return res.status(400).json({
                message: "Invalid item ID."
            });
        }

        const [rows] = await db.execute(
            `SELECT reporter_name, contact_email, contact_phone
             FROM items WHERE id = ?`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                message: "Item not found."
            });
        }

        res.json({
            reporterName: rows[0].reporter_name,
            email: rows[0].contact_email,
            phone: rows[0].contact_phone
        });

    } catch (error) {
        console.error("Contact API error:", error.message);
        res.status(500).json({
            message: "Could not load contact details."
        });
    }
});

// ========================================
// 6. MARK AN ITEM AS RETURNED
// ========================================

app.put("/api/items/:id/status", async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id < 1) {
            return res.status(400).json({
                message: "Invalid item ID."
            });
        }

        const [result] = await db.execute(
            `UPDATE items
             SET status = 'Returned'
             WHERE id = ? AND status <> 'Returned'`,
            [id]
        );

        if (result.affectedRows === 0) {
            const [rows] = await db.execute(
                "SELECT status FROM items WHERE id = ?",
                [id]
            );

            if (rows.length === 0) {
                return res.status(404).json({
                    message: "Item not found."
                });
            }

            return res.status(400).json({
                message: "This item is already marked as returned."
            });
        }

        res.json({
            message: "Item marked as returned successfully!",
            itemId: id,
            status: "Returned"
        });

    } catch (error) {
        console.error("Update status error:", error.message);
        res.status(500).json({
            message: "Could not update item status."
        });
    }
});

// ========================================
// 7. SUBMIT A NEW LOST OR FOUND REPORT
// ========================================

app.post("/api/items", async (req, res) => {
    try {
        const {
            itemName,
            category,
            description,
            location,
            itemDate,
            itemType,
            reporterName,
            email,
            phone,
            contactConsent
        } = req.body;

        if (
            !itemName?.trim() ||
            !category?.trim() ||
            !location?.trim() ||
            !itemDate ||
            !reporterName?.trim() ||
            !email?.trim() ||
            !["Lost", "Found"].includes(itemType) ||
            contactConsent !== true
        ) {
            return res.status(400).json({
                message:
                    "Complete required fields and agree to contact sharing."
            });
        }

        const sql = `
            INSERT INTO items (
                item_name,
                category,
                description,
                location,
                item_date,
                item_type,
                status,
                reporter_name,
                contact_email,
                contact_phone
            )
            VALUES (?, ?, ?, ?, ?, ?, 'Open', ?, ?, ?)
        `;

        const [result] = await db.execute(sql, [
            itemName.trim(),
            category.trim(),
            description || "",
            location.trim(),
            itemDate,
            itemType,
            reporterName.trim(),
            email.trim(),
            phone?.trim() || null
        ]);

        res.status(201).json({
            message: "Report submitted successfully!",
            itemId: result.insertId
        });

    } catch (error) {
        console.error("Submit report error:", error.message);
        res.status(500).json({
            message: "Could not save report."
        });
    }
});

// ========================================
// 8. START SERVER
// ========================================

app.listen(PORT, () => {
    console.log(`CampusFind running at http://localhost:${PORT}`);
});
