const socket = io();
console.log("CLIENT LOADED");

// ======================
// STATE
// ======================

let myId = null;
let currentPhase = null;

let hasVoted = false;
let nominationsMade = [];

// ======================
// JOIN
// ======================

function join() {
  const name = document.getElementById("nameInput").value.trim();
  if (!name) return;

  socket.emit("join", name);
}

// ======================
// SOCKET
// ======================

socket.on("connect", () => {
  myId = socket.id;
});

socket.on("state", state => {

  // ✅ RESET EACH PHASE
  if (state.phase !== currentPhase) {
    hasVoted = false;
    nominationsMade = [];
  }

  currentPhase = state.phase;

  document.getElementById("phase").innerText = state.phase.toUpperCase();
  document.getElementById("timer").innerText = "Time: " + state.timer;

  renderPlayers(state);
  renderResults(state);
});

// ======================
// RENDER PLAYERS
// ======================

function renderPlayers(state) {
  const container = document.getElementById("players");
  container.innerHTML = "";

  const players = Object.values(state.players);

  players.forEach(player => {
    const div = document.createElement("div");
    div.className = "player";

    // DEAD = greyed out
    if (!player.alive) {
      div.style.opacity = "0.4";
    }

    // NOMINATED highlight
    if (state.nominatedPlayers.includes(player.id)) {
      div.style.border = "2px solid red";
    }

    const name = document.createElement("h3");
    name.innerText = player.name;

    const voteCount = state.votes[player.id] || 0;
    const nomCount = state.nominations[player.id] || 0;

    const stats = document.createElement("p");
    stats.innerText = `Votes: ${voteCount} | Noms: ${nomCount}`;

    div.appendChild(name);
    div.appendChild(stats);

    // ======================
    // NOMINATE BUTTON
    // ======================

    if (
      state.phase === "nominating" &&
      player.alive &&
      player.id !== myId &&
      nominationsMade.length < 2
    ) {
      const btn = document.createElement("button");
      btn.innerText = "Nominate";

      btn.onclick = () => {
        if (nominationsMade.includes(player.id)) return;

        nominationsMade.push(player.id);
        socket.emit("nominate", player.id);
      };

      div.appendChild(btn);
    }

    // ======================
    // VOTE BUTTON
    // ======================

    if (
      state.phase === "voting" &&
      player.alive &&
      !hasVoted &&
      player.id !== myId &&
      !state.nominatedPlayers.includes(myId) // ❗ cannot vote if nominated
    ) {
      const btn = document.createElement("button");
      btn.innerText = "Vote";

      btn.onclick = () => {
        hasVoted = true;
        socket.emit("vote", player.id);
      };

      div.appendChild(btn);
    }

    container.appendChild(div);
  });
}

// ======================
// RESULTS
// ======================

function renderResults(state) {
  const results = document.getElementById("results");

  if (state.phase === "results") {
    results.innerText = "Round finished!";
  } else {
    results.innerText = "";
  }
}

// ======================
// CHAT (optional)
// ======================

function sendMessage() {
  const input = document.getElementById("chatInput");
  const msg = input.value.trim();
  if (!msg) return;

  socket.emit("chat", msg);
  input.value = "";
}