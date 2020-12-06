A pathfinding solution for screeps. Inspired by Traveler.

#Installation

Copy `pathing.js` and `pathing.utils.js` into your screeps brunch directory.

##Implemented features

* All options that original `creep.moveTo` has
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

##Not implemented (maybe will be in a future)

* Hostile avoidance (not just local avoidance)
* Support for multiple targets
* Fix the issue with deadlock. Rarely happend when creeps issue moves in specific order if they use same priority. Workaround - use different priority for creeps targeted to specific job compare to those that are returning back

# Usage

```js
const Pathing = require('pathing');

const PATH_STYLE = {stroke: '#fff', lineStyle: 'dashed', opacity: 0.5};

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
