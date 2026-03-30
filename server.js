const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let players = {};
let phase = "waiting"; // waiting, nominations, eviction
let nominations = {};
let evictionVotes = {};
let nominees = [];
let timer = 30;

function startGame() {
  phase = "nominations";
  nominations = {};
  nominees = [];
  timer = 30;

  io.emit("phase", { phase, timer });
}

function startEviction() {
  phase = "eviction";
  evictionVotes = {};
  timer = 30;

  io.emit("phase", { phase, timer, nominees });
}

function endEviction() {
  let counts = {};

  for (let vote of Object.values(evictionVotes)) {
    counts[vote] = (counts[vote] || 0) + 1;
  }

  let eliminated = Object.keys(counts).reduce((a, b) =>
    counts[a] > counts[b] ? a : b
  );

  delete players[eliminated];

  io.emit("eliminated", eliminated);

  if (Object.keys(players).length <= 2) {
    phase = "end";
    io.emit("gameOver", players);
    return;
  }

  startGame();
}

setInterval(() => {
  if (phase === "waiting") return;

  timer--;
  io.emit("timer", timer);

  if (timer <= 0) {
    if (phase === "nominations") {
      let counts = {};

      for (let vote of Object.values(nominations)) {
        counts[vote] = (counts[vote] || 0) + 1;
      }

      nominees = Object.keys(counts)
        .sort((a, b) => counts[b] - counts[a])
        .slice(0, 2);

      startEviction();
    } else if (phase === "eviction") {
      endEviction();
    }
  }
}, 1000);

io.on("connection", (socket) => {
  socket.on("join", (name) => {
    players[socket.id] = { name };

    io.emit("players", players);

    if (Object.keys(players).length >= 5 && phase === "waiting") {
      startGame();
    }
  });

  socket.on("nominate", (id) => {
    if (phase !== "nominations") return;
    if (!players[socket.id]) return;

    nominations[socket.id] = id;
  });

  socket.on("evict", (id) => {
    if (phase !== "eviction") return;

    // ❌ nominated players can't vote
    if (nominees.includes(socket.id)) return;

    evictionVotes[socket.id] = id;
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("players", players);
  });
});

server.listen(3000, () => console.log("Server running"));