(function () {
	//collision+shapes,
		var testShape;
		
		Actor = makeClass(function (spec) {
			var i;
			
			this.pos = spec.pos || Vector.Zero(2);
			
			this.sprites = { };
			if (spec.sprites) {
				for (i in spec.sprites) {
					if (spec.sprites.hasOwnProperty(i)) {
						spec.sprites[i].parent = this;
						this.sprites[i] = new Sprite(spec.sprites[i]);
					}
				}
			}
			this.shapes = { };
			if (spec.shapes) {
				for (i in spec.shapes) {
					if (spec.shapes.hasOwnProperty(i)) {
						spec.shapes[i].parent = this;
						this.shapes[i] = Shape.create(spec.shapes[i]);
					}
				}
			}
			
			if (spec.grid) {
				this.grid = spec.grid;
			}
			
			this.moveQueue = extend([], {
				pushRel: function (vector) {
					this.push({rel: vector});
				},
				pushAbs: function (vector) {
					this.push({abs: vector});
				}
			});
			
			this.top = spec.top || 0;
			this.bottom = spec.bottom || 0;
			this.left = spec.left || 0;
			this.right = spec.right || 0;
			if (spec.attrib) {
				this.extend(spec.attrib);
			}
			
			this.dimAdjust();
		}, {
			sprites: null,
			shapes: null,
			grid: null,
			
			pos: null,
			
			lastMove: null,
			
			//relative location of dimensions
			top: 0,
			bottom: 0,
			left: 0,
			right: 0,
			
			//absolute location of dimensions
			x1: 0,	//left
			y1: 0,	//top
			x2: 0,	//right
			y2: 0,	//bottom
			
			//cells which contain the corners of the entity
			cells: null,
			celltl: null,
			celltr: null,
			cellbl: null,
			cellbr: null,
			
			//METHODS:
			dimAdjust: function () {
				var grid = this.grid,
					gridx1, gridx2, gridy1, gridy2;
				
				//calculate edges
				this.x1 = this.left + this.pos.elements[0];
				this.y1 = this.top + this.pos.elements[1];
				this.x2 = this.right + this.pos.elements[0];
				this.y2 = this.bottom + this.pos.elements[1];
				
				if (this.grid) {
					//match each edge to a row or column on the grid
					gridx1 = grid.getcx(this.x1);
					gridx2 = grid.getcx(this.x2);
					gridy1 = grid.getcy(this.y1);
					gridy2 = grid.getcy(this.y2);
					
					//i could do: if (cell !== ((temp = grid[gridx]) && temp[gridy] || null))
					//but really wouldn't be worth the decline in readability
					
					//top left corner
					if (this.celltl !== (grid[gridx1] && grid[gridx1][gridy1] || null)) {
						if (this.celltl !== null) {
							this.celltl.deregister(this);
						}
						
						this.celltl = (grid[gridx1] && grid[gridx1][gridy1] || null);
						if (this.celltl) {
							this.celltl.register(this);
						}
					}
					
					//bottom left corner
					if (this.cellbl !== (grid[gridx1] && grid[gridx1][gridy2] || null)) {
						if (this.cellbl !== null) {
							this.cellbl.deregister(this);
						}
						
						this.cellbl = (grid[gridx1] && grid[gridx1][gridy2] || null);
						if (this.cellbl) {
							this.cellbl.register(this);
						}
					}
					
					//top right corner
					if (this.celltr !== (grid[gridx2] && grid[gridx2][gridy1] || null)) {
						if (this.celltr !== null) {
							this.celltr.deregister(this);
						}
						
						this.celltr = (grid[gridx2] && grid[gridx2][gridy1] || null);
						if (this.celltr) {
							this.celltr.register(this);
						}
					}
					
					//bottom right corner
					if (this.cellbr !== (grid[gridx2] && grid[gridx2][gridy2] || null)) {
						if (this.cellbr !== null) {
							this.cellbr.deregister(this);
						}
						
						this.cellbr = (grid[gridx2] && grid[gridx2][gridy2] || null);
						if (this.cellbr) {
							this.cellbr.register(this);
						}
					}
				}
			},
			
			getMove: function (emptyQueue) {
				var i, buffer = Vector.Zero(2);
				
				
				this.moveQueue.reverse();
				for (i = this.moveQueue.pop(); i; i = this.moveQueue.pop()) { 
					if (i.rel) {
						buffer = buffer.add(i.rel);
					}
					
					if (i.abs) {
						buffer = i.abs;
					}
				}
				
				if (!emptyQueue) {
					this.moveQueue.push({rel: buffer});
				}
				
				return buffer;
			},
			
			move: function () {
				var dist = this.getMove(true);
				
				this.pos = this.pos.add(dist);
				this.lastMove = dist;
				
				return this.dimAdjust();
			}
		});
		
	//TODO: lineline boxline circleline linepoint, more shapes, return vector+penetration
	
	function testShapes(shape1, shape2, func, checklist) {
		var shapeid1 = shape1.getid(),
			shapeid2 = shape2.getid(),
			key;
		
		//so that there's only one possible key for each combination
		if (shapeid1 < shapeid2) {
			key = shapeid1 + '.' + shapeid2;
		} else {
			key = shapeid2 + '.' + shapeid1;
		}
		
		//check if we've already checked these shapes, then,
		//if there is a collision, inform its actor
		if (!checklist[key] && shape1.isColliding(shape2)) {
			switch(typeof func) {
			case 'function':
				func(shape1, shape2);
				break;
			case 'string':
				if (shape1.parent[func]) {
					shape1.parent[func](shape2);
				}
				if (shape2.parent[func]) {
					shape2.parent[func](shape1);
				}
				break;
			}
		}//end_if
		checklist[key] = true;   //mark that we've tested these shapes
	}
	
	function iterateShapes(list1, list2, func, swapped) {
		var i, j, //iterators
			shape1, shape2, //hold shapes from lists
			checklist = { };  //contains every potential collision tested
							  //used to prevent two objects from colliding muliple times
						
		//we can do fewer tests if we're testing a list against itself
		if (list2) {
			//test every shape in list1 against every shape in list2
			for (i = 0; i < list1.length; i += 1) {
				shape1 = list1[i].data;
				
				for (j = i; j < list2.length; j += 1) {
					shape2 = list2[j].data;
					
					if (!swapped) {
						testShapes(shape1, shape2, func, checklist);
					} else {
						testShapes(shape2, shape1, func, checklist);
					}
				}
			}//end_for
			
		} else {
			//test every possible combination of shapes
			for (i = 0; i+1 < list1.length; i += 1) {
				shape1 = list1[i].data;
				
				for (j = i+1; j < list1.length; j += 1) {
					shape2 = list1[j].data;
					
					if (!swapped) {
						testShapes(shape1, shape2, func, checklist);
					} else {
						testShapes(shape2, shape1, func, checklist);
					}
				}
			}//end_for
			
		}//end_ifelse
	}
	
	function processGroups(grid, group1, group2, func) {
		var i, j, //iterators
			pool,
			cell, 
			list1, list2,
			head;
		
		if (typeof group1 === 'string') {
			pool = group1;
		} else if (typeof group2 === 'string') {
			pool = group2;
		}
		
		if (pool) {
			for (i in grid.pools[pool]) {
				if (grid.pools[pool].hasOwnProperty(i)) {
					//set head to the head of pool's nodes
					cell = grid.pools[pool][i];
					
					if (typeof group1 === 'string') {
						list1 = cell.shapes[group1];
					} else {
						list1 = [{data: group1}];
					}
					
					if (group2 && group1 !== group2) {
						if (typeof group2 === 'string') {
							list2 = cell.shapes[group2];
						} else {
							list2 = [{data: group2}];
						}
						
						if (list1.length <= list2.length) {
							iterateShapes(list1, list2, func, false);
						} else {
							iterateShapes(list2, list1, func, true);
						}
					} else {
						iterateShapes(list1, null, func, false);
					}
					
				}
			}//end_forin
		} else {
			iterateShapes(group1, group2, func, false);
		}
		
	}
	
	CollisionCell = Cell.makeClass(function () {
		this.shapes = {};
		this.shapelist = {};

		Cell.apply(this, arguments);
	}, {
		
		shapes: null,
		shapelist: null,
		
		register: function (obj) {
			var i, shape, pool, id, node;
			
			for (i in obj.shapes) {
				if (obj.shapes.hasOwnProperty(i)) {
					shape = obj.shapes[i];
					pool = shape.pool;
					id = shape.getid();
					
					if (isValue(this.shapelist[id])) {
						node = this.shapes[pool][this.shapelist[id]];
						node.num += 1;
					} else {
						node = {data: shape, num: 1}
						if (!this.shapes[pool]) {
							this.shapes[pool] = [node];
							this.shapelist[id] = 0;
						} else {
							this.shapelist[id] = this.shapes[pool].push(node)-1; 
							//Array::push returns new length of Array 
						}
						
						if (!this.grid.pools[pool]) {
							this.grid.pools[pool] = { };
							this.grid.poolcount[pool] = { count: 0 };
						} 
						if (this.grid.pools[pool][this.getid()]) {
							this.grid.poolcount[pool][this.getid()] += 1;
						} else {
							this.grid.pools[pool][this.getid()] = this;
							this.grid.poolcount[pool][this.getid()] = 1;
							this.grid.poolcount[pool].count += 1;
						}
					}
				}
			}
		},
		
		deregister: function (obj) {
			var i, shape, shapePos, pool, id, node;
			
			for (i in obj.shapes) {
				if (obj.shapes.hasOwnProperty(i)) {
					shape = obj.shapes[i];
					id = shape.getid();
					pool = shape.pool;
					shapePos = this.shapelist[id];
					node = this.shapes[pool][shapePos];
					
					if (node.num > 1) {
						node.num -= 1;
					} else {
						this.shapes[pool].splice(shapePos, 1);
						delete this.shapelist[id];
						
						this.grid.poolcount[pool][this.getid()] -= 1;
						if (this.grid.poolcount[pool][this.getid()] === 0) {
							delete this.grid.pools[pool][this.getid()];
							delete this.grid.poolcount[pool][this.getid()];
							
							this.grid.poolcount[pool].count -= 1;
							if (this.grid.poolcount[pool].count === 0) {
								delete this.grid.pools[pool];
								delete this.grid.poolcount[pool];
							}
						}
					}
				}
			}
		}
	});
	
	CollisionGrid = Grid.makeClass(function (spec) {
		//TODO: subgrids
		
		this.pools = { };
		this.poolcount = { };
		
		this.collisions = [];
		
		if (isValue(spec.context) || isValue(spec.priority)) {
			if (!isValue(spec.context) || !isValue(spec.priority)) {
				throw new Error ('CollsionCell not given context AND priority');
			}
			
			this.subscribeTo(spec.context, spec.priority, spec.trigId);
		}
	
		return Grid.call(this, spec);
	}, {
		cell: CollisionCell,
		
		subgrid: null,
		
		pools: null,
		poolcount: null,
		
		collisions: null,
		
		subscribeTo: function (context, priority, trigId) {
			TRIGGER.subscribe({
				trigger: 'step',
				func: this.step,
				obj: this,
				context: context,
				priority: priority,
				trigId: trigId
			});
		},
		
		unsubscribeFrom: function (trigId) {
			TRIGGER.unsubscribe('step', this.step, trigId);
		},
		
		addCollision: function (pool1, pool2, func) {
			this.collisions.push({
				pool1: pool1,
				pool2: pool2,
				func: func
			});
		},
		removeCollision: function(pool1, pool2) {
			var i; //iterator
			for (i = 0; i<collisions.length; i += 1) {
				if (this.collisions[i].pool1 === pool1 && this.collisions[i].pool2 === pool2) {
					this.collisions.splice(i, 1);
					break;
				}
			}
		},
		getCollisions: function (group1, group2) {
			var collisionList = [ ];
			processGroups(this, group1, group2, collisionList);
			
			return collisionList;
		},
		step: function () {
			var i, //iterator
				pool1, pool2, func; //data from collisions array
			
			for (i = 0; i < this.collisions.length; i += 1) {
				pool1 = this.collisions[i].pool1;
				pool2 = this.collisions[i].pool2;
				func = this.collisions[i].func;
					
				processGroups(this, pool1, pool2, func);
			}
		}
	});
		testShape = {
		
			boxbox: function (a, b) { //hide
				//If any of the sides from shape1 are outside of shape2
				return !(a.bottom <= b.top || a.top >= b.bottom || a.right <= b.left || a.left >= b.right);
			},
			circlecircle: function (a, b) { //hide
				return (Math.sqrt( Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2 ) )) <= (a.radius + b.radius);
				//if the distance between the two points is less than their combined radius,
				//they are intersecting
			},
			lineline: function (a, b) { //hide
				return ;
			},
			pointpoint: function (a, b) { //hide
				return a.x === b.x && a.y === b.y;
			},
			boxcircle: function (a, b) { //hide
				var aX, aY;
				//find closest X offset
				if (b.x <= a.left) {
					aX = a.left;
				} else if (b.x >= a.right) {
					aX = a.right;
				} else {
					aX = b.x;
				}
				//find closest Y offset
				if (b.y <= a.top) {
					aY = a.top;
				} else if (b.y >= a.bottom) {
					aY = a.bottom;
				} else {
					aY = b.y;
				}
				//if closest point is inside the circle, there is collision
				return (Math.sqrt( Math.pow(b.x - aX, 2) + Math.pow(b.y - aY, 2 ) )) <= 0;
			},
			boxline: function (a, b) { //hide
				return ;
			},
			boxpoint: function (a, b) { //hide
				//If any of the sides from shape1 are outside of shape2
				return (a.bottom >= b.y && a.top <= b.y && a.right >= b.x && a.left <= b.x);
			},
			circleline: function (a, b) { //hide
				return ;
			},
			circlepoint: function (a, b) { //hide
				return (Math.sqrt( Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2 ) )) <= 0;
			},
			linepoint: function (a, b) { //hide
				return ;
			}
		};
	
	function getAttrib(shape) {
		var value = { },
			xOffset = shape.parent.pos.getX()+shape.pos.getX(),
			yOffset = shape.parent.pos.getY()+shape.pos.getY();
		
		switch (shape.type) {
		case 'box':
			value.top    = yOffset - (shape.height/2);
			value.bottom = yOffset + (shape.height/2);
			value.left   = xOffset - (shape.height/2);
			value.right  = xOffset + (shape.height/2);
			break;
		case 'circle':
			value.x      = xOffset;
			value.y      = yOffset;
			value.radius = shape.radius;
			break;
		}
		
		return value;
	}
	
	Shape = makeClass(function (spec) {
		this.parent = spec.parent;
		this.pool = spec.pool;
		
		this.pos = spec.pos;
	}, {
		parent: null,
		type: null,
		pool: null,
		
		pos: null,
		
		getPos: function () {
			return this.parent ? this.parent.pos.add(this.pos) : this.pos;
		},
		
		isColliding: function (otherShape) { 
			//select appropriate insection detection algorithm
			//and calculate required variables
			var testName = this.type + otherShape.type;
			
			if (testShape[testName]) {
				return testShape[testName](getAttrib(this), getAttrib(otherShape));
			} else {
				return testShape[otherShape.type + this.type](getAttrib(otherShape), getAttrib(this));
			}
		},
		
		ejectShape: function (other, dXOther, dYOther, dXThis, dYThis) {
			//this function assumes this and otherShape are colliding.
			var dX, dY, xDepth, yDepth;
			//the basic principal is that otherShape should be ejected in either one
			//of the directions it is moving or one one the directions this Shape is moving

			//determine otherShape's movement vector from this Shape's POV)
			dX = dXOther - dXThis;
			dY = dYOther - dYThis;
		
			//determine the depth of penetration for relevant directions 
			if (dY > 0) {		//moving down
				yDepth = this.getTop() - other.getBottom();
			} else if (dY < 0) {//moving up
				yDepth = this.getBottom() - other.getTop();
			}
				
			if (dX > 0) {		//moving right
				xDepth = this.getLeft() - other.getRight();
			} else if (dx < 0) {//moving left
				xDepth = this.getRight() - other.getLeft();
			}
			
			//if moving diagonally, the direction of ejection
			//is the one with the smallest depth of penetration
			if ((dX !== 0) && (dY !== 0)) {
				if (xDepth > yDepth) {
					return {x:0, y:yDepth};
				} else {
					return {x:xDepth, y:0};
				}
			} else {
				return {x:xDepth||0, y:yDepth||0};
			}
		}
	});
	Shape.create = function (spec) {
		switch (spec.type) {
		case 'box':
			return new Box(spec);
			break;
		case 'circle':
			return new Circle(spec);
			break;
		}
	}
	
	Box = Shape.makeClass(function (spec) {
		Shape.call(this, spec);
		this.boundaryBox = this;
		
		this.height = spec.height;
		this.width = spec.width;
	}, {
		type: 'box',
		
		height: 0,
		width: 0,
		
		getTop: function () {
			return this.getPos().getY()-(this.height/2);
		},
		getBottom: function () {
			return this.getPos().getY()+(this.height/2);
		},
		getLeft: function () {
			return this.getPos().getX()-(this.width/2);
		},
		getRight: function () {
			return this.getPos().getX()+(this.width/2);
		}
	});
	
	Circle = Shape.makeClass(function(spec) {
		Shape.call(this, spec);
		this.boundaryBox = new Box({ 
			pool: this.pool,
			pos: this.getPos(),
			height: this.radius,
			width: this.radius
		});
		
		this.radius = spec.radius;
	}, {
		type: 'circle',
		
		radius: 0
	});
}());