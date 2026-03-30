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
  return Object.values(players).filter(p => p.alive);
}

// GAME LOOP TIMER
function startTimer(duration, callback) {
  timer = duration;

  const interval = setInterval(() => {
    timer--;
    io.emit("timer", timer);

    if (timer <= 0) {
      clearInterval(interval);
      callback();
    }
  }, 1000);
}

// JOIN
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

    if (alivePlayers().length >= 5 && phase === "waiting") {
      startRound();
    }
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("players", players);
  });

  // NOMINATE (2 votes)
  socket.on("nominate", (targetId) => {
    if (phase !== "nominating") return;

    const p = players[socket.id];
    if (!p || !p.alive) return;

    if (p.nominated.length >= 2) return;
    if (p.nominated.includes(targetId)) return;

    p.nominated.push(targetId);
    nominations[targetId] = (nominations[targetId] || 0) + 1;

    io.emit("nominationUpdate", nominations);
  });

  // VOTE
  socket.on("vote", (targetId) => {
    if (phase !== "voting") return;

    const p = players[socket.id];
    if (!p || !p.alive) return;

    if (nominees.includes(socket.id)) return; // nominees can't vote
    if (p.voted) return;

    p.voted = true;
    votes[targetId] = (votes[targetId] || 0) + 1;

    io.emit("voteUpdate", votes);
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
  io.emit("phase", { phase });

  startTimer(20, () => {
    pickNominees();
    showNominationResults();
  });
}

// SMART TIE BREAKER
function pickNominees() {
  let sorted = Object.entries(nominations)
    .sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) return;

  let topVotes = sorted[0][1];

  // include ALL tied at top
  nominees = sorted
    .filter(([_, v]) => v === topVotes)
    .map(([id]) => id);

  // if only 1 → add next highest
  if (nominees.length === 1 && sorted[1]) {
    nominees.push(sorted[1][0]);
  }
}

// SHOW NOMINATION RESULTS (VOTE TALLY)
function showNominationResults() {
  phase = "results";

  const results = Object.entries(nominations)
    .map(([id, count]) => `${players[id]?.name || "?"}: ${count}`)
    .join(" | ");

  io.emit("results", {
    text: "Nomination Results: " + results,
    nominees
  });

  startTimer(8, startVotingPhase);
}

function startVotingPhase() {
  votes = {};

  Object.values(players).forEach(p => {
    p.voted = false;
  });

  phase = "voting";
  io.emit("phase", { phase, nominees });

  startTimer(15, finishVoting);
}

function finishVoting() {
  phase = "results";

  const results = Object.entries(votes)
    .map(([id, count]) => `${players[id]?.name || "?"}: ${count}`)
    .join(" | ");

  io.emit("results", {
    text: "Eviction Votes: " + results,
    nominees
  });

  startTimer(6, () => {
    eliminate();
    startRound();
  });
}

function eliminate() {
  let sorted = Object.entries(votes)
    .sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) return;

  let max = sorted[0][1];

  let tied = sorted.filter(([_, v]) => v === max);

  // random tie breaker
  let out = tied[Math.floor(Math.random() * tied.length)][0];

  if (players[out]) players[out].alive = false;

  io.emit("players", players);
}

http.listen(3000, () => console.log("Server running"));