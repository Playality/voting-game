
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
app.use(express.static("public"));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let players = [];
let phase = "waiting";

let nominations = {};
let votes = {};
let nominees = [];

const MIN_PLAYERS = 5;

// ================= HELPERS =================
function alivePlayers() {
  return players.filter(p => p.alive);
}

function broadcast() {
  io.emit("state", { players, phase, nominees });
}

function resetRound() {
  nominations = {};
  votes = {};
  nominees = [];
}

// ================= GAME FLOW =================
function tryStartGame() {
  if (players.length >= MIN_PLAYERS && phase === "waiting") {
    startRound();
  }
}

function startRound() {
  resetRound();

  const alive = alivePlayers();

  // FINAL 2 → jury
  if (alive.length === 2) {
    phase = "jury";
    broadcast();
    setTimeout(endJury, 15000);
    return;
  }

  // FINAL 3 → skip nominations
  if (alive.length === 3) {
    startVoting(alive.map(p => p.id));
    return;
  }

  phase = "nominating";
  broadcast();
  setTimeout(endNominations, 15000);
}

// ================= NOMINATIONS =================
function endNominations() {
  let tally = {};

  Object.values(nominations).forEach(arr => {
    arr.forEach(id => {
      tally[id] = (tally[id] || 0) + 1;
    });
  });

  let sorted = Object.entries(tally)
    .sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) {
    const alive = alivePlayers().map(p => p.id);
    nominees = shuffle(alive).slice(0, 2);
  } else {
    nominees = sorted.slice(0, 2).map(x => x[0]);
  }

  startVoting(nominees);
}

// ================= VOTING =================
function startVoting(targets) {
  votes = {};
  nominees = targets;

  phase = "voting";
  broadcast();

  setTimeout(endVoting, 15000);
}

function endVoting() {
  let tally = {};

  Object.values(votes).forEach(target => {
    tally[target] = (tally[target] || 0) + 1;
  });

  let sorted = Object.entries(tally)
    .sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) {
    sorted = [[nominees[Math.floor(Math.random() * nominees.length)], 1]];
  }

  const top = sorted[0][1];
  const tied = sorted.filter(x => x[1] === top);
  const eliminatedId = tied[Math.floor(Math.random() * tied.length)][0];

  const player = players.find(p => p.id === eliminatedId);
  if (player) player.alive = false;

  io.emit("results", sorted.map(x => {
    const p = players.find(pl => pl.id === x[0]);
    return { name: p?.name || "?", votes: x[1] };
  }));

  setTimeout(startRound, 4000);
}

// ================= JURY =================
function endJury() {
  let tally = {};

  Object.values(votes).forEach(target => {
    tally[target] = (tally[target] || 0) + 1;
  });

  let sorted = Object.entries(tally)
    .sort((a, b) => b[1] - a[1]);

  const winnerId = sorted[0][0];
  const winner = players.find(p => p.id === winnerId);

  io.emit("results", [{
    name: winner?.name || "Winner",
    votes: "🏆 WINNER"
  }]);

  phase = "ended";
  broadcast();
}

// ================= UTIL =================
function shuffle(arr) {
  return arr.sort(() => Math.random() - 0.5);
}

// ================= SOCKET =================
io.on("connection", socket => {

  socket.on("join", name => {
    players.push({
      id: socket.id,
      name,
      alive: true
    });

    socket.emit("joined", socket.id);
    broadcast();
    tryStartGame();
  });

  socket.on("nominate", targets => {
    const player = players.find(p => p.id === socket.id);

    if (!player || !player.alive) return;
    if (phase !== "nominating") return;

    // remove self if attempted
    targets = targets.filter(id => id !== socket.id);

    nominations[socket.id] = targets.slice(0, 2);
  });

  socket.on("vote", target => {
    const player = players.find(p => p.id === socket.id);
    if (!player) return;

    const alive = alivePlayers();

    // NORMAL ROUND
    if (alive.length > 2) {
      if (!player.alive) return;
      if (nominees.includes(socket.id)) return;
    }

    // JURY
    if (alive.length === 2) {
      if (player.alive) return;
    }

    votes[socket.id] = target;
  });

  socket.on("disconnect", () => {
    players = players.filter(p => p.id !== socket.id);
    broadcast();
  });
});

// ✅ REQUIRED FOR RENDER
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Running on " + PORT));