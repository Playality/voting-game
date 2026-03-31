const socket = io();

// ================= STATE =================
let myId = null;
let players = [];
let phase = "waiting";
let alive = true;

let selectedNominations = [];
let selectedVote = null;

// ================= JOIN =================
function joinGame() {
  const name = document.getElementById("nameInput").value.trim();
  if (!name) return alert("Enter name");

  socket.emit("join", name);
}

socket.on("joined", (id) => {
  myId = id;
});

// ================= GAME STATE =================
socket.on("state", (data) => {
  players = data.players;
  phase = data.phase;

  const me = players.find(p => p.id === myId);
  alive = me ? me.alive : false;

  render();
});

// ================= RENDER =================
function render() {
  const container = document.getElementById("players");
  const phaseText = document.getElementById("phase");

  container.innerHTML = "";
  phaseText.innerText = phase.toUpperCase();

  players.forEach(player => {
    const card = document.createElement("div");
    card.className = "player-card";

    // DEAD = greyed out
    if (!player.alive) {
      card.classList.add("dead");
    }

    const name = document.createElement("h3");
    name.innerText = player.name;
    card.appendChild(name);

    // ================= NOMINATION =================
    if (phase === "nominating" && alive && player.id !== myId && player.alive) {
      const btn = document.createElement("button");
      btn.innerText = "Nominate";

      if (selectedNominations.includes(player.id)) {
        btn.classList.add("selected");
      }

      btn.onclick = () => {
        if (selectedNominations.includes(player.id)) {
          selectedNominations = selectedNominations.filter(id => id !== player.id);
        } else {
          if (selectedNominations.length >= 2) return;
          selectedNominations.push(player.id);
        }
        render();
      };

      card.appendChild(btn);
    }

    // ================= VOTING =================
    if (phase === "voting" && alive && player.alive) {
      // can't vote for yourself
      if (player.id !== myId) {
        const btn = document.createElement("button");
        btn.innerText = "Vote";

        if (selectedVote === player.id) {
          btn.classList.add("selected");
        }

        btn.onclick = () => {
          selectedVote = player.id;
          render();
        };

        card.appendChild(btn);
      }
    }

    container.appendChild(card);
  });

  renderActionButton();
}

// ================= ACTION BUTTON =================
function renderActionButton() {
  let existing = document.getElementById("actionBtn");
  if (existing) existing.remove();

  const btn = document.createElement("button");
  btn.id = "actionBtn";

  // NOMINATION SUBMIT
  if (phase === "nominating" && alive) {
    btn.innerText = "Submit Nominations";

    btn.onclick = () => {
      if (selectedNominations.length !== 2) {
        alert("Pick 2 players");
        return;
      }

      socket.emit("nominate", selectedNominations);
      selectedNominations = [];
    };
  }

  // VOTE SUBMIT
  if (phase === "voting" && alive) {
    btn.innerText = "Submit Vote";

    btn.onclick = () => {
      if (!selectedVote) {
        alert("Pick someone to vote");
        return;
      }

      socket.emit("vote", selectedVote);
      selectedVote = null;
    };
  }

  // ONLY show if alive
  if (alive && (phase === "nominating" || phase === "voting")) {
    document.body.appendChild(btn);
  }
}

// ================= RESULTS =================
socket.on("results", (data) => {
  const results = document.getElementById("results");
  results.innerHTML = "";

  data.forEach(r => {
    const div = document.createElement("div");
    div.innerText = `${r.name}: ${r.votes}`;
    results.appendChild(div);
  });
});