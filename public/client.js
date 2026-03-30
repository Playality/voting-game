const socket = io();

let currentPhase = "waiting";
let nominees = [];

function join() {
  const name = document.getElementById("nameInput").value;
  socket.emit("join", name);
}

socket.on("phase", (data) => {
  currentPhase = data.phase;
  nominees = data.nominees || [];

  document.getElementById("status").innerText = currentPhase;
});

socket.on("players", (players) => {
  const container = document.getElementById("players");
  container.innerHTML = "";

  Object.entries(players).forEach(([id, p]) => {
    const div = document.createElement("div");
    div.className = "player";

    if (!p.alive) div.classList.add("dead");

    div.innerHTML = `<strong>${p.name}</strong>`;

    // NOMINATE
    if (currentPhase === "nominating" && id !== socket.id && p.alive) {
      const btn = document.createElement("button");
      btn.innerText = "Nominate";

      btn.onclick = () => {
        socket.emit("nominate", id);
        btn.classList.add("selected");
      };

      div.appendChild(btn);
    }

    // VOTE
    if (
      currentPhase === "voting" &&
      nominees.includes(id) &&
      !nominees.includes(socket.id) &&
      p.alive
    ) {
      const btn = document.createElement("button");
      btn.innerText = "Vote";

      btn.onclick = () => {
        socket.emit("vote", id);
        btn.classList.add("selected");
      };

      div.appendChild(btn);
    }

    container.appendChild(div);
  });
});

// RESULTS
socket.on("updateVotes", (votes) => {
  document.getElementById("results").innerText =
    "Votes: " + JSON.stringify(votes);
});

// CHAT
function sendChat() {
  const msg = document.getElementById("chatInput").value;
  socket.emit("chat", msg);
}

socket.on("chat", (data) => {
  const box = document.getElementById("chatBox");
  box.innerHTML += `<p><b>${data.name}:</b> ${data.msg}</p>`;
});
socket.on("timer", (t) => {
  document.getElementById("timer").innerText = "Time: " + t;
});
socket.on("results", (data) => {
  document.getElementById("results").innerText = data.text;
});