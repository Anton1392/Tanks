var socket = io.connect();

var players = {};

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
		pop();
	}
}
