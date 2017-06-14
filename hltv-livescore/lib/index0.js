var io = require('socket.io-client');
var EE = require('events').EventEmitter;
var inherits = require('util').inherits;

var CONNECTION = 'http://scorebot2.hltv.org';
var PORT = 10022;

var self;

function Livescore(options) {
  self = this;

  self.connected = false;
  self.started = false;


  options = options || {};
  self.listid = options.listid || self.listid;
  // self.listid = options.listid || null;
  self.url = options.url || CONNECTION;
  self.port = options.port || PORT;

  self.socket = io(self.url + ':' + self.port);

  self.time = 0;
  self.map;
  self.interval;

  self.scoreboard;

  self.players = {};
  self.teams = {};

  self.kills = 0;
  self.knifeKills = 0;

  self._lastLog;

  self.options = {};

  self.options[Livescore.Enums.EOption['ROUND_TIME']] = options.roundTime || 115; // 105 before update
  self.options[Livescore.Enums.EOption['BOMB_TIME']] = options.bombTime || 40; // 35 before update
  self.options[Livescore.Enums.EOption['FREEZE_TIME']] = options.freezeTime || 15;

  // there are 3 original events: connect, scoreboard, and log.
  // the rest we create and invoke while parsing the log
  self.socket.on('connect', self._onConnect);
}

inherits(Livescore, EE);

Livescore.Enums = require('../Livescore.js').Enums;
Livescore.Classes = require('../Livescore.js').Classes;

// Livescore.prototype.start = function(options, callback) {
//   if (typeof options === 'function') {
//     callback = options;
//     options = {};
//   }

//   // options = options || {};

//   // self.listid = options.listid || self.listid;

//   if (self.connected) {
//     self.socket.emit('readyForMatch', self.listid);

//     if (callback) {
//       callback(null);
//     }
//   } else if (callback) {
//     callback(new Error('Not yet connected to HLTV'));
//   }
// };
//

// invoked by hltv connect event
Livescore.prototype._onConnect = function() {
  if (!self.connected) {
    self.connected = true;
    // these are the only other hltv events
    self.socket.on('log', self._onLog);
    self.socket.on('scoreboard', self._onScoreboard);

    self.emit('connected');
  }

  if (self.listid) {
    self.socket.emit('readyForMatch', self.listid);
  }
};

// invoked by hltv log event
Livescore.prototype._onLog = function(logs) {
  try {
    logs = JSON.parse(logs).log.reverse();
  } catch (err) {
    logs = null;

    self.emit('debug', err);
  }

  if (logs && logs !== self._lastLog) {
    self.emit('log', logs);

    self.getPlayers((players) => {
      if (Object.keys(players).length && logs) {
        logs.forEach((log) => {
          var event;

          for (event in log) {
            self.emit('debug', 'received event: ' + event);

            switch (event) {
              case 'Kill':
              case 'Assist':
              case 'BombPlanted':
              case 'BombDefused':
              case 'RoundStart':
              case 'RoundEnd':
              case 'PlayerJoin':
              case 'PlayerQuit':
              case 'MapChange':
              case 'MatchStarted':
              case 'Restart':
              case 'Suicide':
                self['_on' + event](log[event]);
                break;
              default:
                self.emit('debug', 'unrecognized event: ' + event);
                break;
            }
          }
        });
      }
    });

    self._lastLog = logs;
  }
};

// invoked by hltv scoreboard event
Livescore.prototype._onScoreboard = function(event) {
  if (!self.started) {
    self.started = true;
    self.emit('started');
  }

  updateGame(event);

  self.getTeams((teams) => {
    var scoreboard = new Livescore.Classes.Scoreboard(event);

    scoreboard.teams[Livescore.Enums.ESide['TERRORIST']] = teams[Livescore.Enums.ESide['TERRORIST']];
    scoreboard.teams[Livescore.Enums.ESide['COUNTERTERRORIST']] = teams[Livescore.Enums.ESide['COUNTERTERRORIST']];

    self.emit('scoreboard', scoreboard);
  });
};

// invoked by log
Livescore.prototype._onReconnect = function() {
  self.socket.emit('readyForMatch', self.listid);
};

// invoked by log
Livescore.prototype._onKill = function(event) {
  self.getPlayers((players) => {
    self.emit('kill', {
      killer: players[event.killerName],
      victim: players[event.victimName],
      weapon: event.weapon,
      headshot: event.headShot,
      killerside: event.killerSide,
      victimside: event.victimSide
    });
  });

  self.kills++;
  if (event.weapon.indexOf('knife') > -1 || event.weapon.indexOf('bayonet') > -1) {
    self.knifeKills++;
  }
};

// invoked by log
Livescore.prototype._onSuicide = function(event) {
  self.getPlayers((players) => {
    self.emit('suicide', {
      player: players[event.playerName]
    });
  });
};

// invoked by log
Livescore.prototype._onBombPlanted = function(event) {
  self.setTime(self.options[Livescore.Enums.EOption['BOMB_TIME']]);

  self.getPlayers((players) => {
    self.emit('bombPlanted', {
      player: players[event.playerName]
    });
  });
};

// invoked by log
Livescore.prototype._onBombDefused = function(event) {
  self.getPlayers((players) => {
    self.emit('bombDefused', {
      player: players[event.playerName]
    });
  });
};

// invoked by log
Livescore.prototype._onMatchStarted = function(event) {
  self.emit('matchStart', event);
};

// invoked by log
Livescore.prototype._onRoundStart = function() {
  self.setTime(self.options[Livescore.Enums.EOption["ROUND_TIME"]]);
  self.emit('roundStart', {
    round: self.scoreboard.currentRound
  });

  self.kills = 0;
  self.knifeKills = 0;
};

// invoked by log
Livescore.prototype._onRoundEnd = function(event) {
  var winner = Livescore.Enums.ESide[event.winner === 'TERRORIST' ? 'TERRORIST' : 'COUNTERTERRORIST'];

  self.setTime(self.options[Livescore.Enums.EOption["FREEZE_TIME"]]);

  self.getTeams((teams) => {
    if (Object.keys(teams).length) {
      teams[Livescore.Enums.ESide['TERRORIST']].score = event.terroristScore;
      teams[Livescore.Enums.ESide['COUNTERTERRORIST']].score = event.counterTerroristScore;

      // If at least 80% of the kills are knife kills, count it as a knife
      // round. Sometimes players will have pistols on knife rounds and
      // kill teammates after the round is over, so self takes that into
      // account.
      self.emit('roundEnd', {
        teams: teams,
        winner: teams[winner],
        roundType: Livescore.Enums.ERoundType[event.winType],
        knifeRound: (self.knifeKills/self.kills) >= 0.8
      });
    }
  });
};

// invoked by log
Livescore.prototype._onPlayerJoin = function(event) {
  self.emit('playerJoin', {
    playerName: event.playerName
  });
};

// invoked by log
Livescore.prototype._onPlayerQuit = function(event) {
  self.getPlayers((players) => {
    self.emit('playerQuit', {
      player: players[event.playerName]
    });
  });
};

// invoked by log
Livescore.prototype._onRestart = function() {
  self.emit('restart');
};

// invoked by log
Livescore.prototype._onMapChange = function(event) {
  self.emit('mapChange', event);
};

// prototype function. called elsewhere.
Livescore.prototype.disconnect = function() {
  self.connected = false;
  self.socket.disconnect();
};

// prototype function. called elsewhere.
Livescore.prototype.getPlayers = function(callback) {
  callback(self.players);
};

// prototype function. called elsewhere.
Livescore.prototype.getTeams = function(callback) {
  callback(self.teams);
};

// prototype function. called elsewhere.
Livescore.prototype.setTime = function(time) {
  clearInterval(self.interval);
  self.time = time;
  self.emit('clock', self.time);
  self.interval = setInterval(() => {
    var _s;
    self.time = self.time - 1;
    _s = Number(self.time);
    if (_s % 5 === 0 && _s > -1) {
      self.emit('time', self.time);
    }
  }, 1000);
};

// prototype function. called elsewhere.
Livescore.prototype.getTime = function(callback) {
  callback(self.time);
};

// global function. only used once.
function updateGame(scoreboard) {
  var tPlayers = [];
  var ctPlayers = [];

  self.teams[Livescore.Enums.ESide['TERRORIST']] = new Livescore.Classes.Team({
    name: scoreboard.terroristTeamName,
    id: scoreboard.tTeamId,
    score: scoreboard.terroristScore,
    side: Livescore.Enums.ESide['TERRORIST'],
    players: tPlayers,
    history: scoreboard.terroristMatchHistory
  });

  self.teams[Livescore.Enums.ESide['COUNTERTERRORIST']] = new Livescore.Classes.Team({
    name: scoreboard.ctTeamName,
    id: scoreboard.ctTeamId,
    score: scoreboard.counterTerroristScore,
    side: Livescore.Enums.ESide['COUNTERTERRORIST'],
    players: ctPlayers,
    history: scoreboard.ctMatchHistory
  });

  self.getTeams((teams) => {
    scoreboard.TERRORIST.forEach((pl) => {
      var player = new Livescore.Classes.Player(pl);
      player.team = teams[Livescore.Enums.ESide['TERRORIST']];

      self.players[player.name] = player;
      tPlayers.push(player);
    });

    scoreboard.CT.forEach((pl) => {
      var player = new Livescore.Classes.Player(pl);
      player.team = teams[Livescore.Enums.ESide['COUNTERTERRORIST']];

      self.players[player.name] = player;
      ctPlayers.push(player);
    });
  });

  self.scoreboard = scoreboard;
}

module.exports = Livescore;
