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

var screenX = 1024;
var screenY = 768;

var timeout = 3.0; // Seconds to disconnect

var players = {};
var sockets = [];

var samplePlayer = {
	x : 50,
	y : 50,
	rot : 0,
	w : 64,
	moveSpeed : 300,
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
		if(player.x > screenX){ player.x = screenX; }
		if(player.x < 0){ player.x = 0; }
		if(player.y > screenY){ player.y = screenY; }
		if(player.y < 0){ player.y = 0; }

		// Apply rotation
		if(player.rotateR){
			player.rot -= player.rotateSpeed * deltaTime;
		}
		else if(player.rotateL){
			player.rot += player.rotateSpeed * deltaTime;
		}
	}

	lastFrame = new Date();
}
setInterval(gameLoop, 1000/144);

function addPlayer(socketID)
{
	// Construct new player
	var newPlayer = JSON.parse(JSON.stringify(samplePlayer));
	newPlayer.color = getRandomColor();
	newPlayer.heartbeat = new Date();
	// Random spawnpoint on screen
	newPlayer.x = Math.floor(Math.random() * screenX);
	newPlayer.y = Math.floor(Math.random() * screenY);

	players[socketID] = newPlayer;
	sockets.push(socketID);
}

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
setInterval(updatePlayers, 1000/144);

//////////////////////////////
// Event handling
//////////////////////////////

io.sockets.on('connection', function(socket){
	console.log("New connection")
	addPlayer(socket.id);

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

function getPolygon(player)
{
	var x0 = player.x - player.w/2;
	var x1 = player.x + player.w/2;
	var y0 = player.y - player.h/2;
	var y1 = player.y + player.h/2;
}
/**
 * Helper function to determine whether there is an intersection between the two polygons described
 * by the lists of vertices. Uses the Separating Axis Theorem
 *
 * @param a an array of connected points [{x:, y:}, {x:, y:},...] that form a closed polygon
 * @param b an array of connected points [{x:, y:}, {x:, y:},...] that form a closed polygon
 * @return true if there is any intersection between the 2 polygons, false otherwise
 */
function doPolygonsIntersect (a, b) {
    var polygons = [a, b];
    var minA, maxA, projected, i, i1, j, minB, maxB;

    for (i = 0; i < polygons.length; i++) {

        // for each polygon, look at each edge of the polygon, and determine if it separates
        // the two shapes
        var polygon = polygons[i];
        for (i1 = 0; i1 < polygon.length; i1++) {

            // grab 2 vertices to create an edge
            var i2 = (i1 + 1) % polygon.length;
            var p1 = polygon[i1];
            var p2 = polygon[i2];

            // find the line perpendicular to this edge
            var normal = { x: p2.y - p1.y, y: p1.x - p2.x };

            minA = maxA = undefined;
            // for each vertex in the first shape, project it onto the line perpendicular to the edge
            // and keep track of the min and max of these values
            for (j = 0; j < a.length; j++) {
                projected = normal.x * a[j].x + normal.y * a[j].y;
                if (isUndefined(minA) || projected < minA) {
                    minA = projected;
                }
                if (isUndefined(maxA) || projected > maxA) {
                    maxA = projected;
                }
            }

            // for each vertex in the second shape, project it onto the line perpendicular to the edge
            // and keep track of the min and max of these values
            minB = maxB = undefined;
            for (j = 0; j < b.length; j++) {
                projected = normal.x * b[j].x + normal.y * b[j].y;
                if (isUndefined(minB) || projected < minB) {
                    minB = projected;
                }
                if (isUndefined(maxB) || projected > maxB) {
                    maxB = projected;
                }
            }

            // if there is no overlap between the projects, the edge we are looking at separates the two
            // polygons, and we know there is no overlap
            if (maxA < minB || maxB < minA) {
                CONSOLE("polygons don't intersect!");
                return false;
            }
        }
    }
    return true;
};
