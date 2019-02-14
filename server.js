var express  = require("express");
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var request = require('request');
var PolyBool = require('polybooljs');

var port;
if(process.env.PORT) {
	port = process.env.PORT;
} else {
	port = 3000;
}

http.listen(port, function(){
	console.log('listening on port ' + port);
});

app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
});

app.use("/textures", express.static(__dirname + '/textures'));
app.use("/css", express.static(__dirname + '/css'));
app.use("/js", express.static(__dirname + '/js'));

var players = {};
var colorList = [
	['#f44336', '#d32f2f'],
	['#e91e63', '#c2185b'],
	['#9c27b0', '#7b1fa2'],
	['#673ab7', '#512da8'],
	['#3f51b5', '#303f9f'],
	['#2196f3', '#1976d2'],
	['#00bcd4', '#0097a7'],
	['#009688', '#00796b'],
	['#4caf50', '#388e3c'],
	['#8bc34a', '#689f38'],
	['#cddc39', '#afb42b'],
	['#ffeb3b', '#fbc02d'],
	['#ffc107', '#ffa000'],
	['#ff9800', '#f57c00'],
	['#ff5722', '#e64a19'],
	['#795548', '#5d4037'],
	['#9e9e9e', '#616161']
];

io.on('connection', function (socket) {
	socket.on('login', function() {
		var diff = randomInteger(-2,2);
		players[socket.id] = {
			id: socket.id,
			position: {
				x: 0 + diff*5,
				y: 0
			},
			mouse: {
				x: 0,
				y: 0
			},
			polygons: [],
			inPolygon: true,
			startIn: 0,
			path: [],
			colors: colorList[randomInteger(0,colorList.length-1)],
			newPlayer: true
		};
		players[socket.id].polygons[0] = [];
		players[socket.id].polygons[1] = [];

		for (var i = 0; i < 30; i++) {
			var x = 4 * Math.cos(2 * Math.PI / 30 * i) + diff*5;
			var y = 4 * Math.sin(2 * Math.PI / 30 * i);
			players[socket.id].polygons[0].push([x, y]);
		}
		io.to(socket.id).emit('login', socket.id);
	});
	socket.on('disconnect', function() {
		delete players[socket.id];
	});
	socket.on('mouse', function(mouse) {
		if(players[socket.id]) {
			players[socket.id].mouse = mouse;
		}
	});
});

var nn = 0;
setInterval(function () {
	nn++;
	var time = process.hrtime();
	var changedPolygons = [];
	for(var socketId in players) {
		var mouse = players[socketId].mouse;
		players[socketId].position.x -= mouse.y*0.5;
		players[socketId].position.y -= mouse.x*0.5;
		if(players[socketId].position.x > 80) players[socketId].position.x = 80;
		if(players[socketId].position.x < -80) players[socketId].position.x = -80;
		if(players[socketId].position.y > 80) players[socketId].position.y = 80;
		if(players[socketId].position.y < -80) players[socketId].position.y = -80;

		var polygons = players[socketId].polygons;
		var position = players[socketId].position;

		var current = false;
		var currentId = null;

		for(var p = 0; p<polygons.length; p++) {
			if(inside([position.x, position.y], polygons[p])) {
				current = true;
				currentId = p;
			}
		}

		if(!players[socketId].inPolygon && nn%2===1) {
			players[socketId].path.push([{x: position.x, y: position.y}, players[socketId].mouse]);
			var lastPoint1 = players[socketId].path[players[socketId].path.length-1][0];
			var lastPoint2 = players[socketId].path[players[socketId].path.length-2][0];
			for(var i=0; i<players[socketId].path.length-3; i++) {
				var point1 = players[socketId].path[i][0];
				var point2 = players[socketId].path[i+1][0];
				var intersection = segmentIntersection(lastPoint1.x, lastPoint1.y, lastPoint2.x, lastPoint2.y, point1.x+randomFloat(-0.001,0.001), point1.y+randomFloat(-0.001,0.001), point2.x+randomFloat(-0.001,0.001), point2.y+randomFloat(-0.001,0.001));
				if(intersection) {
					delete players[socketId];
					break;
				}
			}
		}

		if(players[socketId]) {
			if(players[socketId].inPolygon && !current) {
				players[socketId].inPolygon = false;
				players[socketId].path.push([{x: position.x, y: position.y}, players[socketId].mouse]);
			} else if(!players[socketId].inPolygon && current && (currentId === players[socketId].startIn)) {
				players[socketId].startIn = currentId;
				players[socketId].inPolygon = true;

				var nearest1 = {
					distance: Infinity,
					id: null,
					polygonId: null
				};
				var nearest2 = {
					distance: Infinity,
					id: null,
					polygonId: null
				};

				for(var p = 0; p<polygons.length; p++) {
					var polygon = polygons[p];

					for(var i = 0; i<polygon.length; i++) {
						var d = distance([players[socketId].path[0][0].x, players[socketId].path[0][0].y], polygon[i]);
						if(d < nearest1.distance) {
							nearest1.distance = d;
							nearest1.id = i;
							nearest1.polygonId = p;
						}
					}

					for(var i = 0; i<polygon.length; i++) {
						var d = distance([players[socketId].path[players[socketId].path.length-1][0].x, players[socketId].path[players[socketId].path.length-1][0].y], polygon[i]);
						if(d < nearest2.distance) {
							nearest2.distance = d;
							nearest2.id = i;
							nearest2.polygonId = p;
						}
					}
				}

				players[socketId].path[0][0] = {
					x: polygons[nearest1.polygonId][nearest1.id][0],
					y: polygons[nearest1.polygonId][nearest1.id][1]
				};

				players[socketId].path[players[socketId].path.length-1][0] = {
					x: polygons[nearest2.polygonId][nearest2.id][0],
					y: polygons[nearest2.polygonId][nearest2.id][1]
				};

				var shape = [];

				for(var i = 0; i<players[socketId].path.length; i++) {
					shape.push([players[socketId].path[i][0].x+randomFloat(-0.001,0.001), players[socketId].path[i][0].y+randomFloat(-0.001,0.001)]);
				}

				var c = nearest2.id;
				var f = nearest1.id;
				while (c !== f) {
					if(c !== nearest1.id && c !== nearest2.id) {
						shape.push(polygons[currentId][c]);
					}
					c++;
					if(c===polygons[currentId].length) c = 0;
				}

				var poly = PolyBool.union({
					regions: polygons,
					inverted: false
				}, {
					regions: [shape],
					inverted: false
				});
				players[socketId].polygons = poly.regions;

				for(var socketId2 in players) {
					if(socketId !== socketId2) {
						poly = PolyBool.difference({
							regions: players[socketId2].polygons,
							inverted: false
						}, {
							regions: players[socketId].polygons,
							inverted: false
						});
						players[socketId2].polygons = poly.regions;

						if(poly.regions.length === 0) {
							console.log(poly.regions);
							delete players[socketId2];
						}
					}
				}

				changedPolygons.push(socketId);

				players[socketId].path = [];
			}
		}
	}
	for(var socketId in players) {
		io.to(socketId).emit('players', players);
		if(players[socketId].newPlayer) {
			changedPolygons.push(socketId);
			players[socketId].newPlayer = false;
		}
	}
	for(var i=0; i<changedPolygons.length; i++) {
		for(var socketId in players) {
			io.to(socketId).emit('updateMesh', socketId);
		}
	}
	var time2 = process.hrtime(time);
	//console.log((time2[0] * 1e9 + time2[1])/1000000)
}, 50);

function inside(point, vs) {
	var x = point[0], y = point[1];
	var inside = false;
	for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
		var xi = vs[i][0], yi = vs[i][1];
		var xj = vs[j][0], yj = vs[j][1];

		var intersect = ((yi > y) != (yj > y))
			&& (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
		if (intersect) inside = !inside;
	}
	return inside;
};

function distance(p1,p2){
	var dx = p2[0]-p1[0];
	var dy = p2[1]-p1[1];
	return Math.sqrt(dx*dx + dy*dy);
}

function between(a, b, c) {
	var eps = 0.0000001;
	return a-eps <= b && b <= c+eps;
}
function segmentIntersection(x1,y1,x2,y2, x3,y3,x4,y4) {
	var x=((x1*y2-y1*x2)*(x3-x4)-(x1-x2)*(x3*y4-y3*x4)) /
		((x1-x2)*(y3-y4)-(y1-y2)*(x3-x4));
	var y=((x1*y2-y1*x2)*(y3-y4)-(y1-y2)*(x3*y4-y3*x4)) /
		((x1-x2)*(y3-y4)-(y1-y2)*(x3-x4));
	if (isNaN(x)||isNaN(y)) {
		return false;
	} else {
		if (x1>=x2) {
			if (!between(x2, x, x1)) {return false;}
		} else {
			if (!between(x1, x, x2)) {return false;}
		}
		if (y1>=y2) {
			if (!between(y2, y, y1)) {return false;}
		} else {
			if (!between(y1, y, y2)) {return false;}
		}
		if (x3>=x4) {
			if (!between(x4, x, x3)) {return false;}
		} else {
			if (!between(x3, x, x4)) {return false;}
		}
		if (y3>=y4) {
			if (!between(y4, y, y3)) {return false;}
		} else {
			if (!between(y3, y, y4)) {return false;}
		}
	}
	return {x: x, y: y};
}

function randomInteger(min, max) {
	var rand = min - 0.5 + Math.random() * (max - min + 1);
	rand = Math.round(rand);
	return rand;
}

function randomFloat(min, max) {
	return Math.random() * (max - min) + min;
}
