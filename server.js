const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
app.use(express.static("public"));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// ================= GAME STATE =================
let players = [];
let phase = "waiting";

let nominations = {};
let votes = {};

let nominees = [];
let juryVotes = {};

const MIN_PLAYERS = 5;

// ================= HELPERS =================
function alivePlayers() {
  return players.filter(p => p.alive);
}

function broadcastState() {
  io.emit("state", { players, phase });
}

function resetRound() {
  nominations = {};
  votes = {};
  nominees = [];
}

// ================= GAME FLOW =================
function startGameIfReady() {
  if (players.length >= MIN_PLAYERS && phase === "waiting") {
    startNominations();
  }
}

// ===== NOMINATING =====
function startNominations() {
  resetRound();

  const alive = alivePlayers();

  // FINAL 3 → skip nominations
  if (alive.length <= 3) {
    startVoting(alive.map(p => p.id));
    return;
  }

  phase = "nominating";
  broadcastState();

  setTimeout(endNominations, 15000);
}

function endNominations() {
  const tally = {};

  // count nominations
  for (let voter in nominations) {
    nominations[voter].forEach(target => {
      tally[target] = (tally[target] || 0) + 1;
    });
  }

  // sort top 2
  const sorted = Object.entries(tally)
    .sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) {
    // no votes → random 2
    const alive = alivePlayers().map(p => p.id);
    nominees = shuffle(alive).slice(0, 2);
  } else {
    nominees = sorted.slice(0, 2).map(x => x[0]);
  }

  startVoting(nominees);
}

// ===== VOTING =====
function startVoting(targets) {
  votes = {};
  nominees = targets;

  phase = "voting";
  broadcastState();

  setTimeout(endVoting, 15000);
}

function endVoting() {
  const tally = {};

  for (let voter in votes) {
    const target = votes[voter];
    tally[target] = (tally[target] || 0) + 1;
  }

  let sorted = Object.entries(tally)
    .sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) {
    sorted = [[nominees[Math.floor(Math.random() * nominees.length)], 1]];
  }

  // handle tie
  const topScore = sorted[0][1];
  const tied = sorted.filter(x => x[1] === topScore);

  const eliminatedId = tied[Math.floor(Math.random() * tied.length)][0];

  const player = players.find(p => p.id === eliminatedId);
  if (player) player.alive = false;

  // send results (ONLY after vote ends)
  io.emit("results", sorted.map(x => {
    const p = players.find(pl => pl.id === x[0]);
    return { name: p ? p.name : "?", votes: x[1] };
  }));

  setTimeout(nextRound, 4000);
}

// ===== FINAL 2 (JURY) =====
function startJuryVoting() {
  votes = {};
  phase = "voting";
  broadcastState();

  setTimeout(endJuryVoting, 15000);
}

function endJuryVoting() {
  const tally = {};

  for (let voter in votes) {
    const target = votes[voter];
    tally[target] = (tally[target] || 0) + 1;
  }

  const sorted = Object.entries(tally)
    .sort((a, b) => b[1] - a[1]);

  const winnerId = sorted[0][0];
  const winner = players.find(p => p.id === winnerId);

  io.emit("results", [{
    name: winner.name,
    votes: "WINNER 🏆"
  }]);

  phase = "ended";
  broadcastState();
}

// ===== NEXT ROUND =====
function nextRound() {
  const alive = alivePlayers();

  if (alive.length === 2) {
    startJuryVoting();
    return;
  }

  if (alive.length <= 1) {
    phase = "ended";
    broadcastState();
    return;
  }

  startNominations();
}

// ===== UTIL =====
function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

// ================= SOCKET =================
io.on("connection", (socket) => {

  socket.on("join", (name) => {
    players.push({
      id: socket.id,
      name,
      alive: true
    });

    socket.emit("joined", socket.id);
    broadcastState();

    startGameIfReady();
  });

  socket.on("nominate", (targets) => {
    const player = players.find(p => p.id === socket.id);

    if (!player || !player.alive) return;
    if (phase !== "nominating") return;

    nominations[socket.id] = targets.slice(0, 2);
  });

  socket.on("vote", (target) => {
    const player = players.find(p => p.id === socket.id);

    if (!player) return;

    // ALIVE players vote in normal rounds
    if (phase === "voting" && alivePlayers().length > 2) {
      if (!player.alive) return;
    }

    // JURY votes when final 2
    if (alivePlayers().length === 2) {
      if (player.alive) return; // ONLY dead players vote
    }

    votes[socket.id] = target;
  });

  socket.on("disconnect", () => {
    players = players.filter(p => p.id !== socket.id);
    broadcastState();
  });

});

// ================= START =================
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
app.use(express.static("public"));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// ================= GAME STATE =================
let players = [];
let phase = "waiting";

let nominations = {};
let votes = {};

let nominees = [];
let juryVotes = {};

const MIN_PLAYERS = 5;

// ================= HELPERS =================
function alivePlayers() {
  return players.filter(p => p.alive);
}

function broadcastState() {
  io.emit("state", { players, phase });
}

function resetRound() {
  nominations = {};
  votes = {};
  nominees = [];
}

// ================= GAME FLOW =================
function startGameIfReady() {
  if (players.length >= MIN_PLAYERS && phase === "waiting") {
    startNominations();
  }
}

// ===== NOMINATING =====
function startNominations() {
  resetRound();

  const alive = alivePlayers();

  // FINAL 3 → skip nominations
  if (alive.length <= 3) {
    startVoting(alive.map(p => p.id));
    return;
  }

  phase = "nominating";
  broadcastState();

  setTimeout(endNominations, 15000);
}

function endNominations() {
  const tally = {};

  // count nominations
  for (let voter in nominations) {
    nominations[voter].forEach(target => {
      tally[target] = (tally[target] || 0) + 1;
    });
  }

  // sort top 2
  const sorted = Object.entries(tally)
    .sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) {
    // no votes → random 2
    const alive = alivePlayers().map(p => p.id);
    nominees = shuffle(alive).slice(0, 2);
  } else {
    nominees = sorted.slice(0, 2).map(x => x[0]);
  }

  startVoting(nominees);
}

// ===== VOTING =====
function startVoting(targets) {
  votes = {};
  nominees = targets;

  phase = "voting";
  broadcastState();

  setTimeout(endVoting, 15000);
}

function endVoting() {
  const tally = {};

  for (let voter in votes) {
    const target = votes[voter];
    tally[target] = (tally[target] || 0) + 1;
  }

  let sorted = Object.entries(tally)
    .sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) {
    sorted = [[nominees[Math.floor(Math.random() * nominees.length)], 1]];
  }

  // handle tie
  const topScore = sorted[0][1];
  const tied = sorted.filter(x => x[1] === topScore);

  const eliminatedId = tied[Math.floor(Math.random() * tied.length)][0];

  const player = players.find(p => p.id === eliminatedId);
  if (player) player.alive = false;

  // send results (ONLY after vote ends)
  io.emit("results", sorted.map(x => {
    const p = players.find(pl => pl.id === x[0]);
    return { name: p ? p.name : "?", votes: x[1] };
  }));

  setTimeout(nextRound, 4000);
}

// ===== FINAL 2 (JURY) =====
function startJuryVoting() {
  votes = {};
  phase = "voting";
  broadcastState();

  setTimeout(endJuryVoting, 15000);
}

function endJuryVoting() {
  const tally = {};

  for (let voter in votes) {
    const target = votes[voter];
    tally[target] = (tally[target] || 0) + 1;
  }

  const sorted = Object.entries(tally)
    .sort((a, b) => b[1] - a[1]);

  const winnerId = sorted[0][0];
  const winner = players.find(p => p.id === winnerId);

  io.emit("results", [{
    name: winner.name,
    votes: "WINNER 🏆"
  }]);

  phase = "ended";
  broadcastState();
}

// ===== NEXT ROUND =====
function nextRound() {
  const alive = alivePlayers();

  if (alive.length === 2) {
    startJuryVoting();
    return;
  }

  if (alive.length <= 1) {
    phase = "ended";
    broadcastState();
    return;
  }

  startNominations();
}

// ===== UTIL =====
function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

// ================= SOCKET =================
io.on("connection", (socket) => {

  socket.on("join", (name) => {
    players.push({
      id: socket.id,
      name,
      alive: true
    });

    socket.emit("joined", socket.id);
    broadcastState();

    startGameIfReady();
  });

  socket.on("nominate", (targets) => {
    const player = players.find(p => p.id === socket.id);

    if (!player || !player.alive) return;
    if (phase !== "nominating") return;

    nominations[socket.id] = targets.slice(0, 2);
  });

  socket.on("vote", (target) => {
    const player = players.find(p => p.id === socket.id);

    if (!player) return;

    // ALIVE players vote in normal rounds
    if (phase === "voting" && alivePlayers().length > 2) {
      if (!player.alive) return;
    }

    // JURY votes when final 2
    if (alivePlayers().length === 2) {
      if (player.alive) return; // ONLY dead players vote
    }

    votes[socket.id] = target;
  });

  socket.on("disconnect", () => {
    players = players.filter(p => p.id !== socket.id);
    broadcastState();
  });

});

// ================= START =================
server.listen(3000, () => {
  console.log("Server running on port 3000");
});