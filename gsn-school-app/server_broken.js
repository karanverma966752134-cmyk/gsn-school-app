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

const DB_FILE = path.join(__dirname, "db.sqlite");
const SCHEMA_FILE = path.join(__dirname, "schema.sql");
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

const db = new sqlite3.Database(DB_FILE);

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
setTimeout(() => {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`GSN Staff app running at http://localhost:${PORT}`);
  });
  
  server.on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
  });
}, 1000);

// Keep process alive
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

// Helpers
function dbAll(sql, p = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, p, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}
function dbGet(sql, p = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, p, (err, row) => (err ? reject(err) : resolve(row)));
  });
}
function dbRun(sql, p = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, p, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

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

// Get payments (optionally filtered by student_id)
app.get('/api/payments', authenticateToken, requireTeacherOrAdmin, async (req, res) => {
  try {
    const { student_id } = req.query;
    let rows;
    if (student_id) {
      rows = await dbAll('SELECT p.*, s.adm_no, s.name, s.class, s.section FROM payments p JOIN students s ON p.student_id = s.id WHERE p.student_id = ? ORDER BY p.created_at DESC', [student_id]);
    } else {
      rows = await dbAll('SELECT p.*, s.adm_no, s.name, s.class, s.section FROM payments p JOIN students s ON p.student_id = s.id ORDER BY p.created_at DESC');
    }
    res.json(rows);
  } catch (err) {
    console.error('Payments GET error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Serve a printable receipt HTML for a payment id.
// Accepts Authorization header OR ?token=JWT for convenience when opening in a new window.
app.get('/api/receipt/:id', async (req, res) => {
  try {
    const token = (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]) || req.query.token;
    if (!token) return res.status(401).send('Missing token');
    let payload;
    try { payload = jwt.verify(token, JWT_SECRET); } catch (e) { return res.status(401).send('Invalid token'); }

    const id = req.params.id;
    const p = await dbGet('SELECT p.*, s.adm_no, s.name, s.class, s.section FROM payments p JOIN students s ON p.student_id = s.id WHERE p.id = ?', [id]);
    if (!p) return res.status(404).send('Payment not found');

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${p.id}</title>
      <style>body{font-family:Arial,Helvetica,sans-serif;padding:20px;color:#111} .box{max-width:720px;margin:0 auto;border:1px solid #222;padding:18px;border-radius:6px}
      h2{margin:0 0 8px} table{width:100%;border-collapse:collapse} td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}
      .right{text-align:right}</style></head><body><div class="box"><h2>GSN PUBLIC SCHOOL</h2><p>Shernagar, Muzaffarnagar</p>
      <h3>Fee Receipt</h3>
      <table><tr><td><strong>Receipt No</strong></td><td>${p.id}</td><td class="right"><strong>Date</strong></td><td>${p.created_at}</td></tr>
      <tr><td><strong>Student</strong></td><td>${p.name} (${p.adm_no})</td><td class="right"><strong>Class/Section</strong></td><td>${p.class}-${p.section}</td></tr>
      </table>
      <table style="margin-top:12px"><tr><th>Description</th><th class="right">Amount</th></tr>
      <tr><td>Fee payment for ${p.month || '-'}</td><td class="right">₹${Number(p.amount).toFixed(2)}</td></tr>
      <tr><th class="right">Total</th><th class="right">₹${Number(p.amount).toFixed(2)}</th></tr></table>
      <p style="margin-top:12px"><strong>Mode:</strong> ${p.mode || '-'} &nbsp; <strong>Notes:</strong> ${p.notes || '-'}</p>
      <p style="margin-top:24px;font-size:12px;color:#666">This is an auto-generated receipt. Use browser print to save as PDF.</p>
      </div></body></html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error('Receipt error:', err);
    res.status(500).send('Server error');
  }
});

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

// Import attendance (JSON array) - Teacher or Admin
app.post('/api/import/attendance', authenticateToken, requireTeacherOrAdmin, async (req, res) => {
  try {
    const rows = req.body;
    if(!Array.isArray(rows)) return res.status(400).json({ error: 'Expected array of rows' });
    const stmt = db.prepare('INSERT INTO attendance (student_id, date, status, remark) VALUES (?,?,?,?) ON CONFLICT(student_id, date) DO UPDATE SET status = excluded.status, remark = excluded.remark');
    db.serialize(async () => {
      for(const r of rows){
        const adm = (r.adm_no||r.admNo||r.adm||'').toString().trim();
        const date = (r.date||'').toString().trim();
        const status = (r.status||'Absent').toString().trim();
        const remark = (r.remark||'').toString().trim();
        if(!adm || !date) continue;
        const s = await dbGet('SELECT id FROM students WHERE adm_no = ?', [adm]);
        if(!s) continue;
        stmt.run(s.id, date, status, remark);
      }
      stmt.finalize((err) => {
        if(err){ console.error('Import attendance finalize error:', err); return res.status(500).json({ error: 'Error saving attendance' }); }
        res.json({ success: true });
      });
    });
  } catch (err) {
    console.error('Import attendance error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Import staff (JSON array) - Admin only
app.post('/api/import/staff', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const rows = req.body;
    if(!Array.isArray(rows)) return res.status(400).json({ error: 'Expected array' });
    for(const r of rows){
      const staff_id = (r.staff_id||r.staffId||'').toString().trim();
      const name = (r.name||'').toString().trim();
      const role = (r.role||'Teacher').toString().trim();
      const phone = (r.phone||'').toString().trim();
      const email = (r.email||'').toString().trim();
      if(!staff_id || !name) continue;
      const existing = await dbGet('SELECT id FROM staff WHERE staff_id = ?', [staff_id]);
      if(existing){
        await dbRun('UPDATE staff SET name = ?, role = ?, phone = ?, email = ? WHERE id = ?', [name, role, phone, email, existing.id]);
      } else {
        await dbRun('INSERT INTO staff (staff_id, name, role, phone, email, password_hash) VALUES (?,?,?,?,?,?)', [staff_id, name, role, phone, email, '']);
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Import staff error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Upload/preview endpoints (multipart) - returns parsed rows for preview
app.post('/api/upload/students', authenticateToken, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if(!req.file) return res.status(400).json({ error: 'Missing file' });
    const text = req.file.buffer.toString('utf8');
    parse(text, { columns: true, skip_empty_lines: true, relax_quotes: true }, (err, records) => {
      if(err) return res.status(400).json({ error: 'CSV parse error', detail: err.message });
      // return preview (first 200 rows)
      res.json(records.slice(0,200));
    });
  } catch (err) {
    console.error('Upload students parse error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/upload/attendance', authenticateToken, requireTeacherOrAdmin, upload.single('file'), async (req, res) => {
  try {
    if(!req.file) return res.status(400).json({ error: 'Missing file' });
    const text = req.file.buffer.toString('utf8');
    parse(text, { columns: true, skip_empty_lines: true, relax_quotes: true }, (err, records) => {
      if(err) return res.status(400).json({ error: 'CSV parse error', detail: err.message });
      res.json(records.slice(0,200));
    });
  } catch (err) {
    console.error('Upload attendance parse error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/upload/staff', authenticateToken, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if(!req.file) return res.status(400).json({ error: 'Missing file' });
    const text = req.file.buffer.toString('utf8');
    parse(text, { columns: true, skip_empty_lines: true, relax_quotes: true }, (err, records) => {
      if(err) return res.status(400).json({ error: 'CSV parse error', detail: err.message });
      res.json(records.slice(0,200));
    });
  } catch (err) {
    console.error('Upload staff parse error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update student
app.put('/api/students/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { adm_no, name, class: cls, section, contact, status } = req.body;
    await dbRun('UPDATE students SET adm_no = ?, name = ?, class = ?, section = ?, contact = ?, status = ? WHERE id = ?', [adm_no, name, cls, section, contact || '', status || 'Active', id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Update student error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete student
app.delete('/api/students/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await dbRun('DELETE FROM students WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete student error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Authentication middleware
function authenticateToken(req, res, next){
  const auth = req.headers['authorization'] || req.headers['Authorization'];
  if(!auth) return res.status(401).json({ error: 'Missing Authorization' });
  const parts = auth.split(' ');
  if(parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Invalid Authorization format' });
  const token = parts[1];
  try{
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  }catch(e){
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next){
  if(!req.user || !req.user.role) return res.status(403).json({ error: 'Forbidden' });
  if(String(req.user.role).toLowerCase() !== 'admin') return res.status(403).json({ error: 'Admin role required' });
  next();
}

function requireTeacherOrAdmin(req, res, next){
  if(!req.user || !req.user.role) return res.status(403).json({ error: 'Forbidden' });
  const r = String(req.user.role).toLowerCase();
  if(r !== 'admin' && r !== 'teacher') return res.status(403).json({ error: 'Teacher or Admin role required' });
  next();
}