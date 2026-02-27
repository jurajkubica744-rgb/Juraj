import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("hockey.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    position TEXT NOT NULL -- 'forward', 'defense', 'goalie'
  );

  CREATE TABLE IF NOT EXISTS current_game (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    position TEXT NOT NULL,
    team TEXT -- 'red', 'blue', or NULL
  );
`);

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  app.use(express.json());

  // WebSocket broadcast helper
  const broadcast = (data: any) => {
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  // API Routes
  app.get("/api/players", (req, res) => {
    const players = db.prepare("SELECT * FROM players ORDER BY name ASC").all();
    res.json(players);
  });

  app.post("/api/players", (req, res) => {
    const { name, position } = req.body;
    const result = db.prepare("INSERT INTO players (name, position) VALUES (?, ?)").run(name, position);
    const newPlayer = { id: result.lastInsertRowid, name, position };
    res.json(newPlayer);
  });

  app.get("/api/current-game", (req, res) => {
    const players = db.prepare("SELECT * FROM current_game").all();
    res.json(players);
  });

  app.post("/api/current-game/signup", (req, res) => {
    const { name, position } = req.body;
    // Check if already signed up
    const existing = db.prepare("SELECT * FROM current_game WHERE name = ?").get(name);
    if (existing) {
      return res.status(400).json({ error: "Hráč je už nahlásený" });
    }
    
    const result = db.prepare("INSERT INTO current_game (name, position) VALUES (?, ?)").run(name, position);
    const signup = { id: result.lastInsertRowid, name, position, team: null };
    
    broadcast({ type: "SIGNUP_UPDATE", data: signup });
    res.json(signup);
  });

  app.post("/api/current-game/remove", (req, res) => {
    const { id } = req.body;
    db.prepare("DELETE FROM current_game WHERE id = ?").run(id);
    broadcast({ type: "SIGNUP_REMOVED", id });
    res.json({ success: true });
  });

  app.post("/api/current-game/split", (req, res) => {
    const { teams } = req.body; // Array of { id, team }
    const update = db.prepare("UPDATE current_game SET team = ? WHERE id = ?");
    
    const transaction = db.transaction((teamsList) => {
      for (const item of teamsList) {
        update.run(item.team, item.id);
      }
    });
    
    transaction(teams);
    broadcast({ type: "TEAMS_UPDATED" });
    res.json({ success: true });
  });

  app.post("/api/current-game/reset", (req, res) => {
    db.prepare("DELETE FROM current_game").run();
    broadcast({ type: "GAME_RESET" });
    res.json({ success: true });
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

  const PORT = 3000;
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
