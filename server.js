// server.js - Express + SQLite + JWT Authentication
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { execFile } = require('child_process');
const multer        = require('multer');
const fs            = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET = process.env.JWT_SECRET || 'change-it';


const upload = multer({ dest: path.join(__dirname, 'uploads', 'temp/') });
// Initialize SQLite database
const db = new Database(path.join(__dirname, 'todos.db'));
// Create tables if not exist
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    text TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    FOREIGN KEY(userId) REFERENCES users(id)
  );
`).run();

app.use(cors());
app.use(bodyParser.json());

// Middleware: verify JWT
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Brak tokena' });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Brak tokena' });
  try {
    const payload = jwt.verify(token, SECRET);
    req.user = payload; // { id, email }
    next();
  } catch (err) {
    res.status(401).json({ error: 'Niepoprawny token' });
  }
}

// Register endpoint
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email i hasło są wymagane' });
  }
  try {
    const hashed = await bcrypt.hash(password, 10);
    const createdAt = new Date().toISOString();
    const stmt = db.prepare('INSERT INTO users (email, password, createdAt) VALUES (?, ?, ?)');
    const info = stmt.run(email, hashed, createdAt);
    res.status(201).json({ id: info.lastInsertRowid, email });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Użytkownik już istnieje' });
    }
    res.status(500).json({ error: 'Błąd serwera', details: err.message });
  }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email i hasło są wymagane' });
  }
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    return res.status(401).json({ error: 'Nieprawidłowe dane' });
  }
  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(401).json({ error: 'Nieprawidłowe dane' });
  }
  const token = jwt.sign({ id: user.id, email: user.email }, SECRET, { expiresIn: '1h' });
  res.json({ token });
});

// Get current user
app.get('/api/me', authenticate, (req, res) => {
  res.json({ id: req.user.id, email: req.user.email });
});

// CRUD for todos, protected
app.get('/api/todos', authenticate, (req, res) => {
  const stmt = db.prepare('SELECT * FROM todos WHERE userId = ? ORDER BY createdAt DESC');
  const rows = stmt.all(req.user.id).map(r => ({ ...r, completed: Boolean(r.completed) }));
  res.json(rows);
});

app.post('/api/todos', authenticate, (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Treść zadania nie może być pusta' });
  }
  const createdAt = new Date().toISOString();
  const stmt = db.prepare('INSERT INTO todos (userId, text, completed, createdAt) VALUES (?, ?, 0, ?)');
  const info = stmt.run(req.user.id, text.trim(), createdAt);
  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ ...todo, completed: Boolean(todo.completed) });
});


app.post(
  '/api/resize-png',
  authenticate,
  upload.single('image'),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Brak pliku PNG' });
    }

    const tempPath  = req.file.path;
    const outName   = `out-${Date.now()}.png`;
    const outPath   = path.join(__dirname, 'uploads', outName);

    // Uruchamiamy ImageMagick CLI (podatne na CVE-2022-44268)
    // Vulnerable versions: 7.1.0-48 i 7.1.0-49
    execFile(
      'magick', // lub 'convert' w zależności od instalacji
      [ tempPath, '-resize', '200x200', outPath ],
      (err, stdout, stderr) => {
        // usuń plik tymczasowy
        fs.unlinkSync(tempPath);

        if (err) {
          console.error('ImageMagick error:', stderr);
          return res.status(500).json({ error: 'Błąd przetwarzania obrazu' });
        }

        // Zwracamy plik wynikowy; atakujący może z niego odczytać plik wskazany
        res.sendFile(outPath, err2 => {
          if (err2) console.error('SendFile error:', err2);
        });
      }
    );
  }
);

// WARNING: VULNERABLE to SQL INJECTION, do NOT use in production!
app.get('/api/search', authenticate, (req, res) => {
  const { q } = req.query;

  // TU zaczyna się niebezpieczne miejsce:
  // bezpośrednio interpolujemy kawałek zapytania z user input
  const unsafeQuery = `
    SELECT * FROM todos 
    WHERE userId = ${req.user.id} 
      AND text LIKE '%${q}%'
  `;

  try {
    // Wykonanie „nieczystego” zapytania
    const rows = db.prepare(unsafeQuery).all();
    res.json(rows.map(r => ({ ...r, completed: Boolean(r.completed) })));
  } catch (err) {
    res.status(500).json({ error: 'Błąd wyszukiwania', details: err.message });
  }
});


app.get('/download', authenticate, (req, res) => {
  // Klient musi znać dokładny URL i parametr file, nie jest on nigdzie linkowany w UI
  const requestedFile = req.query.file;  
  // Brak jakiejkolwiek walidacji/sanitizacji → CWE-22
  const filePath = path.join(__dirname, 'files', requestedFile);

  res.sendFile(filePath, err => {
    if (err) {
      console.error('Download error:', err);
      // Nie ujawniamy szczegółów błędu, ale zwracamy 404
      return res.status(404).json({ error: 'Plik nie znaleziony' });
    }
  });
});

app.put('/api/todos/:id', authenticate, (req, res) => {
  const id = Number(req.params.id);
  const { completed } = req.body;
  const stmt = db.prepare('UPDATE todos SET completed = ? WHERE id = ? AND userId = ?');
  const info = stmt.run(completed ? 1 : 0, id, req.user.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Zadanie nie znalezione' });
  const row = db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
  res.json({ ...row, completed: Boolean(row.completed) });
});

app.delete('/api/todos/:id', authenticate, (req, res) => {
  const id = Number(req.params.id);
  const stmt = db.prepare('DELETE FROM todos WHERE id = ? AND userId = ?');
  const info = stmt.run(id, req.user.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Zadanie nie znalezione' });
  res.json({ message: 'Usunięto' });
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  });
}

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
