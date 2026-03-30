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
  const alivePlayers = players.filter(p => p.alive);

  const sorted = Object.entries(nominations)
    .filter(([id]) => alivePlayers.some(p => p.id === id))
    .sort((a, b) => b[1] - a[1]);

  nominees = sorted.slice(0, 2).map(x => x[0]);

  // fallback if not enough
  while (nominees.length < 2) {
    const random =
      alivePlayers[Math.floor(Math.random() * alivePlayers.length)].id;

    if (!nominees.includes(random)) {
      nominees.push(random);
    }
  }

  phase = "voting";
  startTimer(20, endVoting);
}

function endVoting() {
  const aliveNominees = nominees.filter(id =>
    players.find(p => p.id === id && p.alive)
  );

  const sorted = Object.entries(votes)
    .filter(([id]) => aliveNominees.includes(id))
    .sort((a, b) => b[1] - a[1]);

  let eliminated;

  if (sorted.length === 0) {
    // no votes → random nominee
    eliminated =
      aliveNominees[Math.floor(Math.random() * aliveNominees.length)];
  } else if (
    sorted.length > 1 &&
    sorted[0][1] === sorted[1][1]
  ) {
    // tie breaker
    eliminated =
      [sorted[0][0], sorted[1][0]][
        Math.floor(Math.random() * 2)
      ];
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
	if (players.find(p => p.id === socket.id)) return;
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

  const player = players.find(p => p.id === socket.id);
  if (!player || !player.alive) return; // ❗ BLOCK DEAD PLAYERS

  nominations[targetId] = (nominations[targetId] || 0) + 1;

  broadcast();
});

  // VOTE (nominees cannot vote)
  socket.on("nominate", targetId => {
  if (phase !== "nominating") return;

  const player = players.find(p => p.id === socket.id);
  if (!player || !player.alive) return; // ❗ BLOCK DEAD PLAYERS

  nominations[targetId] = (nominations[targetId] || 0) + 1;

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