var socket = io();

var camera, scene, renderer;
var mouse = new THREE.Vector2(0,0);
var usesTouch = false;
var touchOrigin = new THREE.Vector2(0,0);
var clock = new THREE.Clock();

var players = {};
var stats = new Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);
var rendererStats = new THREEx.RendererStats();
rendererStats.domElement.style.position	= 'absolute';
rendererStats.domElement.style.left	= '0px';
rendererStats.domElement.style.bottom	= '0px';
rendererStats.domElement.style.zIndex	= '5';
document.body.appendChild( rendererStats.domElement );

var clientId;

socket.emit('login');

socket.on('login', function (id) {
	clientId = id;
	init();
	animate();
});

function init() {
	renderer = new THREE.WebGLRenderer( { antialias: true } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	//renderer.shadowMap.enabled = true;
	//renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	document.body.appendChild( renderer.domElement );
	scene = new THREE.Scene();
	scene.background = new THREE.Color(0xffffff);
	camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 1000);
	camera.position.z = 40;

	var dirLight = new THREE.DirectionalLight(0xFFFFFF, 0.7);
	dirLight.position.set(0.5, 1, 0.5);
	scene.add(dirLight);
	dirLight.castShadow = true;
	var ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.8);
	scene.add(ambientLight);

	var texture = new THREE.TextureLoader().load("textures/floor.png");
	texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
	texture.repeat.set(50, 50);
	var geometry = new THREE.PlaneGeometry(160, 160);
	var material = new THREE.MeshBasicMaterial({color: 0xffffff, map: texture});
	var plane = new THREE.Mesh(geometry, material);
	plane.rotation.x += toRad(-90);
	scene.add(plane);
	plane.receiveShadow = true;

	window.addEventListener('resize', function(){
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(window.innerWidth, window.innerHeight);
	}, false);

	window.addEventListener('mousemove', function(event){
		if(!usesTouch) {
			mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
			mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
			mouse.normalize();
			socket.emit('mouse', {x: mouse.x, y: mouse.y});
		}
	}, false);

	window.addEventListener("touchstart", function (event) {
		usesTouch = true;
		touchOrigin.x = event.touches[0].clientX;
		touchOrigin.y = event.touches[0].clientY;
	}, false);
	window.addEventListener("touchend", function () {

	}, false);
	window.addEventListener("touchcancel", function () {

	}, false);
	window.addEventListener("touchmove", function () {
		mouse.x = event.touches[0].clientX - touchOrigin.x;
		mouse.y = -(event.touches[0].clientY - touchOrigin.y);
		mouse.normalize();
		socket.emit('mouse', {x: mouse.x, y: mouse.y});
	}, false);

	socket.on('players', function (data) {
		for(var socketId in players) {
			if(!data[socketId]) {
				console.log(socketId+' exited');
				scene.remove(players[socketId].mesh);
				scene.remove(players[socketId].polygonMesh[0]);
				scene.remove(players[socketId].polygonMesh[1]);
				scene.remove(players[socketId].pathMesh[0]);
				players[socketId].mesh.geometry.dispose();
				players[socketId].polygonMesh[0].geometry.dispose();
				players[socketId].polygonMesh[1].geometry.dispose();
				players[socketId].pathMesh[0].geometry.dispose();
				players[socketId].pathMesh[1].geometry.dispose();
				players[socketId].mesh.material.dispose();
				players[socketId].polygonMesh[0].material.dispose();
				players[socketId].polygonMesh[1].material.dispose();
				players[socketId].pathMesh[0].material.dispose();
				players[socketId].pathMesh[1].material.dispose();
				delete players[socketId];
			}
		}
		for(var socketId in data) {
			if(players[socketId]) {
				players[socketId].position = data[socketId].position;
				players[socketId].mouse = data[socketId].mouse;
				players[socketId].polygons = data[socketId].polygons;
				players[socketId].path = data[socketId].path;

			} else {
				players[socketId] = {};
				players[socketId].position = data[socketId].position;
				players[socketId].colors = data[socketId].colors;
				players[socketId].mouse = data[socketId].mouse;
				players[socketId].mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshPhongMaterial({color: players[socketId].colors[0]}));
				players[socketId].mesh.position.set(players[socketId].position.x, 0.5, players[socketId].position.y);
				players[socketId].mesh.rotation.y = Math.atan2(-players[socketId].mouse.y, -players[socketId].mouse.x);
				scene.add(players[socketId].mesh);
				players[socketId].polygonMesh = [
					new THREE.Mesh(new THREE.Geometry(), new THREE.MeshBasicMaterial({color: players[socketId].colors[0]})),
					new THREE.Mesh(new THREE.Geometry(), new THREE.MeshBasicMaterial({color: players[socketId].colors[1]}))
				];
				scene.add(players[socketId].polygonMesh[0]);
				scene.add(players[socketId].polygonMesh[1]);
				players[socketId].polygonMesh[0].position.y = 0.5;
				players[socketId].polygonMesh[1].position.y = 0.02;
				players[socketId].polygons = data[socketId].polygons;
				players[socketId].pathMesh = [
					new THREE.Mesh(new THREE.Geometry(), new THREE.MeshBasicMaterial({color: players[socketId].colors[1]})),
					new THREE.Mesh(new THREE.Geometry(), new THREE.MeshBasicMaterial({color: players[socketId].colors[1]})),
					null
				];
				scene.add(players[socketId].pathMesh[0]);
				scene.add(players[socketId].pathMesh[1]);
				players[socketId].path = data[socketId].path;

				var pathMesh = players[socketId].pathMesh;
				pathMesh[1].visible = false;
				var n = 16;
				var radius = 0.5;
				for (var i = 0; i < n+1; i++) {
					if(i === 0) {
						pathMesh[1].geometry.vertices.push(new THREE.Vector3(0, 0.1, 0));
					}
					var x = radius * Math.cos(2 * Math.PI / n * i);
					var y = radius * Math.sin(2 * Math.PI / n * i);
					pathMesh[1].geometry.vertices.push(new THREE.Vector3(x, 0.1, y));
					if(i>0) {
						pathMesh[1].geometry.faces.push(new THREE.Face3(i, 0, i+1));
					}
				}
			}

			if(players[socketId].path.length > -1) {
				var path = players[socketId].path;
				var pathMesh = players[socketId].pathMesh;
				pathMesh[0].geometry.vertices.length = 0;
				pathMesh[0].geometry.faces.length = 0;
				if(path.length > 1) {
					for(var i = 0; i<path.length; i++) {
						var mv = new THREE.Vector2(path[i][1].x, path[i][1].y).normalize();
						var pos = [mv.x/2, -mv.y/2];
						var angle1 = 0;
						var angle2 = -180;
						var v1 = [pos[0]*Math.cos(toRad(angle1)) - pos[1]*Math.sin(toRad(angle1)) + path[i][0].x, pos[0]*Math.sin(toRad(angle1)) + pos[1]*Math.cos(toRad(angle1)) + path[i][0].y];
						var v2 = [pos[0]*Math.cos(toRad(angle2)) - pos[1]*Math.sin(toRad(angle2)) + path[i][0].x, pos[0]*Math.sin(toRad(angle2)) + pos[1]*Math.cos(toRad(angle2)) + path[i][0].y];

						pathMesh[0].geometry.vertices.push(new THREE.Vector3(v1[0], 0.1, v1[1]));
						pathMesh[0].geometry.vertices.push(new THREE.Vector3(v2[0], 0.1, v2[1]));
						if(i > 0) {
							pathMesh[0].geometry.faces.push(new THREE.Face3((i-1)*2, 3+((i-1)*2), 1+((i-1)*2)));
							pathMesh[0].geometry.faces.push(new THREE.Face3((i-1)*2, 2+((i-1)*2), 3+((i-1)*2)));
						}
					}
					pathMesh[1].visible = true;
					pathMesh[1].position.x = path[0][0].x;
					pathMesh[1].position.z = path[0][0].y;
				} else {
					pathMesh[1].visible = false;
				}

				pathMesh[0].updateMatrix();
				pathMesh[0].geometry.verticesNeedUpdate = true;
				pathMesh[0].geometry.elementsNeedUpdate = true;
				pathMesh[0].geometry.morphTargetsNeedUpdate = true;
				pathMesh[0].geometry.uvsNeedUpdate = true;
				pathMesh[0].geometry.normalsNeedUpdate = true;
				pathMesh[0].geometry.colorsNeedUpdate = true;
				pathMesh[0].geometry.tangentsNeedUpdate = true;
				pathMesh[0].geometry.computeBoundingBox();
				pathMesh[0].geometry.computeBoundingSphere();
			}
		}
	});
	socket.on('updateMesh', function (data) {
		for(var socketId in players) {
			if(players[socketId].polygons) {
				var polygons = players[socketId].polygons;
				var mesh1 = players[socketId].polygonMesh[0];
				var mesh2 = players[socketId].polygonMesh[1];
				mesh1.geometry.vertices.length = 0;
				mesh1.geometry.faces.length = 0;
				for(var p = 0; p<polygons.length; p++) {
					var newV = mesh1.geometry.vertices.length;
					var polygon = polygons[p];
					var array1d = gen1dArray(polygon);
					for(var i = 0; i<polygon.length; i++) {
						mesh1.geometry.vertices.push(new THREE.Vector3(polygon[i][0], 0, polygon[i][1]));
					}
					var triangles = earcut(array1d);
					for(i = 0; i < triangles.length/3; i++ ){
						mesh1.geometry.faces.push(new THREE.Face3(triangles[i*3+2] + newV, triangles[i*3+1] + newV, triangles[i*3] +newV));
					}
				}
				mesh1.updateMatrix();
				mesh1.geometry.verticesNeedUpdate = true;
				mesh1.geometry.elementsNeedUpdate = true;
				mesh1.geometry.morphTargetsNeedUpdate = true;
				mesh1.geometry.uvsNeedUpdate = true;
				mesh1.geometry.normalsNeedUpdate = true;
				mesh1.geometry.colorsNeedUpdate = true;
				mesh1.geometry.tangentsNeedUpdate = true;
				mesh1.geometry.computeBoundingBox();
				mesh1.geometry.computeBoundingSphere();

				mesh2.geometry.vertices.length = 0;
				mesh2.geometry.faces.length = 0;
				for(var p = 0; p<polygons.length; p++) {
					var newV = mesh2.geometry.vertices.length;
					var polygon = polygons[p];
					var array1d = gen1dArray(polygon);
					for(var i = 0; i<polygon.length; i++) {
						mesh2.geometry.vertices.push(new THREE.Vector3(polygon[i][0], 0, polygon[i][1]));
					}
					var triangles = earcut(array1d);
					for(i = 0; i < triangles.length/3; i++ ){
						mesh2.geometry.faces.push(new THREE.Face3(triangles[i*3+2] + newV, triangles[i*3+1] + newV, triangles[i*3] +newV));
					}
				}
				mesh2.updateMatrix();
				mesh2.geometry.verticesNeedUpdate = true;
				mesh2.geometry.elementsNeedUpdate = true;
				mesh2.geometry.morphTargetsNeedUpdate = true;
				mesh2.geometry.uvsNeedUpdate = true;
				mesh2.geometry.normalsNeedUpdate = true;
				mesh2.geometry.colorsNeedUpdate = true;
				mesh2.geometry.tangentsNeedUpdate = true;
				mesh2.geometry.computeBoundingBox();
				mesh2.geometry.computeBoundingSphere();
			}
		}
	});
}

var delta;
function animate() {
	requestAnimationFrame(animate);
	stats.begin();
	delta = clock.getDelta();

	var lerpVal = 0.35;
	for(var socketId in players) {
		players[socketId].mesh.position.set(lerp(players[socketId].mesh.position.x, players[socketId].position.x, lerpVal), 0.5, lerp(players[socketId].mesh.position.z, players[socketId].position.y, lerpVal));
		var newAngle = Math.atan2(-players[socketId].mouse.y, -players[socketId].mouse.x);
		players[socketId].mesh.rotation.y = angleLerp(players[socketId].mesh.rotation.y, newAngle, 0.5);
	}

	if(players[clientId]) {
		//players[clientId].position.x += 0.05;
		var mesh = players[clientId].mesh;
		camera.position.set(20 + mesh.position.x, 40, 0 + mesh.position.z);
		camera.lookAt(new THREE.Vector3(mesh.position.x,mesh.position.y,mesh.position.z));
	}

	renderer.render(scene, camera);
	stats.end();

	rendererStats.update(renderer);
}


function toRad(degrees) {
	return degrees * Math.PI / 180;
}

function toDeg(radians) {
	return radians * 180 / Math.PI;
}

function randomFloat(min, max) {
	return Math.random() * (max - min) + min;
}

function gen1dArray(arr) {
	var res = [];
	for( var i = 0; i < arr.length; i++ ){
		for( var j = 0; j < arr[i].length; j++ ){
			res.push(arr[i][j]);
		}
	}
	return res;
}

function lerp(a, b, t) {
	return a + t * (b - a);
	//return b;
}

function angleLerp(a0,a1,t) {
	return a0 + shortAngleDist(a0,a1)*t;
}

function shortAngleDist(a0,a1) {
	var max = Math.PI*2;
	var da = (a1 - a0) % max;
	return 2*da % max - da;
}