const Utils = require('pathing.utils');

const MATRIX_LAYER_TERRAIN = 0;
const MATRIX_LAYER_STRUCTURES = 1;
const MATRIX_LAYER_TUNNELS = 2;
const MATRIX_LAYER_ROADS = 4;
const MATRIX_LAYER_OFF_ROADS = 8;
const MATRIX_LAYER_SWAMP_ROADS = MATRIX_LAYER_ROADS | MATRIX_LAYER_OFF_ROADS;
const MATRIX_LAYER_CONTAINERS = 16;
const MATRIX_LAYER_PREFER_CONTAINERS = 32;

const MATRIX_CACHE_TIME = 50;

const TARGET_LINE_COLOR = '#5ec8ff';

const TERRAIN_COST = {
	0: 2,
	[TERRAIN_MASK_SWAMP]: 10,
	[TERRAIN_MASK_WALL]: 255,
	[TERRAIN_MASK_WALL | TERRAIN_MASK_SWAMP]: 255,
};

class TerrainMatrix {

	constructor(terrain) {
		this.data = terrain.getRawBuffer();
	}

	getCost(x, y) {
		const value = this.data[y * 50 + x];
		return TERRAIN_COST[value];
	}

	get(x, y) {
		return this.data[y * 50 + x];
	}

}

const TerrainCache = {

	cache: new Map(),

	get(roomName) {
		let terrain = this.cache.get(roomName);
		if (!terrain) {
			if (this.cache.size > 20) {
				this.cache.clear();
			}
			terrain = new TerrainMatrix(new Room.Terrain(roomName));
			this.cache.set(roomName, terrain);
		}
		return terrain;
	},

};

class PathingManager {

	constructor(options = {}) {
		this.onRoomEnter = options.onRoomEnter;
		this.getCreepWorkingTarget = options.getCreepWorkingTarget;
		this.avoidRooms = options.avoidRooms || [];
		this.matrixCache = new Map();
		this.roomMoves = new Map();
	}

	clearMatrixCache() {
		this.matrixCache.clear();
	}

	clearMatrixCacheRoom(roomName) {
		this.matrixCache.delete(roomName);
	}


	moveTo(creep, target, defaultOptions = {}) {
		const targetPos = target.pos || target;

		if (!targetPos) {
			return ERR_INVALID_ARGS;
		}
		/* if (!creep.instance.body.some(
			part => part.type === MOVE && part.hits > 0
		)) {
			return ERR_NO_BODYPART;
		} */

		const {range = 1, priority = 0} = defaultOptions;
		let options = defaultOptions;

		const {pos: creepPos, room, fatigue, memory} = creep;
		const creepRoomName = room.name;

		const data = memory._m;
		let [prevTargetPos, lastPos, path] = data
			? this.deserializeMove(data)
			: [undefined, undefined, ''];

		if (!fatigue) {
			let newPath = false;
			let blocked = false;
			let avoidLocalHostiles = false;

			if (!prevTargetPos || !Utils.isPosEqual(targetPos, prevTargetPos)) {
				newPath = true;
			} else {
				const nextPos = Utils.offsetPosCoords(lastPos, +path[0]);
				if (Utils.isCoordsEqual(creepPos, nextPos)) {
					path = path.substr(1);
					if (path.length === 0) {
						newPath = true;
					}
				} else {
					newPath = true;
					if (Utils.isCoordsEqual(creepPos, lastPos)) {
						if (this.hasObstacleHostileCreep(room, nextPos.x, nextPos.y)) {
							avoidLocalHostiles = true;
						} else {
							blocked = true;
						}
					} else if (Utils.isPosExit(creepPos)) {
						if (options.onRoomEnter) {
							options.onRoomEnter(creep, creepRoomName);
						}
						if (this.onRoomEnter) {
							this.onRoomEnter(creep, creepRoomName);
						}
						blocked = true;
					}
				}
			}

			let pathEnd;
			if (newPath) {
				if (
					!blocked &&
					this.getCreepWorkingTarget &&
					creepRoomName === targetPos.roomName &&
					creepPos.getRangeTo(targetPos) === range + 1
				) {
					const prevCostCallback = options.costCallback;
					let costCallback;
					if (prevCostCallback) {
						costCallback = (roomName, matrix) => {
							prevCostCallback(roomName, matrix);
							if (roomName === creepRoomName) {
								this.addWorkingCreepsToMatrix(matrix, targetPos, room, priority);
							}
						};
					} else {
						costCallback = (roomName, matrix) => {
							if (roomName === creepRoomName) {
								this.addWorkingCreepsToMatrix(matrix, targetPos, room, priority);
							}
						};
					}
					options = {...options, costCallback};
				}

				if (avoidLocalHostiles) {
					const prevCostCallback = options.costCallback;
					let costCallback;
					if (prevCostCallback) {
						costCallback = (roomName, matrix) => {
							prevCostCallback(roomName, matrix);
							if (roomName === creepRoomName) {
								this.addHostilesToMatrix(matrix, creepPos, room, 2);
							}
						};
					} else {
						costCallback = (roomName, matrix) => {
							if (roomName === creepRoomName) {
								this.addHostilesToMatrix(matrix, creepPos, room, 2);
							}
						};
					}
					options = {...options, costCallback};
				}

				[path, pathEnd] = this.serializePath(creepPos, this.findPath(creepPos, targetPos, options));
			}

			memory._m = this.serializeMove(targetPos, creepPos, path);

			if (path.length === 0) {
				return ERR_NO_PATH;
			}
			const direction = +path[0];
			const move = {
				creep,
				direction,
				priority,
				pushed: false,
				blocked,
				pos: undefined,
				pathEnd,
			};
			creep._hasMove = true;

			this.insertMove(creepRoomName, move);
		}

		if (options.visualizePathStyle) {
			if (fatigue > 0) {
				path = path.substr(1);
			}
			this.visualizePath(creepPos, path, targetPos, range, options.visualizePathStyle);
		}

		return OK;
	}

	deserializeMove(data) {
		const [x, y, roomName, lastPosX, lastPosY, path] = data;
		return [{x, y, roomName}, {x: lastPosX, y: lastPosY}, path];
	}

	serializeMove(targetPos, creepPos, path) {
		return [targetPos.x, targetPos.y, targetPos.roomName, creepPos.x, creepPos.y, path];
	}

	visualizePath(startPos, path, targetPos, range, style) {
		const points = new Array(path.length);
		let pos = startPos;
		for (let i = 0; i < path.length; i++) {
			pos = Utils.offsetPosCoords(pos, +path[i]);
			points[i] = pos;
		}
		const visual = new RoomVisual(startPos.roomName);
		if (points.length > 0) {
			visual.poly(points, style);
		}
		if (startPos.roomName === targetPos.roomName) {
			const posRange = Utils.getRange(pos, targetPos);
			if (posRange > 0 && posRange <= range) {
				visual.poly([pos, targetPos], {...style, stroke: TARGET_LINE_COLOR});
			}
		}
	}


	// moves
	insertMove(roomName, move) {
		const moves = this.getMoves(roomName);
		const priority = move.priority;
		let i = moves.length;
		while (i > 0 && moves[i - 1].priority < priority) {
			i--;
		}
		moves.splice(i, 0, move);
	}

	getMoves(roomName) {
		let moves = this.roomMoves.get(roomName);
		if (!moves) {
			this.roomMoves.set(roomName, moves = []);
		}
		return moves;
	}

	hasMove(pos, moves) {
		return moves.some(
			move => {
				const movePos = move.pos || (
					move.pos = Utils.offsetPos(move.creep.pos, move.direction)
				);
				return Utils.isCoordsEqual(pos, movePos);
			}
		);
	}


	// run moves
	runMoves() {
		try {
			for (let moves of this.roomMoves.values()) {
				this.moveCreeps(moves);
			}
		} catch (error) {
			Utils.logError(error);
		}
		this.cleanup();
	}

	runMovesRoom(roomName) {
		const moves = this.roomMoves.get(roomName);
		if (!moves) {
			return;
		}
		try {
			this.moveCreeps(moves);
		} catch (error) {
			Utils.logError(error);
		}
	}

	cleanup() {
		this.roomMoves.clear();
		if (this.matrixCache.size > 200) {
			this.clearMatrixCache();
		}
	}

	moveCreeps(moves) {
		for (let i = 0; i < moves.length; i++) {
			const move = moves[i];
			let {creep, direction, priority, pushed, blocked, pos, pathEnd} = move;

			if (blocked || pushed) {
				const creepPos = creep.pos;
				const obstacleCreep = this.getObstacleCreep(pos || (move.pos = Utils.offsetPos(creepPos, direction)));
				if (obstacleCreep) {
					// blocked by creep
					if (!obstacleCreep.my) {
						// not own creep
						if (!pathEnd && !pushed) {
							pathEnd = this.getPathEnd(creepPos, creep.memory._m.path);
						}
						move.pos = this.getCreepMovePos(creep, priority, moves, pathEnd);
						direction = move.direction = Utils.getDirection(creepPos, move.pos);
					} else if (obstacleCreep.fatigue === 0 && !obstacleCreep._hasMove) {
						let moveDirection, movePos, targetInfo;
						if (this.getCreepWorkingTarget) {
							const workingTargetInfo = this.getCreepWorkingTarget(obstacleCreep);
							if (workingTargetInfo && workingTargetInfo.pos.roomName === obstacleCreep.room.name) {
								targetInfo = workingTargetInfo;
							}
						}
						if (targetInfo || pushed) {
							// determine blocking creep move direction
							movePos = this.getCreepPushPos(obstacleCreep, priority, moves, targetInfo);
							moveDirection = Utils.getDirection(obstacleCreep.pos, movePos);
						} else {
							// swap positions
							movePos = creepPos;
							moveDirection = (direction + 3) % 8 + 1;
						}
						const obstacleCreepMove = {
							creep: obstacleCreep,
							direction: moveDirection,
							priority,
							pushed: true,
							blocked: false,
							pos: movePos,
							pathEnd: undefined,
						};
						moves.splice(i + 1, 0, obstacleCreepMove);
					}
				} else if (blocked) {
					// blocked by structure
					this.clearMatrixCacheRoom(creepPos.roomName);
				}
			}
			creep.move(direction);
		}
	}

	// returns obstacle creep if it is found
	// called when next position is blocked
	getObstacleCreep(pos) {
		const lookCreeps = pos.lookFor(LOOK_CREEPS);
		let creep = lookCreeps.find(creep => creep.my);
		if (!creep) {
			const lookPowerCreeps = pos.lookFor(LOOK_POWER_CREEPS);
			creep = lookPowerCreeps.find(creep => creep.my) || lookCreeps[0] || lookPowerCreeps[0];
		}
		return creep;
	}

	// check if blocked by hostile creep
	// called to know if need to enable local avoidance
	hasObstacleHostileCreep(room, x, y) {
		if (x < 0 || y < 0 || x > 49 || y > 49) {
			return false;
		}
		return (
			room.lookForAt(LOOK_CREEPS, x, y).some(creep => !creep.my) ||
			room.lookForAt(LOOK_POWER_CREEPS, x, y).some(creep => !creep.my)
		);
	}

	// check if position is free from hostile creeps or own fatigued creeps
	// called to filter possible move positions for moving blocked creep or pushing obstacle creep
	hasObstacleCreep(room, x, y) {
		return (
			room.lookForAt(LOOK_CREEPS, x, y).find(creep => !creep.my || creep.fatigue > 0) ||
			room.lookForAt(LOOK_POWER_CREEPS, x, y).find(creep => !creep.my)
		);
	}

	* getAdjacentPositions(pos) {
		const {x: posX, y: posY} = pos;
		const minY = Math.max(posY - 1, 0);
		const minX = Math.max(posX - 1, 0);
		const maxY = Math.min(posY + 1, 49);
		const maxX = Math.min(posX + 1, 49);

		for (let y = minY; y <= maxY; y++) {
			for (let x = minX; x <= maxX; x++) {
				if (x !== posX || y !== posY) {
					yield {x, y};
				}
			}
		}
	}

	getCreepMovePos(creep, priority, moves, pathEnd) {
		const {room, pos: creepPos} = creep;

		const terrain = TerrainCache.get(room.name);
		const matrix = this.getCostMatrix(room.name);
		const movePos = Utils.min(
			this.getAdjacentPositions(creepPos),
			pos => {
				let cost = matrix.get(pos.x, pos.y) || terrain.getCost(pos.x, pos.y);
				if (cost === 255 || this.hasMove(pos, moves) || this.hasObstacleCreep(room, pos.x, pos.y)) {
					return 255;
				}
				if (pathEnd) {
					cost += Utils.getRange(pos, pathEnd) * 10;
				}
				return cost;
			}
		);
		return new RoomPosition(movePos.x, movePos.y, room.name);
	}

	getCreepPushPos(creep, priority, moves, targetInfo) {
		const {room, pos: creepPos} = creep;

		const terrain = TerrainCache.get(room.name);
		let matrix = this.getCostMatrix(room.name);

		const movePos = Utils.min(
			this.getAdjacentPositions(creepPos),
			pos => {
				let cost = matrix.get(pos.x, pos.y) || terrain.getCost(pos.x, pos.y);
				if (cost === 255 || this.hasMove(pos, moves) || this.hasObstacleCreep(room, pos.x, pos.y)) {
					return 255;
				}
				if (targetInfo) {
					const range = Utils.getRange(pos, targetInfo.pos);
					if (range > targetInfo.range) {
						cost += range + 10;
					}
				}
				if (Utils.isPosExit(pos)) {
					cost += 10;
				}
				return cost;
			}
		);
		return new RoomPosition(movePos.x, movePos.y, room.name);
	}

	addWorkingCreepsToMatrix(matrix, targetPos, room, priority) {
		const creeps = [
			...room.find(FIND_MY_CREEPS),
			...room.find(FIND_MY_POWER_CREEPS)
		];

		for (const creep of creeps) {
			const targetInfo = this.getCreepWorkingTarget(creep);
			if (!targetInfo) {
				continue;
			}
			if (
				creep.pos.inRangeTo(targetInfo.pos, targetInfo.range) &&
				(!targetInfo.priority || targetInfo.priority >= priority)
			) {
				const {x, y} = creep.pos;
				matrix.setFast(x, y, 60);
			}
		}
	}


	// finding path
	findPath(startPos, targetPos, defaultOptions = {}) {
		/* if (
			defaultOptions.range === 0 &&
			startPos.roomName === targetPos.roomName &&
			Utils.getRange(startPos, targetPos) === 1
		) {
			return [targetPos];
		} */
		const {ignoreRoads, offRoads, range = 1, costCallback} = defaultOptions;
		let avoidRooms = defaultOptions.avoidRooms || [];
		if (this.avoidRooms) {
			avoidRooms = [...avoidRooms, ...this.avoidRooms];
		}
		const startRoomName = startPos.roomName;
		let startRoomMatrix;
		const options = {
			plainCost: (ignoreRoads || offRoads) ? 1 : 2,
			swampCost: (ignoreRoads || offRoads) ? 5 : 10,
			containerCost: 5,
			moveOffExit: true,
			fixPath: true,
			heuristicWeight: offRoads ? 1 : 1.2,
			...defaultOptions,
			roomCallback: roomName => {
				if (avoidRooms && avoidRooms.includes(roomName)) {
					return false;
				}
				let matrix = this.getCostMatrix(roomName, options);
				if (costCallback) {
					matrix = matrix ? matrix.clone() : new PathFinder.CostMatrix();
					costCallback(roomName, matrix);
				}
				if (roomName === startRoomName) {
					startRoomMatrix = matrix;
				}
				return matrix;
			}
		};
		let searchTargets = {pos: targetPos, range};
		let addTargetPos = false;
		if (range === 0) {
			searchTargets.range = 1;
			addTargetPos = true;
		} else if (targetPos.roomName !== startRoomName || options.moveOffExit) {
			const targets = this.getTargetRangePositions(targetPos, range, options);
			if (targets.length > 0) {
				searchTargets = targets;
			}
		}
		const {path} = PathFinder.search(startPos, searchTargets, options);
		if (addTargetPos) {
			path.push(targetPos);
		}
		if (
			options.fixPath &&
			options.heuristicWeight > 1 &&
			!options.ignoreRoads &&
			!options.offRoads &&
			path.length >= 3
		) {
			const roomName = path[0].roomName;
			if (roomName !== startPos.roomName) {
				startRoomMatrix = options.roomCallback(roomName);
			}
			if (startRoomMatrix) {
				this.fixPath(path, startRoomMatrix, roomName);
			}
		}
		return path;
	}

	getTargetRangePositions(targetPos, range, options) {
		const {moveOffExit, roomCallback} = options;
		const {x, y} = targetPos;
		let minX = x - range;
		let minY = y - range;
		let maxX = x + range;
		let maxY = y + range;

		const min = moveOffExit ? 1 : 0;
		const max = moveOffExit ? 48 : 49;
		let adjustEdge = false;
		if (minX < min) {
			minX = min;
			adjustEdge = true;
		}
		if (maxX > max) {
			maxX = max;
			adjustEdge = true;
		}
		if (minY < min) {
			minY = min;
			adjustEdge = true;
		}
		if (maxY > max) {
			maxY = max;
			adjustEdge = true;
		}
		if (!adjustEdge) {
			return [];
		}

		const targetRoomName = targetPos.roomName;
		const terrain = TerrainCache.get(targetRoomName);
		const matrix = roomCallback(targetRoomName);
		const positions = [];
		for (let x = minX; x <= maxX; x++) {
			positions.push({x: x, y: minY, roomName: targetRoomName});
			positions.push({x: x, y: maxY, roomName: targetRoomName});
		}
		for (let y = minY + 1; y <= maxY - 1; y++) {
			positions.push({x: minX, y: y, roomName: targetRoomName});
			positions.push({x: maxX, y: y, roomName: targetRoomName});
		}
		const targets = [];
		for (const pos of positions) {
			const cost = (matrix && matrix.get(pos.x, pos.y)) || terrain.getCost(pos.x, pos.y);
			if (cost < 255) {
				targets.push({pos, range: 0});
			}
		}
		return targets;
	}

	fixPath(path, matrix, roomName) {
		const terrain = TerrainCache.get(roomName);
		const costs = new Array(path.length);
		for (let i = 0; i < path.length; i++) {
			const pos = path[i];
			if (pos.roomName !== roomName) {
				break;
			}
			let cost = matrix.get(pos.x, pos.y) || terrain.getCost(pos.x, pos.y);
			if (
				i >= 2 && cost === 1 &&
				costs[i - 1] !== 1 &&
				costs[i - 2] === 1
			) {
				const lastPos = path[i - 1];
				const last2Pos = path[i - 2];
				for (const {x, y} of this.getAdjacentPositions(pos)) {
					if (x !== lastPos.x || y !== lastPos.y) {
						const dx = x - last2Pos.x;
						const dy = y - last2Pos.y;
						if (
							dx >= -1 && dx <= 1 &&
							dy >= -1 && dy <= 1
						) {
							const cost2 = matrix.get(x, y) || terrain.getCost(x, y);
							if (cost2 === 1) {
								path[i - 1] = new RoomPosition(x, y, roomName);
								cost = 1;
								break;
							}
						}
					}
				}
			}
			costs[i] = cost;
		}
	}

	serializePath(startPos, path) {
		const len = path.length;
		let roomName = len > 0 ? path[0].roomName : startPos.roomName;
		let lastPos = startPos;
		let serializedPath = '';
		for (const pos of path) {
			if (pos.roomName !== roomName) {
				break;
			}
			serializedPath += Utils.getDirection(lastPos, pos);
			lastPos = pos;
		}
		return [serializedPath, lastPos];
	}

	getPathEnd(startPos, path) {
		let pos = startPos;
		for (let i = 0; i < path.length; i++) {
			pos = Utils.offsetPosCoords(pos, +path[i]);
		}
		return pos;
	}


	// cost matrix
	getCostMatrix(roomName, options = {}) {
		let key = MATRIX_LAYER_TERRAIN;
		if (!options.ignoreStructures) {
			key += MATRIX_LAYER_STRUCTURES;
		}
		if (!options.ignoreTunnels) {
			key += MATRIX_LAYER_TUNNELS;
		}
		if (!options.ignoreContainers) {
			if (options.containerCost < options.plainCost) {
				key += MATRIX_LAYER_PREFER_CONTAINERS;
			} else {
				key += MATRIX_LAYER_CONTAINERS;
			}
		}
		if (options.offRoads) {
			key += MATRIX_LAYER_OFF_ROADS;
		} else {
			if (!options.ignoreRoads) {
				key += MATRIX_LAYER_ROADS;
			} else if (options.swampCost > options.plainCost) {
				key += MATRIX_LAYER_SWAMP_ROADS;
			}
		}
		if (key === MATRIX_LAYER_TERRAIN) {
			return;
		}
		let [cache, time] = this.matrixCache.get(roomName) || [];
		if (!cache || Game.time >= time + MATRIX_CACHE_TIME) {
			cache = [undefined, undefined, undefined, undefined, undefined];
			this.matrixCache.set(roomName, [cache, Game.time]);
		}
		if (!cache[key]) {
			const room = Game.rooms[roomName];
			if (room) {
				cache[key] = this.makeStructuresMatrix(room, options)
			}
		}
		return cache[key];
	}


	addHostilesToMatrix(matrix, pos, room, range) {
		Utils.lookInRange(pos, room, LOOK_CREEPS, range).forEach( item => {
			const creep = item.creep;
			if (!creep.my) {
				const {x, y} = creep.pos;
				matrix.setFast(x, y, 255);
			}
		});
		pos.findInRange(FIND_HOSTILE_POWER_CREEPS, range).forEach( creep => {
			const {x, y} = creep.pos;
			matrix.setFast(x, y, 255);
		});
	}

	makeStructuresMatrix(room, options) {
		const {
			offRoads, ignoreRoads, ignoreContainers, ignoreTunnels, ignoreStructures,
			swampCost, plainCost
		} = options;

		const matrix = new PathFinder.CostMatrix();
		const roadCost = offRoads ? 2 : 1;
		const swampRoads = swampCost > plainCost;
		const containerCost = options.containerCost <= 1 ? 1 : 5;

		if (
			!ignoreStructures ||
			!ignoreRoads ||
			!ignoreTunnels ||
			!ignoreContainers ||
			swampRoads
		) {
			const terrain = TerrainCache.get(room.name);
			room.find(FIND_STRUCTURES).forEach( structure => {
				const {x, y} = structure.pos;
				if (structure.structureType === STRUCTURE_ROAD) {
					const cell = terrain.get(x, y);
					if (!ignoreTunnels && (cell & TERRAIN_MASK_WALL)) {
						matrix.setFast(x, y, 1);
					} else if (
						(
							!ignoreRoads ||
							(swampRoads && (cell & TERRAIN_MASK_SWAMP))
						) && matrix.get(x, y) === 0
					) {
						matrix.setFast(x, y, roadCost);
					}
				} else if (structure.structureType === STRUCTURE_CONTAINER) {
					if (!ignoreContainers) {
						matrix.setFast(x, y, containerCost);
					}
				} else if (
					!ignoreStructures && (
						structure.structureType !== STRUCTURE_RAMPART ||
						(!structure.my && !structure.isPublic)
					)
				) {
					matrix.setFast(x, y, 255);
				}
			});
			if (!ignoreStructures) {
				room.find(FIND_MY_CONSTRUCTION_SITES).forEach( construction => {
					if (![STRUCTURE_CONTAINER, STRUCTURE_ROAD, STRUCTURE_RAMPART].includes(construction.structureType)) {
						const {x, y} = construction.pos;
						matrix.setFast(x, y, 255);
					}
				});
			}
		}

		return matrix;
	}

}

const Pathing = new PathingManager();

// uncomment this line to register PathingManager globally
// global.Pathing = Pathing;

module.exports = Pathing;
