// server.js
const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const WebSocket = require("ws");

const app = express();
app.use(cors());
app.use(express.json());

// In-memory storage
const users = new Map();   // userId -> { id, username, bio, skills }
const courses = [];        // { id, userId, title, desc, image }

// ---- REST API ----

// Register user
app.post("/api/register", (req, res) => {
  const id = uuidv4();
  const { username, bio, skills } = req.body;
  const user = { id, username, bio, skills };
  users.set(id, user);
  res.json(user);
});

// Add course
app.post("/api/course", (req, res) => {
  const { userId, title, desc, image } = req.body;
  if (!users.has(userId)) {
    return res.status(400).json({ error: "Invalid user" });
  }
  const course = { id: uuidv4(), userId, title, desc, image };
  courses.push(course);
  res.json(course);
});

// Get all courses (with creator info)
app.get("/api/courses", (req, res) => {
  const withCreators = courses.map(c => ({
    ...c,
    creator: users.get(c.userId)?.username || "Unknown",
  }));
  res.json(withCreators);
});

// Start HTTP server
const server = app.listen(3000, () =>
  console.log("✅ API server running at http://localhost:3000")
);

// ---- WebSocket server ----
const wss = new WebSocket.Server({ server });
const rooms = new Map();

wss.on("connection", (ws) => {
  ws.room = null;

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);

      if (data.type === "join") {
        ws.room = data.room;
        if (!rooms.has(ws.room)) rooms.set(ws.room, new Set());
        rooms.get(ws.room).add(ws);
        console.log(`Client joined room: ${ws.room}`);
      }

      if (data.type === "chat" && ws.room) {
        const payload = JSON.stringify({
          type: "chat",
          room: ws.room,
          text: data.text,
        });
        rooms.get(ws.room).forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(payload);
          }
        });
      }
    } catch (e) {
      console.error("Invalid message:", e.message);
    }
  });

  ws.on("close", () => {
    if (ws.room && rooms.has(ws.room)) {
      rooms.get(ws.room).delete(ws);
      if (rooms.get(ws.room).size === 0) {
        rooms.delete(ws.room);
      }
    }
  });
});
