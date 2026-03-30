const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let players = {};
let votes = {};
let alive = {};
let phase = "waiting";

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", (name) => {
    players[socket.id] = { name };
    alive[socket.id] = true;

    io.emit("players", players, alive);
  });

  socket.on("vote", (targetId) => {
    if (!alive[socket.id]) return;

    votes[socket.id] = targetId;
    io.emit("votes", votes);
  });

  socket.on("chat", (msg) => {
    io.emit("chat", {
      name: players[socket.id]?.name || "Unknown",
      msg,
    });
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    delete votes[socket.id];
    delete alive[socket.id];
    io.emit("players", players, alive);
  });
});

server.listen(3000, () => console.log("Server running"));