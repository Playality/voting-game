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
let timer = 0;

function alivePlayers() {
  return Object.keys(players).filter(id => players[id].alive);
}

function sendGameState() {
  io.emit("gameState", {
    players,
    phase,
    nominations,
    votes,
    nominees,
    timer
  });
}

function startTimer(duration, next) {
  timer = duration;
  sendGameState();

  const interval = setInterval(() => {
    timer--;
    sendGameState();

    if (timer <= 0) {
      clearInterval(interval);
      next();
    }
  }, 1000);
}

io.on("connection", (socket) => {

  socket.on("join", (name) => {
    players[socket.id] = {
      name,
      alive: true,
      nominated: [],
      voted: false
    };

    sendGameState();

    if (alivePlayers().length >= 5 && phase === "waiting") {
      startRound();
    }
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    sendGameState();
  });

  socket.on("nominate", (targetId) => {
    if (phase !== "nominating") return;

    const p = players[socket.id];
    if (!p || !p.alive) return;

    if (p.nominated.length >= 2) return;
    if (p.nominated.includes(targetId)) return;

    p.nominated.push(targetId);
    nominations[targetId] = (nominations[targetId] || 0) + 1;

    sendGameState();
  });

  socket.on("vote", (targetId) => {
    if (phase !== "voting") return;

    const p = players[socket.id];
    if (!p || !p.alive) return;

    if (nominees.includes(socket.id)) return;
    if (p.voted) return;

    p.voted = true;
    votes[targetId] = (votes[targetId] || 0) + 1;

    sendGameState();
  });

  socket.on("chat", (msg) => {
    io.emit("chat", {
      name: players[socket.id]?.name || "Unknown",
      msg
    });
  });
});

function startRound() {
  nominations = {};
  votes = {};
  nominees = [];

  Object.values(players).forEach(p => {
    p.nominated = [];
    p.voted = false;
  });

  if (alivePlayers().length <= 3) {
    startVoting();
    return;
  }

  phase = "nominating";
  startTimer(20, finishNominations);
}

function finishNominations() {
  pickNominees();
  phase = "results";
  startTimer(6, startVoting);
}

function pickNominees() {
  let sorted = Object.entries(nominations)
    .sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) return;

  let top = sorted[0][1];

  nominees = sorted
    .filter(([_, v]) => v === top)
    .map(([id]) => id);

  if (nominees.length === 1 && sorted[1]) {
    nominees.push(sorted[1][0]);
  }
}

function startVoting() {
  votes = {};

  Object.values(players).forEach(p => {
    p.voted = false;
  });

  phase = "voting";
  startTimer(15, finishVoting);
}

function finishVoting() {
  eliminate();
  phase = "results";
  startTimer(5, startRound);
}

function eliminate() {
  let sorted = Object.entries(votes)
    .sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) return;

  let max = sorted[0][1];
  let tied = sorted.filter(([_, v]) => v === max);

  let out = tied[Math.floor(Math.random() * tied.length)][0];

  if (players[out]) players[out].alive = false;
}

http.listen(3000, () => console.log("Running"));