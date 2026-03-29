const socket = io();
let myId = null;
let players = {};

function joinGame() {
  const name = document.getElementById("name").value;
  socket.emit("joinGame", name);
}

socket.on("connect", () => {
  myId = socket.id;
});

socket.on("updatePlayers", (data) => {
  players = data;
  renderPlayers();
});

socket.on("timer", (t) => {
  document.getElementById("timer").innerText = "Time: " + t;
});

socket.on("showNomResults", (data) => {
  document.getElementById("results").innerText =
    "Nom votes: " + JSON.stringify(data);
});

socket.on("nominees", (list) => {
  renderVoteButtons(list);
});

socket.on("eliminated", (name) => {
  document.getElementById("results").innerText = name + " eliminated";
});

socket.on("winner", (name) => {
  document.getElementById("results").innerText = "Winner: " + name;
});

function renderPlayers() {
  const div = document.getElementById("players");
  div.innerHTML = "";

  for (let id in players) {
    const p = players[id];
    div.innerHTML += `<div class="card">${p.name}<br>${p.alive ? "🟢" : "💀"}</div>`;
  }

  renderNomButtons();
}

function renderNomButtons() {
  const div = document.getElementById("actions");
  div.innerHTML = "";

  for (let id in players) {
    if (id !== myId && players[id].alive) {
      div.innerHTML += `<button onclick="nominate('${id}')">Nominate ${players[id].name}</button>`;
    }
  }
}

function renderVoteButtons(list) {
  const div = document.getElementById("actions");
  div.innerHTML = "";

  list.forEach(id => {
    div.innerHTML += `<button onclick="vote('${id}')">Vote ${players[id].name}</button>`;
  });
}

function nominate(id) {
  socket.emit("nominate", id);
}

function vote(id) {
  socket.emit("vote", id);
}