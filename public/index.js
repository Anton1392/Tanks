var socket = io.connect();

var players = {};
var gameObjects = [];

var moveB = false;
var moveF = false;
var rotateR = false;
var rotateL = false;

// Input handling
document.addEventListener("keydown", function(e){
	switch(e.keyCode){
		case 83: // S
			moveB = true;
			break;
		case 87: // W
			moveF = true;
			break;
		case 68: // D
			rotateR = true;
			break;
		case 65: // A
			rotateL = true;
			break;
		case 32: // A
			socket.emit('shoot', "");
			break;
	}
});

document.addEventListener("keyup", function(e){
	switch(e.keyCode){
		case 83: // S
			moveB = false;
			break;
		case 87: // W
			moveF = false;
			break;
		case 68: // D
			rotateR = false;
			break;
		case 65: // A
			rotateL = false;
			break;
	}
});

socket.on('updatePlayers', function(data){
	players = data;

	document.getElementsByTagName("body")[0].style.backgroundColor = players[socket.id].color;
});

socket.on('updateGameObjects', function(data){
	gameObjects = data;
});

function sendData(){
	var data = {moveB: moveB, moveF: moveF, rotateR: rotateR, rotateL: rotateL};

	socket.emit('getData', data);
}
setInterval(sendData, 1000/60); // 144hz input rate

function setup(){
	createCanvas(1024, 768);
}

function draw(){
	clear();
	background("#FFFFFF");

	// Render players
	document.getElementById("scores").innerHTML = "";
	for(var key in players)
	{
		push();
		var player = players[key];
		rectMode(CENTER);
		fill(player.color);
		strokeWeight(2);
		translate(player.x, player.y);
		rotate(radians(-player.rot));
		rect(10, 0, player.w, 20);
		ellipse(0, 0, player.w);

		var scores = document.getElementById("scores");
		var colorBox = document.createElement("div");
		colorBox.className = "colorBox";
		colorBox.style.backgroundColor = player.color;
		colorBox.innerHTML = player.score;
		scores.appendChild(colorBox);

		pop();
	}

	// Render gameobjects
	for(var i = 0; i < gameObjects.length; i++)
	{
		var obj = gameObjects[i];
		push();
		strokeWeight(2);
		translate(obj.x, obj.y);
		if(obj.type == "bullet")
		{
			fill(200);
			ellipse(0, 0, obj.w);
		}
		else if(obj.type == "obstacle")
		{
			rectMode(CORNER);
			fill("#000000");
			rect(0,0,obj.w, obj.h);
		}
		pop();
	}
}
