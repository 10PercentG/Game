const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

// Declare rooms globally so all events can access it.
let rooms = {};

// A huge list of place words for more variety in the game
function getRandomWord() {
  const words = ["apple","banana","orange","grape","pear","peach","plum","cherry","berry","melon","pineapple","mango","kiwi","lemon","lime","tomato","cucumber","carrot","potato","broccoli","spinach","lettuce","pepper","onion","garlic","pumpkin","zucchini","corn","bean","pea","dog","cat","bird","fish","horse","cow","pig","sheep","goat","duck","rabbit","hamster","squirrel","bear","lion","tiger","elephant","giraffe","zebra","monkey","kangaroo","panda","wolf","fox","dolphin","shark","whale","seal","otter","penguin","tree","flower","leaf","bush","grass","rock","mountain","river","lake","ocean","beach","island","forest","desert","volcano","waterfall","cave","cloud","rain","snow","wind","storm","rainbow","sun","moon","star","sky","comet","galaxy","planet","house","home","room","door","window","wall","floor","roof","bed","chair","table","sofa","lamp","clock","book","pen","pencil","paper","crayon","marker","notebook","bag","key","phone","computer","TV","radio","camera","fridge","oven","bread","cheese","milk","yogurt","egg","chicken","beef","pizza","burger","sandwich","hotdog","fries","salad","soup","pasta","rice","cake","cookie","candy","pie","muffin","icecream","donut","pudding","chocolate","smoothie","cereal","popcorn","sausage","bacon","car","bus","train","plane","bike","scooter","truck","van","boat","ship","rocket","submarine","helicopter","taxi","tram","ball","bat","glove","kite","doll","puzzle","game","drum","guitar","piano","skateboard","rollerblade","frisbee","jumprope","tricycle","yo-yo","bowling","chess","soccer","basketball","hat","shirt","pants","dress","shoes","socks","boots","coat","jacket","scarf","cap","belt","mittens","sweater","shorts","skirt","tie","umbrella","chalk","board","ruler","backpack","binder","paperclip","scissors","pencilcase","textbook","highlighter","stapler","calculator","globe","folder","sharpener","notepad","compass","protractor","chalkboard","laptop","tablet","printer","scanner","library","museum","theater","restaurant","cafe","bakery","supermarket","market","store","hospital","police","firetruck","ambulance","postoffice","bank","park","zoo","aquarium","mall","fountain","statue","mirror","basket","box","ladder","bench","alarm","fan","comb","jar","keychain","cushion","pillow","blanket","towel","curtain","suitcase","wallet","postcard","letter","envelope","stamp","ticket","map","photo","sculpture","painting","sticker","poster","castle","kingdom","knight","dragon","wizard","potion","treasure","mystery","legend","fairy","ghost","tornado","hurricane","asteroid","nebula","orbit","eclipse","horizon","mosaic","labyrinth","riddle","enigma","carnival","festival","myth"];
  return words[Math.floor(Math.random() * words.length)];
}

function tallyVotes(roomName) {
  const votes = rooms[roomName].voting.votes;
  let voteCounts = {};
  for (const voter in votes) {
    const candidate = votes[voter];
    voteCounts[candidate] = (voteCounts[candidate] || 0) + 1;
  }
  
  // Determine candidate(s) with the highest votes
  let maxVotes = 0;
  let candidates = [];
  for (const candidate in voteCounts) {
    if (voteCounts[candidate] > maxVotes) {
      maxVotes = voteCounts[candidate];
      candidates = [candidate];
    } else if (voteCounts[candidate] === maxVotes) {
      candidates.push(candidate);
    }
  }
  
  // In case of a tie, pick randomly among the top candidates
  const accusedId = candidates[Math.floor(Math.random() * candidates.length)];
  const accusedName = rooms[roomName].players[accusedId] || 'Unknown';
  const imposterName = rooms[roomName].players[rooms[roomName].imposter] || 'Unknown';
  
  let resultMessage = `Voting is over! ${accusedName} got ${maxVotes} vote(s). `;
  let winningSide;
  if (accusedId === rooms[roomName].imposter) {
    resultMessage += "That person was the imposter. You win! ";
    winningSide = 'players';
  } else {
    resultMessage += "That person was not the imposter. The imposter wins! ";
    winningSide = 'imposter';
  }
  resultMessage += `The imposter was ${imposterName}.`;
  
  io.sockets.in(roomName).emit('votingResults', { 
    result: resultMessage, 
    voteDistribution: voteCounts,
    winningSide: winningSide,
    imposterName: imposterName
  });
  
  // End the voting phase
  rooms[roomName].voting.inProgress = false;
  console.log(`Voting ended in room ${roomName}. Results sent.`);
}

io.on('connection', socket => {
  console.log('New connection: ' + socket.id);

  // Player joining a room
  socket.on('joinRoom', (roomName, playerName) => {
    socket.join(roomName);
    if (!rooms[roomName]) {
      // Create a new room with the first player as host
      rooms[roomName] = {
        host: socket.id,
        players: {},
        gameStarted: false,
        word: null,
        imposter: null,
        voting: { inProgress: false, votes: {} }
      };
    }
    rooms[roomName].players[socket.id] = playerName;
    io.to(roomName).emit('updatePlayers', rooms[roomName].players, rooms[roomName].host);
  });

  // Host starts the game with random imposter selection using Fisher–Yates shuffle
  socket.on('startGame', (roomName) => {
    if (rooms[roomName] && socket.id === rooms[roomName].host && !rooms[roomName].gameStarted) {
      rooms[roomName].gameStarted = true;
      
      // Shuffle player IDs
      let playerIds = Object.keys(rooms[roomName].players);
      for (let i = playerIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [playerIds[i], playerIds[j]] = [playerIds[j], playerIds[i]];
      }
      
      // Select the first player in the shuffled array as the imposter
      const imposterId = playerIds[0];
      rooms[roomName].imposter = imposterId;
      
      // Choose a random word from the large list
      const word = getRandomWord();
      rooms[roomName].word = word;
      
      // Send role info to each player
      playerIds.forEach(id => {
        if (id === imposterId) {
          io.to(id).emit('gameStarted', { role: 'imposter' });
        } else {
          io.to(id).emit('gameStarted', { role: 'player', word: word });
        }
      });
      
      io.to(roomName).emit('message', 'Game started! Describe the word.');
      console.log(`Game started in room ${roomName}. Imposter is ${imposterId}`);
    }
  });

  // Host can end the game and reveal the imposter
  socket.on('endGame', (roomName) => {
    if (rooms[roomName] && socket.id === rooms[roomName].host) {
      const imposterName = rooms[roomName].players[rooms[roomName].imposter] || 'Unknown';
      let winningSide = (rooms[roomName].host === rooms[roomName].imposter) ? 'imposter' : 'players';
      io.to(roomName).emit('gameEnded', { 
        result: `The host ended the game.`, 
        winningSide: winningSide,
        imposterName: imposterName
      });
      rooms[roomName].gameStarted = false;
      rooms[roomName].word = null;
      rooms[roomName].imposter = null;
    }
  });

  // Start voting phase – only host can trigger when the game is active
  socket.on('startVoting', (roomName) => {
    if (rooms[roomName] && socket.id === rooms[roomName].host && rooms[roomName].gameStarted) {
      rooms[roomName].voting = { inProgress: true, votes: {} };
      io.sockets.in(roomName).emit('votingStarted', rooms[roomName].players);
      io.sockets.in(roomName).emit('message', 'Voting has started! Vote for the imposter.');
      console.log(`Voting started in room ${roomName}`);
    } else {
      console.log(`Voting not started: Either room ${roomName} does not exist, caller is not host, or game not started.`);
    }
  });

  // Player casts a vote (players can change vote until host ends voting)
  socket.on('castVote', (roomName, candidateId) => {
    if (rooms[roomName] && rooms[roomName].voting && rooms[roomName].voting.inProgress) {
      // Update (or set) the vote for this player
      rooms[roomName].voting.votes[socket.id] = candidateId;
      console.log(`Player ${socket.id} in room ${roomName} voted for ${candidateId}`);
      
      // Recalculate vote counts
      let voteCounts = {};
      for (let voter in rooms[roomName].voting.votes) {
        let candidate = rooms[roomName].voting.votes[voter];
        voteCounts[candidate] = (voteCounts[candidate] || 0) + 1;
      }
      // Broadcast updated vote counts
      io.sockets.in(roomName).emit('voteUpdate', voteCounts);
    }
  });

  // Host can end voting manually (if not everyone has voted)
  socket.on('endVoting', (roomName) => {
    if (rooms[roomName] && socket.id === rooms[roomName].host && rooms[roomName].voting && rooms[roomName].voting.inProgress) {
      tallyVotes(roomName);
    }
  });

  // Chat messaging during game
  socket.on('chatMessage', (roomName, msg) => {
    io.to(roomName).emit('chatMessage', { sender: rooms[roomName].players[socket.id], message: msg });
  });

  // Handle disconnects and update room players
  socket.on('disconnect', () => {
    console.log('Disconnect: ' + socket.id);
    for (const roomName in rooms) {
      if (rooms[roomName].players[socket.id]) {
        delete rooms[roomName].players[socket.id];
        if (rooms[roomName].host === socket.id) {
          const remaining = Object.keys(rooms[roomName].players);
          rooms[roomName].host = remaining[0] || null;
        }
        io.to(roomName).emit('updatePlayers', rooms[roomName].players, rooms[roomName].host);
        if (Object.keys(rooms[roomName].players).length === 0) {
          delete rooms[roomName];
        }
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
