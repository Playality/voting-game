const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static("public"));

let players = {};
let phase = "waiting";
let nominations = {};
let votes = {};
let nominees = [];

function alivePlayers() {
  return Object.values(players).filter(p => p.alive);
}

// PLAYER JOIN
io.on("connection", (socket) => {
  socket.on("join", (name) => {
    players[socket.id] = {
      id: socket.id,
      name,
      alive: true,
      nominated: [],
      voted: false
    };

    io.emit("players", players);

    if (alivePlayers().length >= 2 && phase === "waiting") {
      startRound();
    }
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("players", players);
  });

  // NOMINATE (2 votes max)
  socket.on("nominate", (targetId) => {
    if (phase !== "nominating") return;

    const player = players[socket.id];
    if (!player || !player.alive) return;

    if (!player.nominated) player.nominated = [];
    if (player.nominated.length >= 2) return;
    if (player.nominated.includes(targetId)) return;

    player.nominated.push(targetId);
    nominations[targetId] = (nominations[targetId] || 0) + 1;

    io.emit("updateNominations", nominations);
  });

  // VOTE
  socket.on("vote", (targetId) => {
    if (phase !== "voting") return;

    const player = players[socket.id];
    if (!player || !player.alive) return;

    // nominees cannot vote
    if (nominees.includes(socket.id)) return;
    if (player.voted) return;

    player.voted = true;
    votes[targetId] = (votes[targetId] || 0) + 1;

    io.emit("updateVotes", votes);
  });

  // CHAT
  socket.on("chat", (msg) => {
    if (!players[socket.id]) return;

    io.emit("chat", {
      name: players[socket.id].name,
      msg
    });
  });
});

// GAME FLOW

function startRound() {
  nominations = {};
  votes = {};
  nominees = [];

  Object.values(players).forEach(p => {
    p.nominated = [];
    p.voted = false;
  });

  if (alivePlayers().length <= 3) {
    startVotingPhase();
    return;
  }

  phase = "nominating";
  io.emit("phase", { phase, nominees });

  setTimeout(() => {
    pickNominees();
    showResults(() => startVotingPhase());
  }, 20000);
}

function pickNominees() {
  const sorted = Object.entries(nominations)
    .sort((a, b) => b[1] - a[1]);

  nominees = sorted.slice(0, 2).map(([id]) => id);
}

function startVotingPhase() {
  votes = {};

  Object.values(players).forEach(p => {
    p.voted = false;
  });

  phase = "voting";
  io.emit("phase", { phase, nominees });

  setTimeout(() => {
    finishVoting();
  }, 15000);
}

function finishVoting() {
  phase = "results";
  io.emit("phase", { phase, nominees, votes });

  setTimeout(() => {
    eliminatePlayer();
    startRound();
  }, 5000);
}

function eliminatePlayer() {
  const sorted = Object.entries(votes)
    .sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) return;

  const [eliminatedId] = sorted[0];
  if (players[eliminatedId]) {
    players[eliminatedId].alive = false;
  }

  io.emit("players", players);
}

http.listen(3000, () => console.log("Server running"));