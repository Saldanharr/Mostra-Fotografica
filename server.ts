import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import { Server } from "socket.io";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_PATH || "contest_v5.db";
const db = new Database(dbPath);

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS judges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, judging, completed, assigned
    judge_id TEXT,
    assigned_judge_id INTEGER,
    locked_at DATETIME,
    FOREIGN KEY (participant_id) REFERENCES participants(id),
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (assigned_judge_id) REFERENCES judges(id)
  );

  CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    FOREIGN KEY (submission_id) REFERENCES submissions(id)
  );

  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id INTEGER UNIQUE NOT NULL,
    criteria1 REAL NOT NULL,
    criteria2 REAL NOT NULL,
    criteria3 REAL NOT NULL,
    criteria4 REAL NOT NULL,
    total REAL NOT NULL,
    FOREIGN KEY (submission_id) REFERENCES submissions(id)
  );
`);

// Seed initial data if empty
const categoryCount = db.prepare("SELECT COUNT(*) as count FROM categories").get() as { count: number };
if (categoryCount.count === 0) {
  const insertCategory = db.prepare("INSERT INTO categories (name) VALUES (?)");
  ['Profissional', 'Preto e Branco', 'Cotidiano'].forEach(name => insertCategory.run(name));

  const insertJudge = db.prepare("INSERT INTO judges (name) VALUES (?)");
  const judgesList = ['Ana Beatriz', 'Carlos Eduardo', 'Mariana Silva', 'Ricardo Santos', 'Fernanda Oliveira'];
  judgesList.forEach(name => insertJudge.run(name));

  const insertParticipant = db.prepare("INSERT INTO participants (name, code) VALUES (?, ?)");
  const insertSubmission = db.prepare("INSERT INTO submissions (participant_id, category_id, status, assigned_judge_id, judge_id) VALUES (?, ?, ?, ?, ?)");
  const insertImage = db.prepare("INSERT INTO images (submission_id, url) VALUES (?, ?)");
  const insertScore = db.prepare("INSERT INTO scores (submission_id, criteria1, criteria2, criteria3, criteria4, total) VALUES (?, ?, ?, ?, ?, ?)");

  // Create 20 participants
  const firstNames = ['João', 'Maria', 'Pedro', 'Ana', 'Lucas', 'Julia', 'Gabriel', 'Beatriz', 'Mateus', 'Lara'];
  const lastNames = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes'];

  for (let i = 1; i <= 20; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const name = `${firstName} ${lastName}`;
    const code = `PART-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const p = insertParticipant.run(name, code);
    const pId = p.lastInsertRowid;

    // Each participant in 1 to 3 random categories
    const numCats = Math.floor(Math.random() * 3) + 1;
    const cats = [1, 2, 3].sort(() => 0.5 - Math.random()).slice(0, numCats);
    
    cats.forEach(catId => {
      const rand = Math.random();
      let status = 'pending';
      let assignedJudgeId: number | null = null;
      let judgeId: string | null = null;
      
      if (rand > 0.4) { // 60% are either assigned or completed
        if (rand > 0.7) { // 30% completed
          status = 'completed';
          assignedJudgeId = Math.floor(Math.random() * 5) + 1;
          judgeId = `judge_mock_${assignedJudgeId}`;
        } else { // 30% assigned
          status = 'assigned';
          assignedJudgeId = Math.floor(Math.random() * 5) + 1;
        }
      }

      const s = insertSubmission.run(pId, catId, status, assignedJudgeId, judgeId);
      const sId = s.lastInsertRowid;
      
      // 3 images per submission
      for (let j = 1; j <= 3; j++) {
        insertImage.run(sId, `https://picsum.photos/seed/photo-${sId}-${j}/800/600`);
      }

      // If completed, add scores
      if (status === 'completed') {
        const c1 = (Math.random() * 4 + 6).toFixed(2); // Higher scores for mock data
        const c2 = (Math.random() * 4 + 6).toFixed(2);
        const c3 = (Math.random() * 4 + 6).toFixed(2);
        const c4 = (Math.random() * 4 + 6).toFixed(2);
        const total = ((parseFloat(c1) + parseFloat(c2) + parseFloat(c3) + parseFloat(c4)) / 4).toFixed(2);
        insertScore.run(sId, c1, c2, c3, c4, total);
      }
    });
  }
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/judges", (req, res) => {
    const judges = db.prepare("SELECT * FROM judges").all();
    res.json(judges);
  });

  app.get("/api/admin/submissions", (req, res) => {
    const submissions = db.prepare(`
      SELECT s.*, p.code as participant_code, c.name as category_name, j.name as assigned_judge_name
      FROM submissions s
      JOIN participants p ON s.participant_id = p.id
      JOIN categories c ON s.category_id = c.id
      LEFT JOIN judges j ON s.assigned_judge_id = j.id
    `).all();
    res.json(submissions);
  });

  app.post("/api/admin/assign", (req, res) => {
    const { submissionId, judgeId } = req.body;
    db.prepare("UPDATE submissions SET assigned_judge_id = ?, status = 'assigned' WHERE id = ?")
      .run(judgeId, submissionId);
    
    io.emit('submission_assigned', { submissionId, judgeId });
    res.json({ success: true });
  });

  app.get("/api/categories", (req, res) => {
    const categories = db.prepare(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM submissions s WHERE s.category_id = c.id AND (s.status = 'pending' OR s.status = 'assigned')) as pending_count,
        (SELECT COUNT(*) FROM submissions s WHERE s.category_id = c.id AND s.status = 'completed') as completed_count,
        (SELECT COUNT(*) FROM submissions s WHERE s.category_id = c.id) as total_count
      FROM categories c
    `).all();
    res.json(categories);
  });

  app.get("/api/submissions/pending/:categoryId", (req, res) => {
    const { categoryId } = req.params;
    const { judgeId } = req.query; // Optional: filter by assigned judge

    let query = `
      SELECT s.*, p.code as participant_code 
      FROM submissions s
      JOIN participants p ON s.participant_id = p.id
      WHERE s.category_id = ? AND (s.status = 'pending' OR s.status = 'assigned')
    `;
    
    const submissions = db.prepare(query).all(categoryId);
    res.json(submissions);
  });

  app.get("/api/submissions/:id", (req, res) => {
    const submission = db.prepare(`
      SELECT s.*, p.code as participant_code, c.name as category_name
      FROM submissions s
      JOIN participants p ON s.participant_id = p.id
      JOIN categories c ON s.category_id = c.id
      WHERE s.id = ?
    `).get(req.params.id);

    if (!submission) return res.status(404).json({ error: "Not found" });

    const images = db.prepare("SELECT * FROM images WHERE submission_id = ?").all(req.params.id);
    res.json({ ...submission, images });
  });

  app.post("/api/submissions/:id/lock", (req, res) => {
    const { judgeId } = req.body;
    const submissionId = req.params.id;

    const submission = db.prepare("SELECT status FROM submissions WHERE id = ?").get(submissionId) as { status: string };
    if (submission.status !== 'pending') {
      return res.status(400).json({ error: "Submission already being judged or completed" });
    }

    db.prepare("UPDATE submissions SET status = 'judging', judge_id = ?, locked_at = datetime('now') WHERE id = ?")
      .run(judgeId, submissionId);
    
    io.emit('submission_locked', { submissionId });
    res.json({ success: true });
  });

  app.post("/api/submissions/:id/unlock", (req, res) => {
    const submissionId = req.params.id;
    db.prepare("UPDATE submissions SET status = 'pending', judge_id = NULL, locked_at = NULL WHERE id = ? AND status = 'judging'")
      .run(submissionId);
    
    io.emit('submission_unlocked', { submissionId });
    res.json({ success: true });
  });

  app.post("/api/submissions/:id/score", (req, res) => {
    const { criteria1, criteria2, criteria3, criteria4, judgeId } = req.body;
    const submissionId = req.params.id;
    const total = (parseFloat(criteria1) + parseFloat(criteria2) + parseFloat(criteria3) + parseFloat(criteria4)) / 4;

    const insertScore = db.prepare(`
      INSERT INTO scores (submission_id, criteria1, criteria2, criteria3, criteria4, total)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(submission_id) DO UPDATE SET
        criteria1 = excluded.criteria1,
        criteria2 = excluded.criteria2,
        criteria3 = excluded.criteria3,
        criteria4 = excluded.criteria4,
        total = excluded.total
    `);

    const updateSubmission = db.prepare("UPDATE submissions SET status = 'completed', judge_id = ? WHERE id = ?");

    const transaction = db.transaction(() => {
      insertScore.run(submissionId, criteria1, criteria2, criteria3, criteria4, total.toFixed(2));
      updateSubmission.run(judgeId, submissionId);
    });

    transaction();
    io.emit('submission_completed', { submissionId });
    res.json({ success: true });
  });

  app.get("/api/my-judgments/:judgeId", (req, res) => {
    const { judgeId } = req.params;
    const judgments = db.prepare(`
      SELECT s.id, p.name as participant_name, p.code as participant_code, c.name as category_name,
             sc.criteria1, sc.criteria2, sc.criteria3, sc.criteria4, sc.total,
             (SELECT url FROM images WHERE submission_id = s.id LIMIT 1) as thumbnail_url
      FROM submissions s
      JOIN participants p ON s.participant_id = p.id
      JOIN categories c ON s.category_id = c.id
      JOIN scores sc ON s.id = sc.submission_id
      WHERE s.judge_id = ?
      ORDER BY s.id DESC
    `).all(judgeId);
    res.json(judgments);
  });

  app.get("/api/results", (req, res) => {
    const results = db.prepare(`
      SELECT s.id, p.name as participant_name, p.code, c.name as category, sc.total, sc.criteria1, sc.criteria2, sc.criteria3, sc.criteria4,
             j.name as judge_name, s.judge_id as judge_code
      FROM scores sc
      JOIN submissions s ON sc.submission_id = s.id
      JOIN participants p ON s.participant_id = p.id
      JOIN categories c ON s.category_id = c.id
      LEFT JOIN judges j ON s.assigned_judge_id = j.id
      ORDER BY c.name, sc.total DESC
    `).all();
    res.json(results);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
