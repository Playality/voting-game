const socket = io();

let myId = null;
let myVote = null;

socket.on("connect", () => {
  myId = socket.id;
});

document.getElementById("joinBtn").onclick = () => {
  const name = document.getElementById("nameInput").value;
  if (!name) return;
  socket.emit("join", name);
};

socket.on("players", (players, alive) => {
  const container = document.getElementById("players");
  container.innerHTML = "";

  Object.entries(players).forEach(([id, p]) => {
    const div = document.createElement("div");
    div.className = "player";

    if (!alive[id]) div.classList.add("dead");

    const name = document.createElement("div");
    name.innerText = p.name;

    div.appendChild(name);

    // VOTE BUTTON
    if (id !== myId && alive[id]) {
      const btn = document.createElement("button");
      btn.innerText = "Vote";

      if (myVote === id) {
        btn.classList.add("voted");
      }

      btn.onclick = () => {
        myVote = id;
        socket.emit("vote", id);
      };

      div.appendChild(btn);
    }

    container.appendChild(div);
  });
});

socket.on("votes", (votes) => {
  const results = document.getElementById("results");

  let count = {};

  Object.values(votes).forEach((v) => {
    count[v] = (count[v] || 0) + 1;
  });

  results.innerHTML = "Votes:<br>" + JSON.stringify(count);
});

socket.on("chat", (data) => {
  const chatBox = document.getElementById("chatBox");
  chatBox.innerHTML += `<div><b>${data.name}:</b> ${data.msg}</div>`;
});

function sendChat() {
  const input = document.getElementById("chatInput");
  socket.emit("chat", input.value);
  input.value = "";
}