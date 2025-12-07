PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS staff (
  id INTEGER PRIMARY KEY,
  staff_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  subject TEXT,
  phone TEXT,
  email TEXT,
  password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY,
  adm_no TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  class TEXT NOT NULL,
  section TEXT NOT NULL,
  contact TEXT,
  status TEXT DEFAULT 'Active'
);

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL,
  remark TEXT,
  UNIQUE(student_id, date),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS homework (
  id INTEGER PRIMARY KEY,
  class TEXT NOT NULL,
  section TEXT NOT NULL,
  subject TEXT NOT NULL,
  title TEXT NOT NULL,
  instructions TEXT,
  due_date TEXT,
  created_by_staff_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by_staff_id) REFERENCES staff(id)
);

CREATE TABLE IF NOT EXISTS exams (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  class TEXT NOT NULL,
  section TEXT NOT NULL,
  subject TEXT NOT NULL,
  date TEXT NOT NULL,
  max_marks INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS marks (
  id INTEGER PRIMARY KEY,
  exam_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  marks REAL NOT NULL,
  grade TEXT,
  UNIQUE(exam_id, student_id),
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS fees (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL,
  last_paid_month TEXT,
  balance REAL DEFAULT 0,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  month TEXT,
  mode TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id INTEGER PRIMARY KEY,
  staff_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  from_date TEXT NOT NULL,
  to_date TEXT NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'Pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (staff_id) REFERENCES staff(id)
);

CREATE TABLE IF NOT EXISTS notices (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  for_whom TEXT NOT NULL,
  date TEXT NOT NULL,
  status TEXT DEFAULT 'Draft'
);

CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY,
  book_code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  availability TEXT DEFAULT 'Available'
);