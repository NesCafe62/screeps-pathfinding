A pathfinding solution for screeps. Inspired by Traveler.


# Installation

Copy `pathing.js` and `pathing.utils.js` into your screeps brunch directory.


# Implemented features

* Most options that original `creep.moveTo` supports
* Traffic management (push creeps out of the way or swap with them)
* Priority option (priority moves will execute first)
* Power creeps support
* Move off exit (enabled by default, can be turned off)
* Fix path (for heuristicHeight > 1, can be turned off)
* Room enter event (by providing `onRoomEnter` callback)
* Avoid rooms list (specified globally or by options)
* Prefer pushed creeps be closer to target and stay in range of target if working (by providing `getCreepWorkingTarget` callback)
* Caching of terrain and cost matrices
* Possibility to run moves by room


# Not implemented (maybe will be in a future)

* Find route with whitelist of rooms for more efficient long range movement
* Hostile avoidance (not just local avoidance)
* Swap with slow moving creep (> 1 ticks per tile) if it moves the same direction
* Support for multiple targets
* Fix the issue with deadlock. Rarely happend when creeps issue moves in specific order if they use same priority. Workaround - use different priority for creeps targeted to specific job compare to those that are returning back


# Usage

```js
const Pathing = require('pathing');

const PATH_STYLE = {stroke: '#fff', lineStyle: 'dashed', opacity: 0.5};

if (!Creep.prototype.originalMoveTo) {
	Creep.prototype.originalMoveTo = Creep.prototype.moveTo;
	Creep.prototype.moveTo = function(target, defaultOptions = {}) {
		const options = {
			range: 1,
			visualizePathStyle: PATH_STYLE,

			// then this:
			...defaultOptions,

			// or this (convenient way of providing role specific move options):
			// ...CreepRoles[this.memory.role].getMoveOptions(defaultOptions)
		};
		return Pathing.moveTo(this, target, options);
	};
}
if (!PowerCreep.prototype.originalMoveTo) {
	PowerCreep.prototype.originalMoveTo = PowerCreep.prototype.moveTo;
	PowerCreep.prototype.moveTo = Creep.prototype.moveTo;
}

// or this way (if you don't want to replace original moveTo):
/*
Creep.prototype.travelTo = function(target, defaultOptions = {}) {
	const options = {
		range: 1,
		visualizePathStyle: PATH_STYLE,

		// then this:
		...defaultOptions,

		// or this (convenient way of providing role specific move options):
		// ...CreepRoles[this.memory.role].getMoveOptions(defaultOptions)
	};
	return Pathing.moveTo(this, target, options);
};
PowerCreep.prototype.travelTo = Creep.prototype.travelTo;
*/

module.exports.loop = function() {

	// issuing moves
	const pos = Game.flags['flag1'].pos;
	Game.creeps['creep1'].moveTo(pos, {range: 1, priority: 5}); // or travelTo if not overrided moveTo

	const pos2 = Game.flags['flag2'].pos;
	Game.creeps['creep2'].moveTo(pos2, {range: 1}); // or travelTo if not overrided moveTo

	// running all creep moves
	Pathing.runMoves();
};
```

> Mote: You can modify default values for `options` inside Creep.prototype.moveTo. If you want them to be applied for all `moveTo` calls. But still remain possiility to be overrided if passed explicitely to `moveTo`.


## Running moves by room

```js
module.exports.loop = function() {

	// issuing moves
	// ...

	// run for one room
	Pathing.runMovesRoom('E30N30');
	
	// run for another room
	Pathing.runMovesRoom('E31N30');
	
	// cleanup moves
	Pathing.cleanup();
};
```


## moveTo(target, ?options)

### `target`

RoomPosition or object with `pos` RoomPosition property


## Options

Not includes this options from original `creep.moveTo`:
* `reusePath`
* `serializeMemory`
* `noPathFinding`
* `ignoreCreeps`
* `ignoreDestructibleStructures` (renamed to `ignoreStructures`)
* `ignore`
* `avoid`


### `range`

Default: `1`

Find path to position that is in specified range of a target.
Supports set range to `0` for unpathable target. In that case range `1` will be used and add target position to the end of the path.


### `priority`

Default: `0`

Priority for creep movement. Movement for creep with higher priority is preferred, lower priority creeps will be pushed away if possible (this can happen in a sequence). Can accept negative values.


### `moveOffExit`

Default: `true`

Forces path finish position to be on non-exit tile. Only works if specified `range` is greater than `0`.
Can be turned off.


### `visualizePathStyle`

Default: `undefined`

Works as original option.
But additional line is displaying from path end to target position using same style but with changed color to light blue.


### `avoidRooms`

Default: `[]`

Exclude rooms from pathfinding completely. Creeps will not enter these rooms.


### `ignoreStructures`

Default: `false`


### `ignoreRoads`

Default: `false`


### `offRoads`

Default: `false`


### `ignoreTunnels`

Default: `false`


### `ignoreContainers`

Default: `false`


### `plainCost`

Default: `(ignoreRoads || offRoads) ? 1 : 2`

Can be overwritten with another value.
Works as original option.


### `swampCost`

Default: `(ignoreRoads || offRoads) ? 5 : 10`

Can be overwritten with another value.
Works as original option.


### `containerCost`

Default: `5`

Pathing cost for container. Takes no effect `ignoreContainers` is set. Default value helps to avoid potential creeps that are working there.
If set to 1 useful to prioritize container when generating path to a source.


### `costCallback(roomName, matrix)`

Default: `undefined`

Works as original option.


### `heuristicWeight`

Default: `offRoads ? 1 : 1.2`

Can be overwritten with another value.
Works as original option.


### `fixPath`

Default: `true`

If set, fixes the path after finding (those annoying one tile step out of the road on turns). Only does it for one current room, so relatively cheap.
Takes no effect if `heuristicWeight` is `1` or `ignoreRoads` is set or `offRoads` is set or resulting path length is `3` or shorter.
Can be turned off.


### `maxOps`

Default: `2000`

Works as original option.


### `maxRooms`

Default: `16`

Works as original option.


### `maxCost`

Default: `undefined`

Works as original option.


### `flee`

Default: `false`

Should work as original option (but have not tested).


## Constructor options

### `avoidRooms`

Default: `[]`

Rooms thats should be excluded from pathfinding. Same as `PathingManager.moveTo` `avoidRooms` option but global. In case of both options are set (in `PathingManager.moveTo` and constructor) array will be concatenated and used both sets of rooms to be excluded.


### `onRoomEnter(creep, roomName)`

Default: `undefined`

If specified will be called when creep enters a new room (different from previous position).
For example can be used for check if hostiles are in the room, or check if need to be added in healCreeps array to be healed by towers.


### `getCreepWorkingTarget(creep)`

Default: `undefined`

Shuold return an object with target info `{pos, range, ?priority}`. Will be used for push creeps or avoiding obstacles movement to prioritize positions that are in rnage of the target if creep moves towards it or works near it. If priority is not set or undefined will always be pushed if other creep will try to move there.
In case of no target to prefer return `undefined` or `false`.


Example:
```js
if (!Creep.prototype.originalMoveTo) {
	Creep.prototype.originalMoveTo = Creep.prototype.moveTo;
	Creep.prototype.moveTo = function(target, defaultOptions = {}) {
		const options = {
			range: 1,
			visualizePathStyle: PATH_STYLE,
			...defaultOptions,
			// ...CreepRoles[this.memory.role].getMoveOptions(defaultOptions)
		};
		const targetPos = target.pos || target;
		this.memory.target = {
			pos: [targetPos.x, targetPos.y, targetPos.roomName],
			// or can use object (but with array a bit shorter):
			// pos: {x: targetPos.x, y: targetPos.y, roomName: targetPos.roomName},
			range: options.range,
			priority: options.priority // if undefined, will be skipped in serialization
		};
		return Pathing.moveTo(this, target, options);
	};
}

// after creep finished working do (in role code or wherever it is):
creep.memory.target = undefined;

const Pathing = new PathingManager({
	getCreepWorkingTarget(creep) {
		const target = creep.memory.target;
		if (!target) {
			return;
		}
		const [x, y, roomName] = target.pos;
		// in case of object:
		// const {x, y, roomName} = target.pos;
		return {
			pos: new RoomPosition(x, y, roomName),
			range: target.range,
			priority: target.priority,
		};
	}
});
```

Despite saving target data in creep's memory is not so great solution for performance. So if you already store target into in creep's memory can just use it in `getCreepWorkingTarget` function
