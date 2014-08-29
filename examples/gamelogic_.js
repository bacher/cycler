
var EPSILON = 0.01;
var PLAYER_RESPAWN_INTERVAL = 3000;
var PLAYER_RESPAWN_TRY_INTERVAL = 100;

var _ = require('lodash');
var Map = require('./entities/map');
var Player = require('./entities/player');

var GAME_LOGIC_INTERVAL = 23;
var SEND_UPDATES_INTERVAL = 70;

/**
 * Класс описывающий игровую логику одного мира.
 * @constructor
 */
function GameLogic() {
    var that = this;

    this._map = new Map({
        mapId: 2
    });

    this._map.on('updateCell', function(data) {
        that.broadcast({
            event: 'updateCell',
            data: data
        });
    });

    this._players = [];
    this._tanks = [];
    this._bullets = [];

    this.lastWorldUpdateTS = new Date().getTime();

    this.updateWorld = this.updateWorld.bind(this);
    this.sendUpdates = this.sendUpdates.bind(this);

    this.updateWorld();
    this.sendUpdates();
}

GameLogic.prototype.destroy = function() {
    clearTimeout(this.updateWorldTimeout);
    clearTimeout(this.sendUpdatesTimeout);

    for(var _i=0,player,_m=this._players;_i<_m.length;++_i){player=_m[_i];
        player.socket.reject();
    }
};

/**
 * @param {WebSocket} socket
 */
GameLogic.prototype.onConnect = function(socket) {
    var that = this;

    var newPlayer = new Player({
        socket: socket
    });

    newPlayer.on('tankCreated', function(tank) {

        tank.on('shoot', function(bullet) {
            that._bullets.push(bullet);

            bullet.on('explode', function() {
               that.broadcast({
                   event: 'hit',
                   data: {
                       position: bullet.position
                   }
               });
            });
        });

        tank.on('updateHealth', function(hp) {
            that.send(tank.player, {
                event: 'updateHealth',
                data: {
                    hp: hp
                }
            });
        });

        that._tanks.push(tank);
    });

    newPlayer.on('joined', function() {
        that.send(newPlayer, {
            event: 'details',
            data: {
                map: that._map.map,
                baseHp: newPlayer.tank.baseHp,
                now: new Date().getTime()
            }
        });

        that.send(newPlayer, {
            event: 'playerList',
            data: that._players.filter(function(pl) { return pl.inGame; }).map(function(player) {
                return {
                    id: player.id,
                    name: player.name,
                    color: player.color,
                    kills: player.kills,
                    deaths: player.deaths
                };
            })
        });

        that.broadcastExcept(newPlayer, {
            event: 'playerJoined',
            data: {
                id: newPlayer.id,
                name: newPlayer.name,
                color: newPlayer.color,
                kills: newPlayer.kills,
                deaths: newPlayer.deaths
            }
        });

        that.setRespawnTankTimer(newPlayer.tank, 0);

    });

    newPlayer.on('leave', function() {
        var index = that._players.indexOf(newPlayer);
        if (index !== -1) {
            that._players.splice(index, 1);
        }

        index = that._tanks.indexOf(newPlayer.tank);
        if (index !== -1) {
            that._tanks.splice(index, 1);
        }

        that.broadcast({
            event: 'playerLeft',
            data: {
                id: newPlayer.id
            }
        });
    });

    this._players.push(newPlayer);
};

/**
 * Устанавливает время возрождения танка.
 * @param {Tank} tank
 * @param {number} time
 */
GameLogic.prototype.setRespawnTankTimer = function(tank, time) {
    var that = this;

    tank.respawnTimeout = setTimeout(function() {
        tank.position = _.clone(that._map.getRandomRespawn());

        for (var i = 0; i < that._tanks.length; ++i) {
            var otherTank = that._tanks[i];

            if (!otherTank.isDead) {
                if (tank.checkCollision(otherTank)) {
                    that.setRespawnTankTimer(tank, PLAYER_RESPAWN_TRY_INTERVAL);
                    return;
                }
            }
        }

        tank.hp = tank.baseHp;
        tank.isDead = false;

    }, time);
};

/**
 * Обновление мира.
 */
GameLogic.prototype.updateWorld = function() {
    var startTS = new Date().getTime();

    var deltaTS = startTS - this.lastWorldUpdateTS;

    var that = this;

    var axis;
    var delta;

    var bulletsToDestroy = [];

    for(var _i=0,bullet,_m=this._bullets;_i<_m.length;++_i){bullet=_m[_i];
        bullet.updatePosition(deltaTS);
    }

    this._tanks.forEach(function(tank) {

        if (!tank.isDead) {
            tank.updatePosition(deltaTS);

            if (that._map.checkCollision(tank)) {

                if (tank.direction === 0 || tank.direction === 2) {
                    axis = 1;
                } else {
                    axis = 0;
                }

                var roundFunc;
                var epsilon;

                if (tank.direction === 1 || tank.direction === 2) {
                    roundFunc = Math.floor;
                    delta = tank.size[axis] / 2;
                    epsilon = EPSILON;
                } else {
                    roundFunc = Math.ceil;
                    delta = -tank.size[axis] / 2;
                    epsilon = -EPSILON;
                }

                tank.position[axis] = roundFunc(tank.position[axis] + delta) - delta - epsilon;
            }

            for(var _i=0,otherTank,_m=that._tanks;_i<_m.length;++_i){otherTank=_m[_i];

                if (tank === otherTank) {
                    continue;
                }

                if (!otherTank.isDead && tank.checkCollision(otherTank)) {

                    if (tank.direction === 0 || tank.direction === 2) {
                        axis = 1;
                    } else {
                        axis = 0;
                    }

                    if (tank.direction === 0 || tank.direction === 3) {
                        delta = tank.size[axis] + EPSILON;
                    } else {
                        delta = -(tank.size[axis] + EPSILON);
                    }

                    tank.position[axis] = otherTank.position[axis] + delta;
                }
            }
        }

        for(var _i=0,bullet,_m=that._bullets;_i<_m.length;++_i){bullet=_m[_i];

            if (tank === bullet.tank) {
                continue;
            }

            if (tank.checkCollision(bullet)) {

                if (tank.decreaseHp() === 0) {

                    that.setRespawnTankTimer(tank, PLAYER_RESPAWN_INTERVAL);

                    bullet.tank.player.kills++;

                    that.broadcast({
                        event: 'playerDeath',
                        data: {
                            dead: tank.player.id,
                            killer: bullet.tank.player.id
                        }
                    });

                } else {
                    that.broadcast({
                        event: 'hit',
                        data: {
                            position: bullet.position
                        }
                    });
                }

                bulletsToDestroy.push(bullet);
            }
        }
    });

    this._bullets.forEach(function(bullet) {
        var cell = that._map.checkCollision(bullet);

        if (cell) {
            bulletsToDestroy.push(bullet);

            if (Array.isArray(cell)) {
                var damageCells = [cell];

                if (bullet.direction === 0 || bullet.direction === 2) {
                    damageCells.push([cell[0] - 1, cell[1]]);
                    damageCells.push([cell[0] + 1, cell[1]]);
                } else {
                    damageCells.push([cell[0], cell[1] - 1]);
                    damageCells.push([cell[0], cell[1] + 1]);
                }

                damageCells.forEach(function(cell) {
                    that._map.damageCell(cell);
                });
            }
        }
    });

    for(var _i=0,bullet,_m=bulletsToDestroy;_i<_m.length;++_i){bullet=_m[_i];
        var index = that._bullets.indexOf(bullet);

        if (index !== -1) {
            bullet.explode();

            that._bullets.splice(index, 1);
        }
    }

    for(var _i=0,tank,_m=this._tanks;_i<_m.length;++_i){tank=_m[_i];
        if (tank.isShooting) {
            tank.tryShoot();
        }
    }

    this.lastWorldUpdateTS = startTS;

    var nextTick = GAME_LOGIC_INTERVAL - (new Date().getTime() - startTS);
    this.updateWorldTimeout = setTimeout(this.updateWorld, nextTick);
};

/**
 * Посылает обновления игрокам.
 */
GameLogic.prototype.sendUpdates = function() {
    var startTS = new Date().getTime();
    var i;
    var tanks = [];
    var bullets = [];

    for(var _i=0,player,_m=this._players;_i<_m.length;++_i){player=_m[_i];
        var tank = player.getTank();

        if (tank && !tank.isDead) {
            tanks.push({
                id: player.id,
                position: tank.position,
                direction: tank.direction
            });
        }
    }

    for(var _i=0,bullet,_m=this._bullets;_i<_m.length;++_i){bullet=_m[_i];
        bullets.push({
            position: bullet.position,
            direction: bullet.direction
        });
    }

    this.broadcast({
        event: 'updateGameEntities',
        data: {
            tanks: tanks,
            bullets: bullets
        }
    });

    var nextTick = SEND_UPDATES_INTERVAL - (new Date().getTime() - startTS);
    this.sendUpdatesTimeout = setTimeout(this.sendUpdates, nextTick);
};

/**
 * Отправить сообщение одному игроку.
 * @param {Player} player
 * @param {Object} data
 */
GameLogic.prototype.send = function(player, data) {

    player.socket.send(JSON.stringify(data));
};

/**
 * Отправляет сообщение всем игрокам.
 * @param {Object} data
 */
GameLogic.prototype.broadcast = function(data) {
    this.broadcastExcept(null, data);
};

/**
 * Отправляет сообщение всем игрокам за исключением одного.
 * @param {Object} data
 * @param {Player} [except]
 */
GameLogic.prototype.broadcastExcept = function(except, data) {
    var json = JSON.stringify(data);

    for(var _i=0,player,_m=this._players;_i<_m.length;++_i){player=_m[_i];
        if (player.inGame && player !== except) {
            player.socket.send(json);
        }
    }
};

module.exports = GameLogic;
