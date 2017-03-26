var port = 80;
var express = require('express'),
    app = express(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server);
app.use('/', express.static(__dirname + '/www'));
server.listen(port);
// var Stately = require('stately.js');
console.log("Listening on port " + port);


var target_population = 4;
var population = 0;
var day = 0;
// identity pool for 12 players
var identity_pool_12 = ['werewolf', 'werewolf', 'werewolf', 'werewolf', 
						'seer', 'hunter', 'witch', 'guardian', 
						'villager', 'villager', 'villager', 'villager'];
// identity pool for 9 players
var identity_pool_9 = ['werewolf', 'werewolf', 'werewolf',
					   'seer', 'hunter', 'witch',
					   'villager', 'villager', 'villager'];
var identity_pool_test = ['werewolf', 'guardian', 'witch', 'seer'];
var liveList = [0, 1, 2, 3];
var wolf_target_list = [];
var wolf_target = -1;
var witch_choice = 0;
var witch_poison = 1;
var witch_cure = 1;
var witch_target = -1;
var guardian_target = -1;
var guardian_last_target = -1;
var hunter_state = 1;

var police = -1;
var police_target = -1;

var vote_list = []
var vote_target = -1;
var death_list = []
// to store the socket of each player
var sockets = [];
var server = null;
var server_validated = 0;

// in order to fast trace each identity
var identity_dict = new Array();

var identities = [];
// select the pool and shuffle it
function shuffle(array) {
	var shuffle = require('shuffle-array'),
		identities = array;
	shuffle(identities);
	return identities;
}

function mode(array) {
    if(array.length == 0) return null;
    var modeMap = {};
    var maxEl = -1, maxCount = 0;
    if(police != -1) {
    	modeMap[police_target] = 0.5;
    }
    for(var i = 0; i < array.length; i++) {
        var el = array[i];
    	if(el == -1) continue;
        if(modeMap[el] == null)
            modeMap[el] = 1;
        else
            modeMap[el]++;  
        if(modeMap[el] > maxCount) {
            maxEl = el;
            maxCount = modeMap[el];
        }
    }
    var res = [];
    res.push(maxEl);
    for(var key in modeMap) {
    	if(key != maxEl && modeMap[key] == maxCount) {
    		res.push(key);
    	}
    }
    return res;
}

function contains(array, object) {
	for(var i = 0, len = array.length; i < len; ++i) {
		if(array[i] == object) return true;
	}
	return false;
}

function removeByValue(arr, val) {
	for(var i=0; i<arr.length; i++) {
		if(arr[i] == val) {
			arr.splice(i, 1);
			break;
		}
	}
}

function removeUselessListeners(state, listeners) {
	console.log("Removing listeners in " + state);
	for(var i = 0; i < identity_dict[state].length; ++i) {
		for(var listener in listeners) {
			sockets[identity_dict[state]].removeAllListeners(listener);
		}
	}
}

function sleep(numberMillis) { 
	var now = new Date().getTime(); 
	var exitTime = now + numberMillis; 
	while (true) { 
		now = new Date().getTime(); 
		if (now > exitTime) 
			return; 
	} 
}

// *******************************
// THIS PART IS SIMILLAR TO A FSM
// *******************************

function Welcome() {
	console.log("=====Welcome=====");
	console.log(identities);
	// wait until the population reaches the target number, then game start
	io.on('connection', function (socket) {
		if(server == null) {
			console.log("One server might be online...");
			server = socket;
			server.emit("connected");
			server.on("validation", function(data) {
				if(data.choise == "YES") {
					server_validated = 1;
					console.log("server online");
					server.emit("autherized");
				} else {
					server_validated = 0;
				}
			});
			server.on("gamesettings", function(data) {
				target_population = data.message[0];
				for(var i = 0; i < data.message[1]; ++i) {
					identities.push("werewolf");
				}
				var tmp_cnt = 0;
				for(var i = 0; i < data.message[2].length; ++i) {
					if(data.message[2][i]) {
						tmp_cnt += 1;
						switch(i) {
							case 0:
								identities.push("witch");
							break;
							case 1:
								identities.push("seer");
							break;
							case 2:
								identities.push("guardian");
							break;
							case 3:
								identities.push("hunter");
							break;
						}
					}
				}
				for(var i = 0; i < target_population - data.message[1] - tmp_cnt; ++i) {
					identities.push("villager");
				}
				identities = shuffle(identities);
				console.log(identities);
			});
		} else if(server_validated == 1) {
			console.log('One player connects to the server...');
			sockets.push(socket);
			population += 1;
			socket.emit("message", {message: identities[population - 1]});
			if(identity_dict.hasOwnProperty(identities[population - 1])) {
				identity_dict[identities[population - 1]].push(population - 1);
			} else {
				var tmp_array = [population - 1];
				identity_dict[identities[population - 1]] = tmp_array;
			}
			if(population == target_population) {
				server.emit("identities", {message: identities});
				return NightWolf();
			}
		}
	});
}

function NightWolf() {
	console.log("=====Werewolf=====");
	day += 1;
	console.log(identity_dict);
	console.log(liveList);
	server.emit("NightComeAudio");
	wolf_target_list = [];
	var self = this;
	var live_flag = 0;
	for(var i = 0, len = identity_dict['werewolf'].length; i < len; ++i) {
		if(contains(liveList, identity_dict['werewolf'][i]) == false) continue;
		live_flag = 1;
		var sock = sockets[identity_dict['werewolf'][i]];
		sock.emit("command", {command: liveList});
		sock.once("kill", function (data) {
			wolf_target_list.push(parseInt(data.target));
			if(wolf_target_list.length == identity_dict['werewolf'].length) {
				wolf_target = mode(wolf_target_list)[0];
				return NightWitch(); 
			}
		});
	}
	if(live_flag == 0) {
		return GameOver(0); // game over, villigars win!
	}
}

function GameOver(res) {
	if(res == 0) {
		console.log("Villagers win!");
	} else {
		console.log("Werewolves win!");
	}
}

function NightWitch() {
	console.log("=====Witch=====");
	console.log(wolf_target);
	server.emit("WerewolfCEAudio");
	sleep(3000);
	server.emit("WitchOEAudio");
	var live_flag = 0;
	for(var i = 0, len = identity_dict['witch'].length; i < len; ++i) {
		if(contains(liveList, identity_dict['witch'][i]) == false) continue;
		live_flag = 1;
		var sock = sockets[identity_dict['witch'][i]];
		if(witch_cure) {
			if(wolf_target == identity_dict['witch'][i] && day != 1) {
				sock.emit("cure", {message: "YOU"});
			} else {
				sock.emit("cure", {message: wolf_target});
			}
			sock.once("choise", function(data){
				if(data.choise == "YES") {
					console.log("Witch choose to use the cure...");
					witch_choice = 1;
					witch_cure = 0;
					return NightSeer();
				} else {
					console.log("Witch choose not to use the cure...");
					if(witch_poison) {
						sock.emit('poison', {message: liveList});
						sock.once('poison_target', function(data) {
							if(parseInt(data.target) == -1) {
								witch_choice = 0;
								return NightSeer();
							} else {
								witch_choice = -1;
								witch_poison = 0;
								witch_target = parseInt(data.target);
								return NightSeer();
							}
						});
					}
				}
			});
		} else if(witch_poison) {
			sockets[identity_dict['witch'][i]].emit('poison');
			sockets[identity_dict['witch'][i]].once('poison_target', function(data) {
				if(parseInt(data.target) == -1) {
					witch_choice = 0;
					return NightSeer();
				} else {
					witch_choice = -1;
					witch_poison = 0;
					witch_target = parseInt(data.target);
					return NightSeer();
				}
			});
		} else return NightSeer();
	}
	if(live_flag == 0) {
		setTimeout(function() {
			return NightSeer();
		}, 10000);
	}
}

function NightGuardian() {
	console.log("=====Guardian=====");
	server.emit("SeerCEAudio");
	sleep(3000);
	server.emit("GuardianOEAudio");
	server.emit()
	var live_flag = 0;
	for(var i = 0, len = identity_dict['guardian'].length; i < len; ++i) {
		if(contains(liveList, identity_dict['guardian'][i]) == false) continue;
		live_flag = 1;
		sockets[identity_dict['guardian'][i]].emit("command", {message: liveList});
		sockets[identity_dict['guardian'][i]].once("guard", function (data) {
			if(parseInt(data.target) == guardian_last_target) {
				guardian_target = -1;
				guardian_last_target = -1;
			} else {
				guardian_target = parseInt(data.target);
				guardian_last_target = guardian_target;
			}
			return DawnElection(0);
		});
	}
	if(live_flag == 0) {
		setTimeout(function() {
			return DawnElection(0);
		}, 10000);
	}
}

function NightSeer() {
	console.log("=====Seer=====");
	console.log("witch_choice:" + witch_choice);
	console.log("witch_cure:" + witch_cure);
	console.log("witch_poison:" + witch_poison);
	console.log("witch_target:" + witch_target);
	server.emit("WitchCEAudio");
	sleep(3000);
	server.emit("SeerOEAudio");
	var live_flag = 0;
	for(var i = 0, len = identity_dict['seer'].length; i < len; ++i) {
		if(contains(liveList, identity_dict['seer'][i]) == false) continue;
		live_flag = 1;
		var sock = sockets[identity_dict['seer'][i]];
		sock.emit("command", {message: liveList});
		sock.once("see", function (data) {
			if(contains(liveList, parseInt(data.target))) {
				sock.emit("result", {message: identities[data.target]});
			}
			return NightGuardian();
		});
	}
	if(live_flag == 0) {
		setTimeout(function(){
			return NightGuardian();
		}, 10000);
	}
}

function DawnElection(time) {
	console.log("=====DawnElection=====");
	console.log("guardian_target:" + guardian_target);
	if(time == 0) {
		server.emit("GuardianCEAudio");
		if(day == 1) {
			setTimeout(function() {
				server.emit("RunForSherifAudio");
			}, 3000);
			setTimeout(function() {
				server.emit("DayComeAudio");
			}, 12000);
		} else {
			setTimeout(function() {
				server.emit("DayComeAudio");
			}, 3000);
		}
	}
	if(day != 1) return DawnSettlement();

	if(time == 1) {
		console.log("this is a re-election...");
	}
	vote_list = [];
	console.log("after empty, votelist: " + vote_list);
	console.log(vote_list.length);
	for(var i = 0, len = liveList.length; i < len; ++i) {
		var sock = sockets[liveList[i]];
		sock.emit("vote", {message: liveList});
		sock.once("vote_res", function(data) {
			console.log("Got a message from socket: " + data.target);
			vote_list.push(data.target);
			if(vote_list.length == liveList.length) {
				console.log("vote_list:" + vote_list);
				var tmp_vote_target_list = mode(vote_list);
				if(tmp_vote_target_list.length > 1 || 
					(tmp_vote_target_list.length == 1 && tmp_vote_target_list[0] == -1)) {
					if(time == 1) {
						police = -1;
						return DawnSettlement();
					}
					console.log("re-elect");
					return DawnElection(1);
				} else {
					vote_target = tmp_vote_target_list[0];
					police = vote_target;
					return DawnSettlement();
				}
			}
		});
	}
}

function DawnSettlement() {
	console.log("=====DawnSettlement=====");
	console.log("police:" + police);
	server.emit("SherifTakingOfficeAudio", {police: police});
	death_list = [];
	switch(witch_choice) {
	case -1:
		if(identities[witch_target] == "hunter") {
			hunter_state = 0;
		}
		death_list.push(witch_target);
		removeByValue(liveList, witch_target);
		if(wolf_target != guardian_target) {
			death_list.push(wolf_target);
			removeByValue(liveList, wolf_target);
		}
		break;
	case 0:
		if(wolf_target != guardian_target) {
			death_list.push(wolf_target);
			removeByValue(liveList, wolf_target);
		}
		break;
	case 1:
		if(wolf_target == guardian_target) {
			death_list.push(wolf_target);
			removeByValue(liveList, wolf_target);
		}
		break;
	default:
		break;
	}
	console.log("death_list:" + death_list);
	console.log("new live list:" + liveList);
	setTimeout(function() {
		server.emit("DeathAnnouncementAudio", {message: death_list});
	}, 6000);
	for(var i = 0; i < liveList.length; ++i) {
		if(death_list.length == 0) {
			sockets[liveList[i]].emit("announce", {message: -1});
		} else
			sockets[liveList[i]].emit("announce", {message: death_list});	
	}
	
	var tmp_wait = 0;
	for(var i = 0; i < death_list.length; ++i) {
		if(identities[death_list[i]] == "hunter" && hunter_state) {
			tmp_wait = 1;
			sockets[death_list[i]].emit("command", {message: liveList});
			sockets[death_list[i]].once("gunfire", function(data) {
				if(data.target != -1) {
					death_list.push(parseInt(data.target));
					removeByValue(liveList, parseInt(data.target));
				}
				return BadgeTransfer(0);
			});
		}
	}
	if(tmp_wait == 0) {
		return BadgeTransfer(0);
	}
}

function BadgeTransfer(time) {
	console.log("=====BadgeTransfer=====");
	if(contains(death_list, police)) {
		sockets[police].emit("transferBadge", {message: liveList});
		sockets[police].once("vote_res", function(data) {
			police = data.target;
			if(time == 0)
				return DaySpeech();
			else
				return InitDay();
		});
	} else {
		if(time == 0)
			return DaySpeech();
		else
			return InitDay();
	}
}

function DaySpeech() {
	return SherifLynch();
	var finished = 0;
	for(var i = 0, len = liveList.length; i < len; ++i) {
		sockets[liveList[i]].emit("speach");
		sockets[liveList[i]].once("finished", function() {
			finished += 1;
			if(finished == len) {
				return DayLynch(0);
			}
		});
	}
}

function SherifLynch() {
	console.log("=====SherifLynch=====");
	if(police == -1) {
		return DayLynch();
	}
	sockets[police].emit("sheriflynch", {message: liveList});
	sockets[police].once("vote_res", function(data) {
		police_target = data.target;
		return DayLynch();
	});
}

function DayLynch(time) {
	console.log("=====DayLychkin=====");
	if(time == 1) {
		console.log("this is a re-lynch...");
	}
	var lynch_list = [];
	var lynch_target = -1;
	for(var i = 0, len = liveList.length; i < len; ++i) {
		var sock = sockets[liveList[i]];
		sock.emit("lynchlist", {message: liveList});
		sock.once("vote_res", function (data) {
			lynch_list.push(parseInt(data.target));
			if(lynch_list.length == len) {
				var tmp_lynch_target_list = mode(lynch_list);
				if(tmp_lynch_target_list.length > 1 ||
					(tmp_lynch_target_list.length == 1 && tmp_lynch_target_list[0] == -1)) {
					console.log("re-lynch");
					if(time == 1) {
						for(var d = 0; d < tmp_lynch_target_list.length; ++d) {
							death_list.push(tmp_lynch_target_list[d]);
							removeByValue(liveList, tmp_lynch_target_list[d]);
							return BadgeTransfer(1);
						}
					}
					return DayLynch(1);
				} else {
					lynch_target = tmp_lynch_target_list[0];
					death_list.push(lynch_target);
					removeByValue(liveList, lynch_target);
					return BadgeTransfer(1);
				}
			}
		});
	}

}

function InitDay() {
	// remove all the existed listeners. otherwise there might be duplicated listeners
	// for(var i = 0; i < liveList.length; ++i) {
	// 	for(var listener in sockets[liveList[i]].events) {
	// 		console.log(listener);
	// 		if(listener != undefined)
	// 			sockets[liveList[i]].removeAllListeners(listener);
	// 	}
	// }
	// disconnect all the socket of dead
	for(var i = 0; i < death_list.length; ++i) {
		sockets[death_list[i]].disconnect();
	}
	return NightWolf();
}

// ************************************
// THE DEFINITION PART IS FINISHED
// ************************************

Welcome();