const express = require('express');
const app = express();
app.use(express.static("public"));

const server = require('http').createServer(app);
const io = require('socket.io')(server);

const path = require('path');

//////////////////////////////
// Gamestate and logic
//////////////////////////////
var lastFrame;
var deltaTime;

var timeout = 5.0; // Seconds to disconnect

var players = {};
var sockets = [];

var samplePlayer = {
	x : 50,
	y : 50,
	rot : 0,
	w : 80,
	h : 50,
	moveSpeed : 200,
	rotateSpeed : 180,
	moveF : false,
	moveB : false,
	rotateR : false,
	rotateL : false,
	color : "#FFFFFF",
	heartbeat : null
}

function gameLoop()
{
	deltaTime = (new Date() - lastFrame) / 1000;

	for(var i = 0; i < sockets.length; i++)
	{
		var socket = sockets[i];
		var player = players[socket];

		// Check for disconnects
		if((new Date() - player.heartbeat)/1000 > timeout)
		{
			// Disconnect
			sockets.splice(i, 1);
			delete players[socket];
			continue;
		}
		
		// Apply forward/backward movement
		if(player.moveF){
			var movement = rotateVector(player.moveSpeed, 0, player.rot);
			player.x += movement[0] * deltaTime;
			player.y += movement[1] * deltaTime;
		}
		else if(player.moveB){
			var movement = rotateVector(-player.moveSpeed, 0, player.rot);
			player.x += movement[0] * deltaTime;
			player.y += movement[1] * deltaTime;
		}

		// Apply rotation
		if(player.rotateR){
			player.rot -= player.rotateSpeed * deltaTime;
		}
		else if(player.rotateL){
			player.rot += player.rotateSpeed * deltaTime;
		}
	}

	updatePlayers();
	lastFrame = new Date();
}
setInterval(gameLoop, 1000/144);

//////////////////////////////
// Communication
//////////////////////////////
app.get('/', function(req, res)	{
	res.sendFile(path.join(__dirname, '/public/index.html'));
});

function updatePlayers()
{
	io.sockets.emit("updatePlayers", players);
}

//////////////////////////////
// Event handling
//////////////////////////////

io.sockets.on('connection', function(socket){
	console.log("New connection")

	// Construct new player
	var newPlayer = JSON.parse(JSON.stringify(samplePlayer));
	newPlayer.color = getRandomColor();
	newPlayer.heartbeat = new Date();

	players[socket.id] = newPlayer;
	sockets.push(socket.id);
	console.log("added player with id: " + socket.id);

	socket.on('getData', function(data){
		var player = players[socket.id]
		player.moveF = data.moveF;
		player.moveB = data.moveB;
		player.rotateR = data.rotateR;
		player.rotateL = data.rotateL;
		player.heartbeat = new Date();
	});
});

server.listen(3000, function(){
	console.log('Listening on port 3000');
});

//////////////////////////////
// Helper functions
//////////////////////////////
function getRandomColor() {
  var letters = '0123456789ABCDEF';
  var color = '#';
  for (var i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

function rotateVector(x, y, ang)
{
	// Magic to rotate a vector.
	ang = -ang * (Math.PI/180);
	var cos = Math.cos(ang);
	var sin = Math.sin(ang);
	return new Array(Math.round(10000*(x * cos - y * sin))/10000, Math.round(10000*(x * sin + y * cos))/10000);
}
