const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let players = {};
let eliminated = [];
let nominations = {};
let votes = {};
let phase = "waiting"; // waiting, nomination, eviction, final3, jury
let timer = 30;

let profiles = {}; // stores points

io.on("connection", (socket) => {

  socket.on("joinGame", (name) => {
    if (Object.keys(players).length >= 5) return;

    players[socket.id] = { name, alive: true };
    if (!profiles[name]) profiles[name] = { points: 0 };

    io.emit("updatePlayers", players);

    if (Object.keys(players).length === 5) startNomination();
  });

  socket.on("nominate", (targetId) => {
    if (phase !== "nomination") return;
    if (!nominations[targetId]) nominations[targetId] = 0;
    nominations[targetId]++;
  });

  socket.on("vote", (targetId) => {
    if (phase !== "eviction" && phase !== "final3" && phase !== "jury") return;
    if (!votes[targetId]) votes[targetId] = 0;
    votes[targetId]++;
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("updatePlayers", players);
  });
});

function startNomination() {
  phase = "nomination";
  nominations = {};
  startTimer(() => endNomination());
}

function endNomination() {
  let sorted = Object.entries(nominations)
    .sort((a, b) => b[1] - a[1]);

  let nominees = sorted.slice(0, 2).map(x => x[0]);

  io.emit("showNomResults", nominations);
  startEviction(nominees);
}

function startEviction(nominees) {
  phase = "eviction";
  votes = {};

  io.emit("nominees", nominees);

  startTimer(() => endEviction(nominees));
}

function endEviction(nominees) {
  let loser = Object.entries(votes)
    .sort((a, b) => b[1] - a[1])[0];

  if (!loser) return;

  players[loser[0]].alive = false;
  eliminated.push(players[loser[0]]);

  io.emit("eliminated", players[loser[0]].name);

  checkGameState();
}

function checkGameState() {
  let alive = Object.entries(players).filter(p => p[1].alive);

  if (alive.length === 3) {
    phase = "final3";
    votes = {};
    startTimer(() => endFinal3());
    return;
  }

  if (alive.length === 2) {
    phase = "jury";
    votes = {};
    startTimer(() => endJury());
    return;
  }

  startNomination();
}

function endFinal3() {
  let loser = Object.entries(votes)
    .sort((a, b) => b[1] - a[1])[0];

  players[loser[0]].alive = false;
  eliminated.push(players[loser[0]]);

  io.emit("eliminated", players[loser[0]].name);

  checkGameState();
}

function endJury() {
  let winner = Object.entries(votes)
    .sort((a, b) => b[1] - a[1])[0];

  let winnerName = players[winner[0]].name;

  io.emit("winner", winnerName);

  givePoints(winnerName);

  resetGame();
}

function givePoints(winner) {
  let alive = Object.values(players).filter(p => p.alive);
  let second = alive.find(p => p.name !== winner);

  profiles[winner].points += 10;
  if (second) profiles[second.name].points += 5;

  if (eliminated.length > 0) {
    profiles[eliminated[eliminated.length - 1].name].points += 1;
  }
}

function resetGame() {
  players = {};
  eliminated = [];
  nominations = {};
  votes = {};
  phase = "waiting";

  io.emit("reset");
}

function startTimer(callback) {
  timer = 30;

  let interval = setInterval(() => {
    timer--;
    io.emit("timer", timer);

    if (timer <= 0) {
      clearInterval(interval);
      callback();
    }
  }, 1000);
}

server.listen(3000, () => console.log("Running on 3000"));