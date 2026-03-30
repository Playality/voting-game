const socket = io();

let currentPhase = "";
let nominees = [];
let myId = null;

// JOIN
document.getElementById("joinBtn").onclick = () => {
  const name = document.getElementById("nameInput").value.trim();
  if (!name) return alert("Enter a name!");
  socket.emit("join", name);
};

socket.on("connect", () => {
  myId = socket.id;
});

// PHASE
socket.on("phase", (data) => {
  currentPhase = data.phase;
  nominees = data.nominees || [];

  document.getElementById("status").innerText = data.phase;
});

// TIMER
socket.on("timer", (time) => {
  document.getElementById("timer").innerText = "Time: " + time;
});

// PLAYERS UI
socket.on("players", (players) => {
  const container = document.getElementById("players");
  container.innerHTML = "";

  Object.entries(players).forEach(([id, p]) => {
    const div = document.createElement("div");
    div.className = "player-box";

    div.innerHTML = `<strong>${p.name}</strong>`;

    // BUTTON INSIDE PLAYER
    if (currentPhase === "nominations" && id !== myId) {
      const btn = document.createElement("button");
      btn.innerText = "Nominate";
      btn.onclick = () => {
        socket.emit("nominate", id);
        btn.classList.add("selected");
      };
      div.appendChild(btn);
    }

    if (currentPhase === "eviction" && id !== myId) {
      if (!nominees.includes(myId)) {
        const btn = document.createElement("button");
        btn.innerText = "Evict";
        btn.onclick = () => {
          socket.emit("evict", id);
          btn.classList.add("selected");
        };
        div.appendChild(btn);
      }
    }

    container.appendChild(div);
  });
});

// RESULTS (simple display)
socket.on("phase", (data) => {
  if (data.phase === "eviction") {
    document.getElementById("results").innerText =
      "Nominees: " + (data.nominees || []).join(", ");
  }
});

socket.on("eliminated", (id) => {
  document.getElementById("results").innerText = `Eliminated: ${id}`;
});

socket.on("gameOver", (players) => {
  document.getElementById("results").innerText =
    "Winner(s): " + Object.values(players).map(p => p.name).join(", ");
});

// CHAT RECEIVE
socket.on("chat", (msg) => {
  const box = document.getElementById("chatBox");
  const div = document.createElement("div");
  div.innerText = msg;
  box.appendChild(div);
});

// CHAT SEND
function sendChat() {
  const input = document.getElementById("chatInput");
  const msg = input.value.trim();
  if (!msg) return;

  socket.emit("chat", msg);
  input.value = "";
}