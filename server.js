const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let players = {};
let alive = {};

let nominationVotes = {};
let votingVotes = {};
let finalists = [];

let phase = "waiting";
let timer = 30;

function alivePlayers() {
  return Object.keys(alive).filter(id => alive[id]);
}

function getTopNominees() {
  let count = {};
  Object.values(nominationVotes).forEach(v => {
    count[v] = (count[v] || 0) + 1;
  });

  let max = Math.max(...Object.values(count), 0);
  return Object.keys(count).filter(id => count[id] === max);
}

function eliminateFromVotes(votes) {
  let count = {};

  Object.values(votes).forEach(v => {
    count[v] = (count[v] || 0) + 1;
  });

  let max = 0;
  let out = null;

  for (let id in count) {
    if (count[id] > max) {
      max = count[id];
      out = id;
    }
  }

  if (out) alive[out] = false;
}

function nextPhase() {
  const aliveList = alivePlayers();

  if (aliveList.length <= 1) {
    phase = "gameover";
    return;
  }

  // FINAL 3
  if (aliveList.length <= 3) {
    if (phase === "waiting") {
      phase = "voting";
      timer = 20;
      votingVotes = {};
      finalists = [...aliveList];
      return;
    }

    if (phase === "voting") {
      eliminateFromVotes(votingVotes);
      phase = "results";
      timer = 8;
      return;
    }

    if (phase === "results") {
      phase = "voting";
      timer = 20;
      votingVotes = {};
      finalists = [...alivePlayers()];
      return;
    }
  }

  // NORMAL FLOW
  if (phase === "waiting") {
    phase = "nominating";
    timer = 20;
    nominationVotes = {};
  }

  else if (phase === "nominating") {
    finalists = getTopNominees();
    phase = "results";
    timer = 8;
  }

  else if (phase === "results" && finalists.length > 1) {
    phase = "voting";
    timer = 20;
    votingVotes = {};
  }

  else if (phase === "voting") {
    eliminateFromVotes(votingVotes);
    phase = "results";
    timer = 8;
  }

  else {
    phase = "waiting";
    timer = 10;
  }
}

function gameLoop() {
  setInterval(() => {
    if (Object.keys(players).length < 2) {
      phase = "waiting";
      timer = 30;
      return;
    }

    timer--;

    if (timer <= 0) {
      nextPhase();
    }

    io.emit("gameState", {
      players,
      alive,
      phase,
      timer,
      nominationVotes,
      votingVotes,
      finalists
    });

  }, 1000);
}

io.on("connection", (socket) => {

  socket.on("join", (name) => {
    players[socket.id] = { name };
    alive[socket.id] = true;
  });

  socket.on("nominate", (id) => {
    if (phase !== "nominating") return;
    if (!alive[socket.id]) return;

    nominationVotes[socket.id] = id;
  });

  socket.on("vote", (id) => {
    if (phase !== "voting") return;
    if (!alive[socket.id]) return;

    votingVotes[socket.id] = id;
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    delete alive[socket.id];
  });
});

gameLoop();

server.listen(3000, () => console.log("Running"));