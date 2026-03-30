const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
app.set("trust proxy", 1);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

// Serve frontend
app.use(express.static("public"));

/* ======================
   GAME STATE
====================== */

let players = [];
let phase = "waiting";
let timer = 0;

let nominations = {};
let votes = {};
let nominees = [];

const MIN_PLAYERS = 5;

/* ======================
   HELPERS
====================== */

function broadcast() {
  io.emit("update", {
    players,
    phase,
    timer,
    nominations,
    votes,
    nominees
  });
}

function startTimer(seconds, next) {
  timer = seconds;

  const interval = setInterval(() => {
    timer--;
    broadcast();

    if (timer <= 0) {
      clearInterval(interval);
      next();
    }
  }, 1000);
}

/* ======================
   GAME FLOW
====================== */

function startRound() {
  nominations = {};
  votes = {};
  nominees = [];

  phase = "nominating";
  startTimer(20, endNomination);
}

function endNomination() {
  const sorted = Object.entries(nominations)
    .sort((a, b) => b[1] - a[1]);

  nominees = sorted.slice(0, 2).map(x => x[0]);

  // fallback if not enough nominees
  if (nominees.length < 2) {
    const alive = players.filter(p => p.alive);

    while (nominees.length < 2 && alive.length > 0) {
      const randomPlayer =
        alive[Math.floor(Math.random() * alive.length)].id;

      if (!nominees.includes(randomPlayer)) {
        nominees.push(randomPlayer);
      }
    }
  }

  phase = "voting";
  startTimer(20, endVoting);
}

function endVoting() {
  const sorted = Object.entries(votes)
    .sort((a, b) => b[1] - a[1]);

  let eliminated;

  if (sorted.length === 0) {
    // no votes → random
    eliminated =
      nominees[Math.floor(Math.random() * nominees.length)];
  } else if (
    sorted.length > 1 &&
    sorted[0][1] === sorted[1][1]
  ) {
    // tie breaker
    const tied = [sorted[0][0], sorted[1][0]];
    eliminated = tied[Math.floor(Math.random() * tied.length)];
  } else {
    eliminated = sorted[0][0];
  }

  players = players.map(p =>
    p.id === eliminated ? { ...p, alive: false } : p
  );

  phase = "results";
  startTimer(10, checkGameEnd);
}

function checkGameEnd() {
  const alive = players.filter(p => p.alive);

  if (alive.length <= 1) {
    // reset game
    phase = "waiting";
    players = [];
    return;
  }

  startRound();
}

/* ======================
   SOCKETS
====================== */

io.on("connection", socket => {

  // JOIN GAME
  socket.on("join", name => {
    if (!name) return;

    players.push({
      id: socket.id,
      name,
      alive: true
    });

    // start game when enough players
    if (players.length >= MIN_PLAYERS && phase === "waiting") {
      startRound();
    }

    broadcast();
  });

  // NOMINATE (can nominate multiple players)
  socket.on("nominate", targetId => {
    if (phase !== "nominating") return;

    nominations[targetId] = (nominations[targetId] || 0) + 1;

    broadcast();
  });

  // VOTE (nominees cannot vote)
  socket.on("vote", targetId => {
    if (phase !== "voting") return;

    if (nominees.includes(socket.id)) return;

    votes[targetId] = (votes[targetId] || 0) + 1;

    broadcast();
  });

  // CHAT
  socket.on("chat", msg => {
    io.emit("chat", msg);
  });

  // DISCONNECT
  socket.on("disconnect", () => {
    players = players.filter(p => p.id !== socket.id);
    broadcast();
  });
});

/* ======================
   START SERVER (RENDER FIX)
====================== */

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Server running on " + PORT);
});