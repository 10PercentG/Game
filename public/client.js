const socket = io();

let playerRole = ""; // will be set on game start
let currentRoom = "";

// DOM Elements
const lobbyDiv = document.getElementById("lobby");
const gameDiv = document.getElementById("game");
const joinBtn = document.getElementById("joinBtn");
const playerNameInput = document.getElementById("playerName");
const roomNameInput = document.getElementById("roomName");
const roomDisplay = document.getElementById("roomDisplay");
const playersList = document.getElementById("playersList");
const hostControls = document.getElementById("hostControls");
const startGameBtn = document.getElementById("startGameBtn");
const endGameBtn = document.getElementById("endGameBtn");
const startVotingBtn = document.getElementById("startVotingBtn");
const endVotingBtn = document.getElementById("endVotingBtn");
const gameInfo = document.getElementById("gameInfo");
const votingPanel = document.getElementById("votingPanel");
const votingCandidates = document.getElementById("votingCandidates");
const chatDiv = document.getElementById("chat");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");

// Join room and switch to game screen
joinBtn.addEventListener("click", () => {
  const playerName = playerNameInput.value.trim();
  const roomName = roomNameInput.value.trim();
  if (playerName && roomName) {
    currentRoom = roomName;
    socket.emit("joinRoom", roomName, playerName);
    roomDisplay.textContent = roomName;

    // Simple fade transition from lobby to game
    lobbyDiv.classList.add("animate__fadeOut");
    setTimeout(() => {
      lobbyDiv.classList.add("d-none");
      gameDiv.classList.remove("d-none");
      gameDiv.classList.add("animate__fadeIn");
    }, 500);
  }
});

// Start and end game events
startGameBtn.addEventListener("click", () => {
  socket.emit("startGame", currentRoom);
});

endGameBtn.addEventListener("click", () => {
  socket.emit("endGame", currentRoom);
});

// Start and end voting events
startVotingBtn.addEventListener("click", () => {
  socket.emit("startVoting", currentRoom);
  endVotingBtn.classList.remove("d-none");
});

endVotingBtn.addEventListener("click", () => {
  socket.emit("endVoting", currentRoom);
  endVotingBtn.classList.add("d-none");
});

// Chat send
sendBtn.addEventListener("click", sendMessage);
chatInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});

function sendMessage() {
  const msg = chatInput.value.trim();
  if (msg) {
    socket.emit("chatMessage", currentRoom, msg);
    chatInput.value = "";
  }
}

/* 
  showResultPopup:
  - Creates a container holding all popup elements.
  - This container includes:
      • A full-screen dark overlay.
      • A centered popup box showing "You Win!" (green) or "You Lose!" (red).
      • Below that, an element showing:
              Imposter:
              
              [Imposter Name]
  - Confetti is triggered for winners.
  - The entire container is removed after 2 seconds.
*/
function showResultPopup(isWinner, imposterName) {
  // Create a container for all popup elements.
  const resultContainer = document.createElement("div");
  resultContainer.style.position = "fixed";
  resultContainer.style.top = "0";
  resultContainer.style.left = "0";
  resultContainer.style.width = "100%";
  resultContainer.style.height = "100%";
  resultContainer.style.zIndex = "9997";
  document.body.appendChild(resultContainer);

  // Create dark overlay.
  const overlay = document.createElement("div");
  overlay.style.position = "absolute";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.backgroundColor = "rgba(0, 0, 0, 0.9)";
  overlay.style.opacity = "0";
  overlay.style.transition = "opacity 0.5s ease";
  resultContainer.appendChild(overlay);
  overlay.getBoundingClientRect();
  overlay.style.opacity = "1";

  // Wait 0.5 seconds, then show popup and info.
  setTimeout(() => {
    // Create popup box.
    const popup = document.createElement("div");
    popup.style.position = "absolute";
    popup.style.top = "40%"; // slightly higher to leave room below
    popup.style.left = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    popup.style.padding = "40px 80px";
    popup.style.fontSize = "4em";
    popup.style.fontFamily = "'Press Start 2P', cursive";
    popup.style.color = "#fff";
    popup.style.zIndex = "9999";
    popup.style.borderRadius = "15px";
    popup.style.textAlign = "center";
    popup.style.border = "5px solid #fff";
    popup.style.boxShadow = "0 0 30px rgba(255, 255, 255, 0.8)";
    popup.style.opacity = "0";
    popup.style.transition = "opacity 0.5s ease";

    if (isWinner) {
      popup.innerText = "You Win!";
      popup.style.background = "linear-gradient(45deg, #00ff00, #008000)";
    } else {
      popup.innerText = "You Lose!";
      popup.style.background = "linear-gradient(45deg, #ff0000, #8B0000)";
    }
    resultContainer.appendChild(popup);
    popup.getBoundingClientRect();
    popup.style.opacity = "1";

    // Create imposter info element (below popup)
    const imposterInfo = document.createElement("div");
    imposterInfo.style.position = "absolute";
    imposterInfo.style.top = "65%"; // position below popup
    imposterInfo.style.left = "50%";
    imposterInfo.style.transform = "translate(-50%, -50%)";
    imposterInfo.style.fontSize = "2em";
    imposterInfo.style.fontFamily = "'Press Start 2P', cursive";
    imposterInfo.style.color = "#fff";
    imposterInfo.style.textAlign = "center";
    imposterInfo.style.zIndex = "9999";
    imposterInfo.style.lineHeight = "1.2";
    // Two <br> tags for extra spacing.
    imposterInfo.innerHTML = "Imposter:<br><br>" + imposterName;
    resultContainer.appendChild(imposterInfo);

    // Trigger confetti for winners.
    if (isWinner) {
      confetti({
        particleCount: 200,
        spread: 100,
        origin: { y: 0.6 },
        zIndex: 10000
      });
    }

    // Remove the entire container after 2 seconds.
    setTimeout(() => {
      resultContainer.remove();
    }, 2000);
  }, 500);
}

// Socket event handlers

socket.on("updatePlayers", (players, hostId) => {
  playersList.innerHTML =
    `<h4>Players:</h4><ul class="list-group">` +
    Object.values(players)
      .map((name) => `<li class="list-group-item">${name}</li>`)
      .join("") +
    `</ul>`;
  socket.id === hostId
    ? (hostControls.style.display = "block")
    : (hostControls.style.display = "none");
});

socket.on("gameStarted", (data) => {
  playerRole = data.role;
  if (data.role === "imposter") {
    gameInfo.innerHTML =
      `<div class="alert alert-warning animate__animated animate__fadeIn">You are the imposter! Try to hide your identity.</div>`;
  } else {
    gameInfo.innerHTML =
      `<div class="alert alert-info animate__animated animate__fadeIn">Your word is: <strong>${data.word}</strong></div>`;
  }
});

socket.on("gameEnded", (data) => {
  gameInfo.innerHTML =
    `<div class="alert alert-secondary animate__animated animate__fadeIn">${data.result}</div>`;
  let isWinner = false;
  if (data.winningSide === "players" && playerRole !== "imposter") {
    isWinner = true;
  } else if (data.winningSide === "imposter" && playerRole === "imposter") {
    isWinner = true;
  }
  showResultPopup(isWinner, data.imposterName);
});

socket.on("votingStarted", (players) => {
  console.log("Voting started event received with players:", players);
  votingPanel.classList.remove("d-none");
  votingCandidates.innerHTML = "";
  // Create a button for each candidate with vote count 0.
  Object.entries(players).forEach(([id, name]) => {
    const candidateButton = document.createElement("button");
    candidateButton.className = "list-group-item list-group-item-action";
    candidateButton.setAttribute("data-id", id);
    candidateButton.setAttribute("data-name", name);
    candidateButton.textContent = `${name} (0)`;
    candidateButton.addEventListener("click", () => {
      socket.emit("castVote", currentRoom, id);
      // Allow vote changes; buttons remain enabled.
    });
    votingCandidates.appendChild(candidateButton);
  });
});

socket.on("voteUpdate", (voteCounts) => {
  Array.from(votingCandidates.children).forEach((btn) => {
    const candidateId = btn.getAttribute("data-id");
    const name = btn.getAttribute("data-name");
    const count = voteCounts[candidateId] || 0;
    btn.textContent = `${name} (${count})`;
  });
});

socket.on("votingResults", (data) => {
  votingPanel.classList.add("d-none");
  gameInfo.innerHTML =
    `<div class="alert alert-info animate__animated animate__fadeIn">${data.result}</div>`;
  let isWinner = false;
  if (data.winningSide === "players" && playerRole !== "imposter") {
    isWinner = true;
  } else if (data.winningSide === "imposter" && playerRole === "imposter") {
    isWinner = true;
  }
  showResultPopup(isWinner, data.imposterName);
  console.log("Vote distribution: ", data.voteDistribution);
});

socket.on("chatMessage", (data) => {
  const messageElement = document.createElement("div");
  messageElement.innerHTML = `<strong>${data.sender}:</strong> ${data.message}`;
  messageElement.classList.add("animate__animated", "animate__fadeIn");
  chatDiv.appendChild(messageElement);
  chatDiv.scrollTop = chatDiv.scrollHeight;
});

socket.on("message", (msg) => {
  const messageElement = document.createElement("div");
  messageElement.innerHTML = `<em>${msg}</em>`;
  messageElement.classList.add("animate__animated", "animate__fadeIn");
  chatDiv.appendChild(messageElement);
  chatDiv.scrollTop = chatDiv.scrollHeight;
});
