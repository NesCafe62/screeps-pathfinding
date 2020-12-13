A pathfinding solution for screeps. Inspired by Traveler.


# Installation

Copy `pathing.js` and `pathing.utils.js` into your screeps brunch directory.


# Implemented features

* Most options that original `creep.moveTo` supports
* Traffic management (push creeps out of the way or swap with them)
* Priority option (higher priority moves will execute first)
* Power creeps support
* Move off exit (enabled by default, can be turned off)
* Fix path (for heuristicHeight > 1, can be turned off)
* `onRoomEnter` event
* Avoid rooms list (specified globally or by options)
* Prefer pushed creeps move closer to target or stay in range of target if working
* Caching of terrain and cost matrices
* Possibility to run moves by room


# Not implemented (maybe will be in a future)

* Find route with whitelist of rooms for more efficient long range movement
* Fix behavior when `moveTo` as called multiple times for creep during the tick (should overwrite previous)
* Hostile avoidance (not just local avoidance)
* Swap with slow moving creep (> 1 ticks per tile) if it moves the same direction
* Support for multiple targets
* Reuse current path when stepped off path (instead of searching path again)
* Option to force check blocked creeps each tick (more precise, but more CPU cost)
* Fix the issue with deadlock. Rarely happen when creeps issue moves in specific order if they use same priority. Workaround: use different priority for creeps targeted to specific job compare to those that are returning back


# Usage

Note: By default pathfinder uses `range: 1`.

(Can change this value in the configuration section of `pathing.js`, at the bottom: `const DEFAULT_RANGE = ...`)

```js
const Pathing = require('pathing');

module.exports.loop = function() {

	// issuing moves
	const pos = Game.flags['flag1'].pos;
	const creep1 = Game.creeps['creep1'];
	if (creep1.moveTo(pos, {range: 1, priority: 5}) === IN_RANGE) {
		// do work
	}

	const pos2 = Game.flags['flag2'].pos;
	const creep2 = Game.creeps['creep2'];
	if (creep2.moveTo(pos2, {range: 1}) === IN_RANGE) {
		// do work
	}

	// running all creep moves
	Pathing.runMoves();
};
```

Note: Ensure you use higher priority for miners like `priority: 5`, especially if they are slow (moving 1 tile per multiple ticks on road).


## Move to room
```js
const creep1 = Game.creeps['creep1'];
if (creep1.moveToRoom('E30N30') === IN_ROOM) {
	// search target logic, move and work
}
```


## Clearing working target

When creep stopped working call `clearWorkingTarget` (maybe not needed if you use own implementation of `getCreepWorkingTarget`).

This will prevent traffic manager from pushing the creep towards it's last target if creep is not working anymore.

```js
const creep1 = Game.creeps['creep1'];
creep1.clearWorkingTarget();
```

## Seaching path

Using `containerCost: 1` will make existing containers be same cost `1` as default for roads.

```js
const path = Pathing.findPath(remoteSourcePos, room.storage.pos, {
	heuristicWeight: 1,
	maxOps: 6000,
	containerCost: 1
});
// result: array of RoomPosition-s
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


## Configuration

There is a configuration section at the bottom of `pathing.js` file.

Feel free to change the values of `DEFAUL_RANGE`, `DEFAUL_PATH_STYLE` and `getCreepWorkingTarget` implementation.

```js
// default visualize path style:
const DEFAUL_PATH_STYLE = {stroke: '#fff', lineStyle: 'dashed', opacity: 0.5};

// default range:
const DEFAUL_RANGE = 1;

const Pathing = new PathingManager({

	// list of rooms to avoid globally:
	/* avoidRooms: [], */

	// this event will be called every time creep enters new room:
	/* onRoomEnter(creep, roomName) {
		console.log(`Creep ${creep.name} entered room ${roomName}`);
	}, */

	// manager will use this function to make creeps stay in range of their target
	getCreepWorkingTarget(creep) {
		const target = creep.memory._t;
		if (!target) {
			return;
		}
		const [x, y, roomName] = target.pos;
		return {
			pos: new RoomPosition(x, y, roomName),
			range: target.range,
			priority: target.priority,
		};
	}

});
```


## Pathing.moveTo(target, ?options)

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

Default (in constructor argument): `undefined`

Note: configuration section contains default implementation of `getCreepWorkingTarget`. You can change it to preferred one.

Shuold return an object with target info `{pos, range, ?priority}`. Will be used for push creeps or avoiding obstacles movement to prioritize positions that are in rnage of the target if creep moves towards it or works near it. If priority is not set or undefined will always be pushed if other creep will try to move there.
In case of no target to prefer return `undefined` or `false`.
