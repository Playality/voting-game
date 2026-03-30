socket.on("phase", (data) => {
  currentPhase = data.phase;
  nominees = data.nominees || [];

  document.getElementById("actions").innerHTML = "";
});

socket.on("players", (players) => {
  const container = document.getElementById("players");
  container.innerHTML = "";

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