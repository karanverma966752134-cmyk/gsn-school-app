const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { parse } = require('csv-parse');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const app = express();
const PORT = process.env.PORT || 3000;
// On cloud hosts like Render the app must bind to 0.0.0.0 so the external port is reachable.
const HOST = process.env.HOST || '0.0.0.0';

const DB_FILE = path.join(__dirname, "db.sqlite");
const SCHEMA_FILE = path.join(__dirname, "schema.sql");
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

const db = new sqlite3.Database(DB_FILE);

// Convenience promise-based DB helpers
function dbAll(sql, p = []) { return new Promise((resolve, reject) => { db.all(sql, p, (err, rows) => (err ? reject(err) : resolve(rows || []))); }); }
function dbGet(sql, p = []) { return new Promise((resolve, reject) => { db.get(sql, p, (err, row) => (err ? reject(err) : resolve(row))); }); }
function dbRun(sql, p = []) { return new Promise((resolve, reject) => { db.run(sql, p, function (err) { if (err) reject(err); else resolve(this); }); }); }

// Authentication middleware used by protected routes
function authenticateToken(req, res, next) {
  const auth = req.headers['authorization'] || req.headers['Authorization'];
  if (!auth) return res.status(401).json({ error: 'Missing Authorization' });
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Invalid Authorization format' });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.role) return res.status(403).json({ error: 'Forbidden' });
  if (String(req.user.role).toLowerCase() !== 'admin') return res.status(403).json({ error: 'Admin role required' });
  next();
}

function requireTeacherOrAdmin(req, res, next) {
  if (!req.user || !req.user.role) return res.status(403).json({ error: 'Forbidden' });
  const r = String(req.user.role).toLowerCase();
  if (r !== 'admin' && r !== 'teacher') return res.status(403).json({ error: 'Teacher or Admin role required' });
  next();
}

// Run schema + set default passwords
function initDB() {
  try {
    const schema = fs.readFileSync(SCHEMA_FILE, "utf8");
    db.exec(schema);
    console.log("Schema executed successfully - Database initialized");
    
    const hash = bcrypt.hashSync("password123", 10);
    db.serialize(() => {
      db.run("INSERT OR IGNORE INTO staff (staff_id, name, role, subject, phone, email, password_hash) VALUES (?,?,?,?,?,?,?)", 
        ["GSN-T-001", "Karan Verma", "Teacher", "English", "98xxxxxx90", "karan@gsn.edu", hash]);
      db.run("INSERT OR IGNORE INTO staff (staff_id, name, role, subject, phone, email, password_hash) VALUES (?,?,?,?,?,?,?)",
        ["GSN-A-001", "Neha Sharma", "Admin", null, "98xxxxxx32", "admin@gsn.edu", hash]);
      db.run("INSERT OR IGNORE INTO staff (staff_id, name, role, subject, phone, email, password_hash) VALUES (?,?,?,?,?,?,?)",
        ["GSN-P-001", "Principal Sir", "Principal", null, "98xxxxxx11", "principal@gsn.edu", hash]);
      db.run("INSERT OR IGNORE INTO students (adm_no, name, class, section, contact, status) VALUES (?,?,?,?,?,?)",
        ["2025/001", "Aarav Sharma", "6", "A", "98xxxxxx21", "Active"]);
      db.run("INSERT OR IGNORE INTO students (adm_no, name, class, section, contact, status) VALUES (?,?,?,?,?,?)",
        ["2025/002", "Siya Verma", "8", "B", "98xxxxxx45", "Active"]);
      db.run("INSERT OR IGNORE INTO students (adm_no, name, class, section, contact, status) VALUES (?,?,?,?,?,?)",
        ["2025/045", "Mohit Gupta", "10", "C", "98xxxxxx01", "Active"]);
      db.run("INSERT OR IGNORE INTO fees (student_id, last_paid_month, balance) SELECT id, '2025-11', 0 FROM students WHERE adm_no='2025/001'");
      db.run("INSERT OR IGNORE INTO fees (student_id, last_paid_month, balance) SELECT id, '2025-09', 8500 FROM students WHERE adm_no='2025/045'", function(err) {
        if (!err) {
          console.log("Default staff passwords set");
          console.log("Sample data inserted successfully");
        }
      });
    });
  } catch (err) {
    console.error("Schema error:", err.message);
    process.exit(1);
  }
}

initDB();

// Start server after a short delay to ensure DB is initialized
// Server is started by the init/migration flow later (startServer)
// The server start logic has been moved to the startServer function.
// The server will be initialized after the database is ready.

// Keep process alive
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

/* ===== LOGIN ===== */
app.post("/api/login", async (req, res) => {
  try {
    const { staffId, password } = req.body;
    if (!staffId || !password) {
      return res.status(400).json({ error: "Staff ID and password required" });
    }

    const row = await dbGet("SELECT * FROM staff WHERE staff_id = ?", [staffId]);
    if (!row) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const ok = bcrypt.compareSync(password, row.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = {
      id: row.id,
      name: row.name,
      staffId: row.staff_id,
      role: row.role,
      subject: row.subject,
      email: row.email,
      phone: row.phone
    };
    const token = jwt.sign({ id: user.id, role: user.role, staffId: user.staffId }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, user });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ===== DASHBOARD SUMMARY ===== */
app.get("/api/dashboard", async (req, res) => {
  try {
    const totalStudents = await dbGet("SELECT COUNT(*) AS c FROM students");
    const totalStaff = await dbGet("SELECT COUNT(*) AS c FROM staff");
    const feesPending = await dbGet("SELECT SUM(balance) AS total FROM fees");

    res.json({
      totalStudents: totalStudents.c || 0,
      totalStaff: totalStaff.c || 0,
      pendingFees: feesPending.total || 0
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ===== STUDENTS ===== */
app.get("/api/students", async (req, res) => {
  try {
    const rows = await dbAll(
      "SELECT * FROM students ORDER BY class, section, adm_no"
    );
    res.json(rows);
  } catch (err) {
    console.error("Students error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/students", async (req, res) => {
  try {
    const { adm_no, name, class: cls, section, contact, status } = req.body;
    if (!adm_no || !name || !cls || !section) {
      return res.status(400).json({ error: "Missing fields" });
    }
    await dbRun(
      "INSERT INTO students (adm_no, name, class, section, contact, status) VALUES (?,?,?,?,?,?)",
      [adm_no, name, cls, section, contact || "", status || "Active"]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Add student error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ===== ATTENDANCE ===== */
app.get("/api/attendance", async (req, res) => {
  try {
    const { date, class: cls, section } = req.query;
    if (!date || !cls || !section) {
      return res
        .status(400)
        .json({ error: "date, class, section are required" });
    }

    const students = await dbAll(
      "SELECT * FROM students WHERE class = ? AND section = ? ORDER BY adm_no",
      [cls, section]
    );
    const ids = students.map((s) => s.id);
    if (!ids.length) return res.json([]);

    const placeholders = ids.map(() => "?").join(",");
    const attRows = await dbAll(
      `SELECT * FROM attendance WHERE date = ? AND student_id IN (${placeholders})`,
      [date, ...ids]
    );
    const attMap = {};
    attRows.forEach((r) => {
      attMap[r.student_id] = r;
    });

    const result = students.map((s) => ({
      student: s,
      attendance: attMap[s.id] || null
    }));

    res.json(result);
  } catch (err) {
    console.error("Attendance get error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/attendance", authenticateToken, requireTeacherOrAdmin, async (req, res) => {
  try {
    const { date, records } = req.body;
    if (!date || !Array.isArray(records)) {
      return res
        .status(400)
        .json({ error: "date and records[] are required" });
    }

    const stmt = db.prepare(
      "INSERT INTO attendance (student_id, date, status, remark) VALUES (?,?,?,?) ON CONFLICT(student_id, date) DO UPDATE SET status = excluded.status, remark = excluded.remark"
    );

    db.serialize(() => {
      records.forEach((r) => {
        stmt.run(r.student_id, date, r.status, r.remark || "");
      });
      stmt.finalize((err) => {
        if (err) {
          console.error("Attendance save error:", err);
          return res.status(500).json({ error: "Error saving attendance" });
        }
        res.json({ success: true });
      });
    });
  } catch (err) {
    console.error("Attendance post error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ===== FEES ===== */
app.get("/api/fees", async (req, res) => {
  try {
    const rows = await dbAll(
      `SELECT s.id AS student_id, s.adm_no, s.name, s.class, s.section,
              COALESCE(f.last_paid_month, '-') AS last_paid_month,
              COALESCE(f.balance, 0) AS balance
       FROM students s
       LEFT JOIN fees f ON s.id = f.student_id
       ORDER BY s.class, s.section, s.adm_no`
    );
    // transform to { student_id, student: { ... }, last_paid_month, balance }
    const out = rows.map(r => ({
      student_id: r.student_id,
      student: { adm_no: r.adm_no, name: r.name, class: r.class, section: r.section },
      last_paid_month: r.last_paid_month,
      balance: r.balance
    }));
    res.json(out);
  } catch (err) {
    console.error("Fees error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Record a fee payment
app.post('/api/fees', authenticateToken, requireTeacherOrAdmin, async (req, res) => {
  try {
    const { student_id, amount, month, mode, notes } = req.body;
    if (!student_id || !amount || Number(amount) <= 0) return res.status(400).json({ error: 'student_id and amount are required' });

    // ensure student exists
    const student = await dbGet('SELECT id FROM students WHERE id = ?', [student_id]);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    // create fees record if missing
    let feesRow = await dbGet('SELECT * FROM fees WHERE student_id = ?', [student_id]);
    if (!feesRow) {
      await dbRun('INSERT INTO fees (student_id, last_paid_month, balance) VALUES (?,?,?)', [student_id, '', 0]);
      feesRow = await dbGet('SELECT * FROM fees WHERE student_id = ?', [student_id]);
    }

    // insert payment record
    const ins = await dbRun('INSERT INTO payments (student_id, amount, month, mode, notes) VALUES (?,?,?,?,?)', [student_id, amount, month || '', mode || '', notes || '']);

    // update balance and last_paid_month
    const newBalance = Number((Number(feesRow.balance || 0) - Number(amount)).toFixed(2));
    await dbRun('UPDATE fees SET balance = ?, last_paid_month = ? WHERE student_id = ?', [newBalance, month || feesRow.last_paid_month || '', student_id]);

    const updatedFees = await dbGet('SELECT * FROM fees WHERE student_id = ?', [student_id]);
    res.json({ success: true, paymentId: ins.lastID, fees: updatedFees });
  } catch (err) {
    console.error('Fees POST error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// (Removed duplicate/broken payments handler; valid payments & receipt handlers exist later in the file.)

/* ===== HOMEWORK (demo) ===== */
app.get("/api/homework", async (req, res) => {
  try {
    const rows = await dbAll(
      "SELECT * FROM homework ORDER BY created_at DESC LIMIT 20"
    );
    res.json(rows);
  } catch (err) {
    console.error("Homework error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/homework", async (req, res) => {
  try {
    const {
      class: cls,
      section,
      subject,
      title,
      instructions,
      due_date,
      created_by_staff_id
    } = req.body;
    if (!cls || !section || !subject || !title) {
      return res.status(400).json({ error: "Missing fields" });
    }
    await dbRun(
      `INSERT INTO homework (class, section, subject, title, instructions, due_date, created_by_staff_id)
       VALUES (?,?,?,?,?,?,?)`,
      [
        cls,
        section,
        subject,
        title,
        instructions || "",
        due_date || "",
        created_by_staff_id || null
      ]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Homework add error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ===== STAFF MANAGEMENT (CRUD) ===== */
app.get('/api/staff', authenticateToken, async (req, res) => {
  try {
    const rows = await dbAll('SELECT id, staff_id, name, role, subject, phone, email FROM staff ORDER BY id');
    res.json(rows);
  } catch (err) {
    console.error('Staff list error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/staff', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { staff_id, name, role, subject, phone, email } = req.body;
    if (!staff_id || !name || !role) return res.status(400).json({ error: 'Missing fields' });
    await dbRun('INSERT INTO staff (staff_id, name, role, subject, phone, email, password_hash) VALUES (?,?,?,?,?,?,?)', [staff_id, name, role, subject||null, phone||null, email||null, '']);
    res.json({ success: true });
  } catch (err) {
    console.error('Add staff error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/staff/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    await dbRun('DELETE FROM staff WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete staff error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update staff
app.put('/api/staff/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const { staff_id, name, role, subject, phone, email } = req.body;
    await dbRun('UPDATE staff SET staff_id = ?, name = ?, role = ?, subject = ?, phone = ?, email = ? WHERE id = ?', [staff_id, name, role, subject||null, phone||null, email||null, id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Update staff error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Import students (JSON array) - Admin only
app.post('/api/import/students', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const rows = req.body;
    if(!Array.isArray(rows)) return res.status(400).json({ error: 'Expected array of rows' });
    for(const r of rows){
      const adm_no = (r.adm_no||r.admNo||r.adm||'').toString().trim();
      const name = (r.name||'').toString().trim();
      const cls = (r.class||r.cls||r.className||'').toString().trim();
      const section = (r.section||'').toString().trim();
      const contact = (r.contact||'').toString().trim();
      const status = (r.status||'Active').toString().trim();
      if(!adm_no || !name || !cls || !section) continue; // skip invalid
      const existing = await dbGet('SELECT id FROM students WHERE adm_no = ?', [adm_no]);
      if(existing){
        await dbRun('UPDATE students SET name = ?, class = ?, section = ?, contact = ?, status = ? WHERE id = ?', [name, cls, section, contact, status, existing.id]);
      } else {
        await dbRun('INSERT INTO students (adm_no, name, class, section, contact, status) VALUES (?,?,?,?,?,?)', [adm_no, name, cls, section, contact, status]);
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Import students error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});
// ...existing code...

// Init
try {
  const schema = fs.readFileSync(SCHEMA_FILE, "utf8");
  db.exec(schema, async (err) => {
    if (err) { console.error("Schema error:", err); process.exit(1); }
    console.log(" Schema initialized");
    try {
      // Ensure students.tc_verified column exists (safe migration)
      const cols = await dbAll("PRAGMA table_info(students)");
      const hasTc = cols.some(c => c.name === 'tc_verified');
      if (!hasTc) {
        console.log('Adding students.tc_verified column');
        await dbRun("ALTER TABLE students ADD COLUMN tc_verified INTEGER DEFAULT 0");
      }
    } catch (merr) {
      console.warn('Migration warning:', merr.message || merr);
    }
    startServer();
  });
} catch (err) {
  console.error("Init error:", err);
  process.exit(1);
}

function dbAll(sql, p=[]) { return new Promise((res, rej) => db.all(sql, p, (err, rows) => err ? rej(err) : res(rows||[]))); }
function dbGet(sql, p=[]) { return new Promise((res, rej) => db.get(sql, p, (err, row) => err ? rej(err) : res(row))); }
function dbRun(sql, p=[]) { return new Promise((res, rej) => db.run(sql, p, function(err) { if (err) rej(err); else res(this); })); }

// API
app.post("/api/login", async (req, res) => {
  try {
    const { staffId, password } = req.body;
    if (!staffId || !password) return res.status(400).json({ error: "Required" });
    const row = await dbGet("SELECT * FROM staff WHERE staff_id = ?", [staffId]);
    if (!row) return res.status(401).json({ error: "Invalid" });
    if (!bcrypt.compareSync(password, row.password_hash)) return res.status(401).json({ error: "Invalid" });
    const user = { id: row.id, name: row.name, staffId: row.staff_id, role: row.role };
    const token = jwt.sign({ id: user.id, role: user.role, staffId: user.staffId }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/dashboard", async (req, res) => {
  try {
    const s = await dbAll("SELECT COUNT(*) as cnt FROM students");
    const f = await dbAll("SELECT COUNT(*) as cnt FROM fees");
    const p = await dbAll("SELECT SUM(balance) as tot FROM fees");
    res.json({ totalStudents: s[0]?.cnt || 0, totalFees: f[0]?.cnt || 0, pendingFees: p[0]?.tot || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/students", async (req, res) => {
  try {
    const students = await dbAll("SELECT * FROM students ORDER BY adm_no");
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/students", async (req, res) => {
  try {
    const { adm_no, name, class: cls, section, contact, status } = req.body;
    await dbRun("INSERT INTO students (adm_no, name, class, section, contact, status) VALUES (?,?,?,?,?,?)", [adm_no, name, cls, section, contact, status || "Active"]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/students/:id", async (req, res) => {
  try {
    const { name, class: cls, section, contact, status, tc_verified } = req.body;
    // allow updating tc_verified (0/1) along with other fields
    await dbRun("UPDATE students SET name=?, class=?, section=?, contact=?, status=?, tc_verified=? WHERE id=?", [name, cls, section, contact, status, tc_verified ? 1 : 0, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/students/next-adm', async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const rows = await dbAll("SELECT adm_no FROM students WHERE adm_no LIKE ?", [`${year}/%`]);
    let max = 0;
    rows.forEach(r => {
      if (!r.adm_no) return;
      const m = r.adm_no.match(new RegExp(`^${year}\\/(\\d+)$`));
      if (m) {
        const n = parseInt(m[1], 10);
        if (!isNaN(n) && n > max) max = n;
      }
    });
    const next = String(max + 1).padStart(3, '0');
    res.json({ adm_no: `${year}/${next}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/students/:id", async (req, res) => {
  try {
    await dbRun("DELETE FROM students WHERE id=?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/fees", async (req, res) => {
  try {
    const fees = await dbAll("SELECT f.*, s.adm_no, s.name, s.class FROM fees f JOIN students s ON f.student_id = s.id ORDER BY s.adm_no");
    res.json(fees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/fees", async (req, res) => {
  try {
    const { student_id, amount, month, mode, notes } = req.body;
    const result = await dbRun("INSERT INTO payments (student_id, amount, month, mode, notes, created_at) VALUES (?,?,?,?,?,datetime('now'))", [student_id, amount, month, mode, notes || ""]);
    const paymentId = result.lastID;
    await dbRun("UPDATE fees SET balance = balance - ? WHERE student_id = ?", [amount, student_id]);
    const updated = await dbGet("SELECT balance FROM fees WHERE student_id=?", [student_id]);
    res.json({ success: true, paymentId, balance: updated?.balance || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/payments", async (req, res) => {
  try {
    const student_id = req.query.student_id;
    const payments = await dbAll("SELECT p.*, s.adm_no, s.name FROM payments p JOIN students s ON p.student_id = s.id" + (student_id ? " WHERE p.student_id = ?" : "") + " ORDER BY p.created_at DESC", student_id ? [student_id] : []);
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/receipt/:id", async (req, res) => {
  try {
    const p = await dbGet("SELECT p.*, s.adm_no, s.name, s.class FROM payments p JOIN students s ON p.student_id = s.id WHERE p.id=?", [req.params.id]);
    if (!p) return res.status(404).json({ error: "Not found" });
    const html = `<!DOCTYPE html><html><head><title>Receipt #${p.id}</title><style>body{font-family:Arial;max-width:600px;margin:40px auto;padding:20px}.hd{text-align:center;border-bottom:2px solid #2563eb;padding-bottom:10px;margin-bottom:30px}.hd h1{margin:0;color:#2563eb}.info{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:30px 0}.il{font-size:12px;color:#666}.iv{font-size:16px;font-weight:bold}.amt{background:#f0f9ff;padding:20px;border-radius:8px;text-align:center;margin:30px 0}.av{font-size:32px;font-weight:bold;color:#2563eb}</style></head><body><div class="hd"><h1>Payment Receipt</h1><p>GSN PUBLIC SCHOOL</p></div><div class="info"><div><div class="il">Receipt #</div><div class="iv">#${p.id}</div></div><div><div class="il">Date</div><div class="iv">${new Date(p.created_at).toLocaleDateString()}</div></div><div><div class="il">Adm No</div><div class="iv">${p.adm_no}</div></div><div><div class="il">Student</div><div class="iv">${p.name}</div></div><div><div class="il">Class</div><div class="iv">${p.class}</div></div><div><div class="il">Month</div><div class="iv">${p.month}</div></div></div><div class="amt"><div class="il">Amount Paid</div><div class="av">₹${p.amount}</div></div></body></html>`;
    res.send(html);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function seedData() {
  const hash = bcrypt.hashSync("password123", 10);
  db.run("INSERT OR IGNORE INTO staff (staff_id, name, role, subject, phone, email, password_hash) VALUES (?,?,?,?,?,?,?)", ["GSN-T-001", "Karan Verma", "Teacher", "English", "98xxxxxx90", "karan@gsn.edu", hash], (err) => {
    if (err) console.error("Seed staff 1 error:", err);
  });
  db.run("INSERT OR IGNORE INTO staff (staff_id, name, role, subject, phone, email, password_hash) VALUES (?,?,?,?,?,?,?)", ["GSN-A-001", "Neha Sharma", "Admin", null, "98xxxxxx32", "admin@gsn.edu", hash], (err) => {
    if (err) console.error("Seed staff 2 error:", err);
  });
  db.run("INSERT OR IGNORE INTO staff (staff_id, name, role, subject, phone, email, password_hash) VALUES (?,?,?,?,?,?,?)", ["GSN-P-001", "Principal Sir", "Principal", null, "98xxxxxx11", "principal@gsn.edu", hash], (err) => {
    if (err) console.error("Seed staff 3 error:", err);
  });
  db.run("INSERT OR IGNORE INTO students (adm_no, name, class, section, contact, status) VALUES (?,?,?,?,?,?)", ["2025/001", "Aarav Sharma", "6", "A", "98xxxxxx21", "Active"], (err) => {
    if (err) console.error("Seed student 1 error:", err);
  });
  db.run("INSERT OR IGNORE INTO students (adm_no, name, class, section, contact, status) VALUES (?,?,?,?,?,?)", ["2025/002", "Siya Verma", "8", "B", "98xxxxxx45", "Active"], (err) => {
    if (err) console.error("Seed student 2 error:", err);
  });
  db.run("INSERT OR IGNORE INTO students (adm_no, name, class, section, contact, status) VALUES (?,?,?,?,?,?)", ["2025/045", "Mohit Gupta", "10", "C", "98xxxxxx01", "Active"], (err) => {
    if (err) console.error("Seed student 3 error:", err);
  });
  db.run("INSERT OR IGNORE INTO fees (student_id, last_paid_month, balance) SELECT id, '2025-11', 0 FROM students WHERE adm_no='2025/001'", (err) => {
    if (err) console.error("Seed fees 1 error:", err);
  });
  db.run("INSERT OR IGNORE INTO fees (student_id, last_paid_month, balance) SELECT id, '2025-09', 8500 FROM students WHERE adm_no='2025/045'", (err) => {
    if (err) console.error("Seed fees 2 error:", err);
  });
}

function startServer() {
  try {
    seedData();
    console.log("Seeding data...");
    
    // Give seeds a moment to complete before listening
    setTimeout(() => {
      try {
        const server = app.listen(PORT, HOST, () => {
          const seenHost = (HOST === '0.0.0.0') ? '0.0.0.0 (all interfaces)' : HOST;
          console.log(` Server at http://${seenHost}:${PORT}`);
          console.log("✅ Server listening - ready for requests");
        });
        
        server.on('error', (err) => {
          console.error("❌ Server error:", err.message);
        });
        
        server.on('close', () => {
          console.log("⚠️  Server closed");
        });
        
        // Keep process alive explicitly
        const keepAlive = setInterval(() => {}, 60000);
        keepAlive.unref();
        console.log("✅ Process keep-alive enabled");
      } catch (err) {
        console.error("❌ Listen error:", err.message);
      }
    }, 500);
  } catch (err) {
    console.error("startServer error:", err.message);
    process.exit(1);
  }
}

process.on('uncaughtException', (err) => {
  console.error("❌ UNCAUGHT EXCEPTION:", err.message);
  console.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error("❌ UNHANDLED REJECTION at:", promise, "reason:", reason);
});
