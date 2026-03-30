const socket = io();

let currentPhase = "";
let nominees = [];

// JOIN GAME
document.getElementById("joinBtn").onclick = () => {
  const name = document.getElementById("nameInput").value.trim();
  if (!name) return alert("Enter a name!");

  socket.emit("join", name);
};

// PHASE UPDATE
socket.on("phase", (data) => {
  currentPhase = data.phase;
  nominees = data.nominees || [];

  document.getElementById("status").innerText = data.phase;
});

// TIMER
socket.on("timer", (time) => {
  document.getElementById("timer").innerText = "Time: " + time;
});

// PLAYERS LIST
socket.on("players", (players) => {
  const container = document.getElementById("players");
  container.innerHTML = "";
	document.getElementById("actions").innerHTML = "";

  Object.entries(players).forEach(([id, p]) => {
    const div = document.createElement("div");
    div.className = "player";
    div.innerHTML = `<strong>${p.name}</strong>`;
    container.appendChild(div);

    // ACTION BUTTONS
    if (currentPhase === "nominations") {
      const btn = document.createElement("button");
      btn.innerText = "Nominate";
      btn.onclick = () => socket.emit("nominate", id);
      document.getElementById("actions").appendChild(btn);
    }

    if (currentPhase === "eviction") {
      if (!nominees.includes(socket.id)) {
        const btn = document.createElement("button");
        btn.innerText = "Evict";
        btn.onclick = () => socket.emit("evict", id);
        document.getElementById("actions").appendChild(btn);
      }
    }
  });
});

// CHAT
function sendChat() {
  const input = document.getElementById("chatInput");
  const msg = input.value.trim();
  if (!msg) return;

  socket.emit("chat", msg);
  input.value = "";
}