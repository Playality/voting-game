const socket = io();

let myId = null;
let voted = false;
let nominated = false;

function join() {
  const name = document.getElementById("name").value;
  socket.emit("join", name);
}

socket.on("connect", () => {
  myId = socket.id;
});

socket.on("update", data => {
  document.getElementById("phase").innerText = data.phase;
  document.getElementById("timer").innerText = "Time: " + data.timer;

  const container = document.getElementById("players");
  container.innerHTML = "";

  voted = false;
  nominated = false;

  data.players.forEach(p => {
    const div = document.createElement("div");
    div.className = "player";

    if (!p.alive) div.classList.add("dead");

    div.innerHTML = `<h3>${p.name}</h3>`;

    if (data.phase === "nominating" && p.id !== myId && p.alive) {
      const btn = document.createElement("button");
      btn.innerText = "Nominate";
      btn.onclick = () => {
        socket.emit("nominate", p.id);
        btn.classList.add("clicked");
      };
      div.appendChild(btn);
    }

    if (
      data.phase === "voting" &&
      data.nominees.includes(p.id) &&
      !data.nominees.includes(myId)
    ) {
      const btn = document.createElement("button");
      btn.innerText = "Vote";
      btn.onclick = () => {
        socket.emit("vote", p.id);
        btn.classList.add("clicked");
      };
      div.appendChild(btn);
    }

    container.appendChild(div);
  });

  document.getElementById("results").innerText =
    "Votes: " + JSON.stringify(data.votes);
});

socket.on("chat", msg => {
  const box = document.getElementById("chatBox");
  box.innerHTML += `<div>${msg}</div>`;
});

function sendChat() {
  const msg = document.getElementById("chatInput").value;
  socket.emit("chat", msg);
}