const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
app.use(express.static("public"));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

let players = {};
let phase = "waiting";
let timer = 0;

let nominations = {};
let votes = {};
let nominatedPlayers = [];

const MIN_PLAYERS = 5;

// =======================
// GAME LOOP
// =======================

function startGame() {
  if (Object.keys(players).length < MIN_PLAYERS) return;

  Object.values(players).forEach(p => {
    p.alive = true;
  });

  nextPhase("nominating");
}

function nextPhase(newPhase) {
  phase = newPhase;

  // RESET STATE EVERY ROUND
  nominations = {};
  votes = {};
  nominatedPlayers = [];

  if (phase === "nominating") timer = 20;
  if (phase === "voting") timer = 20;
  if (phase === "results") timer = 5;

  update();
}

// =======================
// TICK
// =======================

setInterval(() => {
  if (phase === "waiting") {
    if (Object.keys(players).length >= MIN_PLAYERS) {
      startGame();
    }
    return;
  }

  timer--;

  if (timer <= 0) {
    if (phase === "nominating") {
      pickNominees();
      nextPhase("voting");

    } else if (phase === "voting") {
      eliminatePlayer();
      nextPhase("results");

    } else if (phase === "results") {
      checkEndGame();
    }
  }

  update();
}, 1000);

// =======================
// NOMINATION LOGIC
// =======================

function pickNominees() {
  const sorted = Object.entries(nominations)
    .sort((a, b) => b[1] - a[1]);

  nominatedPlayers = sorted.slice(0, 2).map(x => x[0]);

  // TIE BREAKER (random)
  if (nominatedPlayers.length < 2) {
    const alive = Object.values(players).filter(p => p.alive);
    const random = alive[Math.floor(Math.random() * alive.length)];
    if (random) nominatedPlayers.push(random.id);
  }
}

// =======================
// ELIMINATION LOGIC
// =======================

function eliminatePlayer() {
  const sorted = Object.entries(votes)
    .sort((a, b) => b[1] - a[1]);

  if (!sorted.length) return;

  const highest = sorted[0][1];
  const tied = sorted.filter(x => x[1] === highest);

  const eliminated = tied[Math.floor(Math.random() * tied.length)][0];

  if (players[eliminated]) {
    players[eliminated].alive = false;
  }
}

// =======================
// END GAME
// =======================

function checkEndGame() {
  const alive = Object.values(players).filter(p => p.alive);

  if (alive.length <= 3) {
    // FINAL PHASE: no nominations
    nextPhase("voting");
  } else {
    nextPhase("nominating");
  }
}

// =======================
// SOCKETS
// =======================

io.on("connection", socket => {
  console.log("User connected:", socket.id);

  socket.on("join", name => {
    players[socket.id] = {
      id: socket.id,
      name,
      alive: true
    };

    update();
  });

  socket.on("nominate", targetId => {
    const player = players[socket.id];

    if (!player || !player.alive) return;
    if (phase !== "nominating") return;

    // max 2 nominations per player
    if (!player.nominations) player.nominations = [];

    if (player.nominations.includes(targetId)) return;
    if (player.nominations.length >= 2) return;

    player.nominations.push(targetId);

    nominations[targetId] = (nominations[targetId] || 0) + 1;

    update();
  });

  socket.on("vote", targetId => {
    const player = players[socket.id];

    if (!player || !player.alive) return;
    if (phase !== "voting") return;

    // ❗ BLOCK NOMINATED PLAYERS FROM VOTING
    if (nominatedPlayers.includes(socket.id)) return;

    if (player.voted) return;

    player.voted = true;

    votes[targetId] = (votes[targetId] || 0) + 1;

    update();
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    update();
  });
});

// =======================
// UPDATE CLIENT
// =======================

function update() {
  io.emit("state", {
    players,
    phase,
    timer,
    nominations,
    votes,
    nominatedPlayers
  });
}

// =======================

server.listen(process.env.PORT || 3000, () => {
  console.log("Server running");
});