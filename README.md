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
* Prefer pushed creeps be closer to target stay in ragne of target if working (by providing `getCreepWrokingTarget` callback)
* Caching of terrain and cost matrices
* Possibility to run moves by room

# Not implemented (maybe will be in a future)

* Hostile avoidance (not just local avoidance)
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
		return Pathing.moveTo(target, options);
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
	return Pathing.moveTo(target, options);
};
PowerCreep.prototype.travelTo = Creep.prototype.travelTo;
*/

module.exports.loop = function() {

	// issuing moves
	const pos = Game.flags['flag1'].pos;
	Game.creeps['creep1'].travelTo(pos, {range: 1, priority: 5});

	const pos2 = Game.flags['flag2'].pos;
	Game.creeps['creep2'].travelTo(pos2, {range: 1});

	// running all creep moves
	Pathing.runMoves();
};
```

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

## Pathing.moveTo(target, options)

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

Default: 1

Find path to position that is in specified range of a target.
Supports set range to 0 for unpathable target. In that case range 1 will be used and add target position to the end of the path.


### `priority`

Default: 0

Priority for creep movement. Movement for creep with higher priority is preferred, lower priority creeps will be pushed away if possible (this can happen in a sequence). Can accept negative values.


### `moveOffExit`

Default: true

Forces path finish position to be on non-exit tile. Only works if specified `range` is more than zero.
Can be turned off.


### `visualizePathStyle`

Default: undefined

Works as original option.
But additional line is displaying from path end to target position using same style but with changed color to light blue.


### `ignoreStructures`

Default: false


### `ignoreRoads`

Default: false


### `offRoads`

Default: false


### `ignoreTunnels`

Default: false


### `ignoreContainers`

Default: false


### `plainCost`

Default: `(ignoreRoads || offRoads) ? 1 : 2`

Can be overwritten with another value.
Works as original option.


### `swampCost`

Default: `(ignoreRoads || offRoads) ? 5 : 10`

Can be overwritten with another value.
Works as original option.


### `containerCost`

Default: 5

Pathing cost for container. Only works if `ignoreContainers` is not set. Default value helps to avoid potential creeps that are working there.
If set to 1 useful to prioritize container when generating path to a source.


### `costCallback(roomName, matrix)`

Default: undefined

Works as original option.


### `heuristicWeight`

Default: `offRoads ? 1 : 1.2`

Can be overwritten with another value.
Works as original option.


### `maxOps`

Default: 2000

Works as original option.


### `maxRooms`

Default: 16

Works as original option.


### `flee`

Default: false

Should work as original option (but have not tested).

