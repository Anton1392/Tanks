const express = require('express');
const app = express();
app.use(express.static("public"));

const server = require('http').createServer(app);
const io = require('socket.io')(server);

const path = require('path');

const SAT = require('sat');

//////////////////////////////
// Gamestate and logic
//////////////////////////////
var lastFrame;
var deltaTime;

var screenX = 1024;
var screenY = 768;

var timeout = 3.0; // Seconds to disconnect

var shotCooldown = 2.0;
var bulletDuration = 10.0; // Seconds for bullets to disappear

var players = {};

var sockets = [];

var gameObjects = [];
generateLevel();

var samplePlayer = {
	x : 50,
	y : 50,
	rot : 0,
	w : 64,
	moveSpeed : 300,
	rotateSpeed : 270,
	moveF : false,
	moveB : false,
	rotateR : false,
	rotateL : false,
	color : "#FFFFFF",
	heartbeat : null,
	lastShot : null,
	score : 0,
}

function gameLoop()
{
	deltaTime = (new Date() - lastFrame) / 1000;
	
	// Update all players
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
			console.log("1 player disconnected");
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

	// Update gameObjects
	for(var i = 0; i < gameObjects.length; i++){
		var obj = gameObjects[i];
		if(obj.type == "bullet"){
			var vec = rotateVector(obj.vel, 0, obj.rot);
			obj.x += vec[0] * deltaTime;
			obj.y += vec[1] * deltaTime;
			if((new Date() - obj.age)/1000 >= bulletDuration)
			{
				// Destroy old-man bullet
				gameObjects.splice(i, 1);
			}
		}
	}

	checkCollisions();

	lastFrame = new Date();
}
interval = setInterval(gameLoop, 1000/144);

function checkCollisions()
{
	// Between each player, and bullets, and obstacles.
	for(var key in players)
	{
		var p = players[key];
		var pBox = new SAT.Circle(new SAT.Vector(p.x, p.y), p.w/2);
		for(var j = 0; j < gameObjects.length; j++)
		{
			var obj = gameObjects[j];
			if(obj.type == "bullet")
			{
				var objBox = new SAT.Circle(new SAT.Vector(obj.x, obj.y), obj.w/2);
				var response = new SAT.Response();
				if(SAT.testCircleCircle(pBox, objBox, response))
				{
					/// Destroy player and respawn
					delete players[key];
					addPlayer(key, true, p.score);

					// Deduct score for dying, increase for killing.
					if(players[key].score > 0)
					{
						players[key].score--;
					}
					if(key != obj.owner)
					{
						players[obj.owner].score++;
					}
				}
			}
			else if(obj.type == "obstacle")
			{
				var objBox = new SAT.Box(new SAT.Vector(obj.x, obj.y), obj.w, obj.h).toPolygon();
				var response = new SAT.Response();
				if(SAT.testCirclePolygon(pBox, objBox, response))
				{
					p.x-=response.overlapV.x;
					p.y-=response.overlapV.y;
				}
			}
		}
	}

	// Check every bullet with every obstacle
	for(var i = 0; i < gameObjects.length; i++)
	{
		var bullet = gameObjects[i];
		if(bullet.type == "bullet")
		{
			var bBox = new SAT.Circle(new SAT.Vector(bullet.x, bullet.y), bullet.w/2);
			for(var j = 0; j < gameObjects.length; j++)
			{
				var obstacle = gameObjects[j];
				if(obstacle.type == "obstacle")
				{
					var oBox = new SAT.Box(new SAT.Vector(obstacle.x, obstacle.y), obstacle.w, obstacle.h).toPolygon();
					var response = new SAT.Response();
					if(SAT.testCirclePolygon(bBox, oBox, response))
					{
						// Colliding on x side
						if(response.overlapV.x != 0)
						{
							bullet.x-=response.overlapV.x;
							bullet.rot = (180-bullet.rot);
						}
						// Colliding on y side
						if(response.overlapV.y != 0)
						{
							bullet.y-=response.overlapV.y;
							bullet.rot = -bullet.rot;
						}
					}
				}
			}
		}
	}
}

function addPlayer(socketID, respawn, score = 0)
{
	// Construct new player
	var newPlayer = JSON.parse(JSON.stringify(samplePlayer));
	newPlayer.color = getRandomColor();
	newPlayer.heartbeat = new Date();
	newPlayer.score = score;
	// Random spawnpoint on screen
	var randX = 0;
	var randY = 0;
	while(randX < 10 || randX > screenX-10 || randY < 10 || randY > screenY-10)
	{
		randX = Math.floor(Math.random() * screenX);
		randY = Math.floor(Math.random() * screenY);
	}
	newPlayer.x = randX;
	newPlayer.y = randY;

	players[socketID] = newPlayer;
	if(!respawn)
	{
		sockets.push(socketID);
	}
}

function generateLevel()
{
	// 4 walls
	gameObjects.push({type: "obstacle", x: 0, y: 0, w: screenX, h: 3});
	gameObjects.push({type: "obstacle", x: 0, y: screenY-3, w: screenX, h: 3});
	gameObjects.push({type: "obstacle", x: 0, y: 0, w: 3, h: screenY});
	gameObjects.push({type: "obstacle", x: screenX-3, y: 0, w: 3, h: screenY});

	// 30 Random rectangles, height and width within 100x100
	for(var i = 0; i < 30; i++)
	{
		var randX = Math.floor(Math.random() * screenX);
		var randY = Math.floor(Math.random() * screenY);
		var randW = Math.floor(Math.random() * 100);
		var randH = Math.floor(Math.random() * 100);
		gameObjects.push({type: "obstacle", x: randX, y: randY, w: randW, h: randH});
	}
}

//////////////////////////////
// Communication
//////////////////////////////
app.get('/', function(req, res)	{
	res.sendFile(path.join(__dirname, '/public/index.html'));
});

function updateInfo()
{
	io.sockets.emit("updatePlayers", players);
	io.sockets.emit("updateGameObjects", gameObjects);
}
setInterval(updateInfo, 1000/144);

//////////////////////////////
// Event handling
//////////////////////////////

io.sockets.on('connection', function(socket){
	console.log("New connection")
	addPlayer(socket.id, false);

	socket.on('getData', function(data){
		var player = players[socket.id]
		player.moveF = data.moveF;
		player.moveB = data.moveB;
		player.rotateR = data.rotateR;
		player.rotateL = data.rotateL;
		player.heartbeat = new Date();
	});

	socket.on('shoot', function(data){
		var player = players[socket.id];
		if(player.lastShot == null || (new Date() - player.lastShot)/1000 >= shotCooldown)
		{
			player.lastShot = new Date();
			var bulletPos = rotateVector(50, 0, player.rot);
			gameObjects.push({type: "bullet", x: player.x+bulletPos[0], y: player.y+bulletPos[1], w: 20, rot : player.rot, vel: 400, age : new Date(), owner : socket.id});
		}
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

function getPolygon(player)
{
	var x0 = player.x - player.w/2;
	var x1 = player.x + player.w/2;
	var y0 = player.y - player.h/2;
	var y1 = player.y + player.h/2;
}
