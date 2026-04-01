const socket = io();

let myId = null;
let players = [];
let phase = "waiting";
let nominees = [];

let selected = [];
let votePick = null;

function joinGame() {
  const name = document.getElementById("nameInput").value.trim();
  if (!name) return;
  socket.emit("join", name);
}

socket.on("joined", id => {
  myId = id;
});

socket.on("state", data => {
  players = data.players;
  phase = data.phase;
  nominees = data.nominees || [];
  render();
});

socket.on("results", data => {
  document.getElementById("results").innerHTML =
    data.map(r => `${r.name}: ${r.votes}`).join("<br>");
});

function render() {
  const div = document.getElementById("players");
  div.innerHTML = "";

  const me = players.find(p => p.id === myId);
  const alive = me?.alive;

  players.forEach(p => {
    const card = document.createElement("div");
    card.className = "card";
    if (!p.alive) card.classList.add("dead");

    card.innerHTML = `<h3>${p.name}</h3>`;

    // NOMINATE
    if (phase === "nominating" && alive && p.id !== myId && p.alive) {
      const btn = document.createElement("button");
      btn.innerText = "Nominate";

      if (selected.includes(p.id)) btn.classList.add("selected");

      btn.onclick = () => {
        if (selected.includes(p.id)) {
          selected = selected.filter(x => x !== p.id);
        } else if (selected.length < 2) {
          selected.push(p.id);
        }
        render();
      };

      card.appendChild(btn);
    }

    // VOTE
    if (phase === "voting" && alive && p.alive && p.id !== myId) {
      if (!nominees.includes(myId)) {
        const btn = document.createElement("button");
        btn.innerText = "Vote";

        if (votePick === p.id) btn.classList.add("selected");

        btn.onclick = () => {
          votePick = p.id;
          render();
        };

        card.appendChild(btn);
      }
    }
    div.appendChild(card);
  });

  renderSubmit(alive);
}

function renderSubmit(alive) {
  let btn = document.getElementById("submit");
  if (btn) btn.remove();

  btn = document.createElement("button");
  btn.id = "submit";

  if (phase === "nominating" && alive) {
    btn.innerText = "Submit Nominations";
    btn.onclick = () => {
      if (selected.length !== 2) return alert("Pick 2 players");
      socket.emit("nominate", selected);
      selected = [];
    };
  }

  if (phase === "voting" && alive) {
    btn.innerText = "Submit Vote";
    btn.onclick = () => {
      if (!votePick) return alert("Pick someone");
      socket.emit("vote", votePick);
      votePick = null;
    };
  }

  if (alive && (phase === "nominating" || phase === "voting")) {
    document.body.appendChild(btn);
  }
}