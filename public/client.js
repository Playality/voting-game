const socket = io();

let myId = null;

socket.on("connect", () => {
  myId = socket.id;
});

document.getElementById("joinBtn").onclick = () => {
  const name = document.getElementById("nameInput").value;
  socket.emit("join", name);
};

socket.on("gameState", (data) => {
  const { players, alive, phase, timer, nominationVotes, votingVotes, finalists } = data;

  document.getElementById("status").innerText = phase;
  document.getElementById("timer").innerText = "Time: " + timer;

  const container = document.getElementById("players");
  container.innerHTML = "";

  Object.entries(players).forEach(([id, p]) => {
    const div = document.createElement("div");
    div.className = "player";

    if (!alive[id]) div.classList.add("dead");
    if (finalists.includes(id)) div.classList.add("finalist");

    div.innerHTML = `<strong>${p.name}</strong>`;

    // BUTTON LOGIC 👇
    if (phase === "nominating" && id !== myId && alive[id]) {
      const btn = document.createElement("button");
      btn.innerText = "Nominate";

      if (nominationVotes[myId] === id) {
        btn.classList.add("selected");
      }

      btn.onclick = () => socket.emit("nominate", id);

      div.appendChild(btn);
    }

    if (phase === "voting" && finalists.includes(id) && id !== myId) {
      const btn = document.createElement("button");
      btn.innerText = "Vote";

      if (votingVotes[myId] === id) {
        btn.classList.add("selected");
      }

      btn.onclick = () => socket.emit("vote", id);

      div.appendChild(btn);
    }

    container.appendChild(div);
  });
});