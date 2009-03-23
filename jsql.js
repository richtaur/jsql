/**
 * JavaScript Query Language v0.1
 * Provides a query layer for interacting with the DOM
 * Matt Hackett 2009 scriptnode.com
 */
JSQL = (function() {

	// Constants (sort of)
	var BODIES = ['body', 'document', 'document.body'],
		CONDITIONAL_EQUALS = 1,
		CONDITIONAL_NOT_EQUAL = 2;

	// debug gets called but does nothing by default. Set with setDebug()
	var debug = function() {};

	/**
	 * Does a very basic check to see if a value is in an array (cannot use indexOf; not cross-browser yet)
	 * @param {Array} arr The array to look in
	 * @param {Mixed} val The value to check
	 * @return {Mixed} The index of the value or -1 on failure
	 * @member JSQL
	 * @private
	 */
	var inArray = function(arr, val) {

		var i,
			len = arr.length;

		for (i = 0; i < len; i++) {
			if (arr[i] === val) {
				return i;
			}
		}

		return -1;

	};

	/**
	 * Executes a JSQL query
	 * @param {String} qry The query to execute
	 * @return {Object} An object with two keys (error is true or false) which changes based on request type.
	 * Returns either the affected elements (count for UPDATE), number of affected elements (count for DELETE), or the requested elements themselves (elements, an array, for SELECT)
	 * @member JSQL
	 * @public
	 */
	var query = function(qry) {

		var index = 0,
			operation = {
				parsedTargets : [],
				targets : {},
				type : '',
				values : [],
				where : []
			},
			query,
			result = {
				each : function(fn) {

					for (var i = 0; i < this.elements.length; i++) {
						fn.call(this.elements[i]);
					}

					return this;

				},
				error : false
			};

		/**
		 * Executes a DELETE query -- removes selected nodes from the DOM
		 * @private
		 */
		var execDelete = function() {

			var c, el,
				len = operation.parsedTargets.length;

			result.count = 0;
			result.elements = [];

			for (c = 0; c < len; c++) {

				el = operation.parsedTargets[c];

				if (el && el.parentNode) {
					el.parentNode.removeChild(el);
					result.count++;
					result.elements.push(el);
				}

			}
		};

		/**
		 * Executes the query based on the operation object
		 * @private
		 */
		var execQuery = function() {

			if (result.error) {
				return;
			}

			if (operation.type == 'DELETE') {
				execDelete();
			} else if (operation.type == 'SELECT') {
				execSelect();
			} else if (operation.type == 'UPDATE') {
				execUpdate();
			}

		};

		/**
		 * Executes a SELECT query -- returns selected nodes
		 * @private
		 */
		var execSelect = function() {

			var c, el,
				len = operation.parsedTargets.length;

			result.count = 0;
			result.elements = [];

			for (c = 0; c < len; c++) {

				el = operation.parsedTargets[c];

				if (el) {
					result.elements.push(el);
				}

			}

			result.count = result.elements.length;

		};

		/**
		 * Executes an UPDATE query -- alters selected nodes
		 * @private
		 */
		var execUpdate = function() {

			var c, el, i,
				len = operation.parsedTargets.length;

			result.count = 0;
			result.elements = [];

			for (c = 0; c < len; c++) {

				el = operation.parsedTargets[c];

				for (i = 0; i < operation.values.length; i++) {
					if (el) {

						var val = operation.values[i],
							dots = val.key.split('.');

						// (Half-assed) support for style., parentNode., etc attributes
						if (dots.length == 2) {
							debug('Setting "' + val.key + '" to "' + val.value + '"', el);
							el[dots[0]][dots[1]] = val.value;
						} else {
							debug('Setting "' + val.key + '" to "' + val.value + '"', el);
							el[val.key] = val.value;
						}

						result.count++;
						result.elements.push(el);

					}
				}

			}

		};

		/**
		 * Format the query into a usable format (array, split properly)
		 * Stores the value into query for use by other methods
		 * @param {String} qry The query to format
		 * @private
		 */
		var formatQuery = function(qry) {

			// These split up words for easy parsing
			var splits = [
				' ',
				'=',
				','
			];

			var escs = ['"', "'"]; // These encapsulate strings that ignore splits

			var c, cut,
				esc = false,
				len = qry.length,
				word = '',
				words = [];

			for (var i = 0; i <= len; i++) {

				c = qry.substr(i, 1);
				cut = true;

				if (esc) {
					if (c == esc) {
						c = '';
						esc = false;
					} else {
						cut = false;
					}
				} else if (inArray(escs, c) > -1) {
					if (qry.substr(i + 1, 1) == c) {
						// We have an empty string '', "" (intentional)
						c = false;
						cut = true;
						word = false;
						i++;
						words.push('');
					} else {
						cut = false;
						esc = c;
						c = '';
					}
				} else if (inArray(splits, c) > -1) {
					if (c == ' ') {
						c = false;
					}
				} else {
					cut = false;
				}

				if (c) {
					word += c;
				}

				if (cut) {
					if (word) {
						words.push(word);
					}
					word = '';
				}

			}

			query = words;

		};

		/**
		 * Out of the targets in the query, find out which ones match the WHERE clause
		 */
		var getParsedTargets = function() {

			if (result.error) {
				return;
			}

			var c, el,
				els = getTargets(),
				len = els.length,
				operate, w, where;

			for (c = 0; c < len; c++) {

				el = els[c];
				operate;

				if (el) {

					operate = true;

					if (operation.where) {
						for (w = 0; w < operation.where.length; w++) {

							where = operation.where[w];

							if (where.type == CONDITIONAL_EQUALS) {

								debug('Checking if (' + where.key + ' = "' + where.value + '") => ' + el[where.key], el);

								if (el[where.key] != where.value) {
									operate = false;
									break;
								}

							} else if (where.type == CONDITIONAL_NOT_EQUAL) {
								if (el[where.key] == where.value) {
									operate = false;
									break;
								}
							}

						}
					}

					if (operate) {
						operation.parsedTargets.push(el);
					}

				}

			}

		};

		/**
		 * Gets the targets and their children
		 * @return {Array} The array of nodes within the selector
		 */
		var getTargets = function() {

			var c, children, cLen,
				els = [],
				i,
				len = operation.targets.length;

			for (i = 0; i < len; i++) {

				children = operation.targets[i].getElementsByTagName('*');
				cLen = children.length;

				for (c = 0; c < cLen; c++) {
					els.push(children[c]);
				}

			}

			return els;

		};

		/**
		 * Checks to see if an index exists in query before accessing its value
		 * @param {Number} sel The index to check
		 * @return {Mixed} The value of the index or false on failure
		 * @private
		 */
		var getWord = function(sel) {

			if (query[sel]) {
				return query[sel];
			}

			return false;

		};

		/**
		 * Parses the query itself, plopping the results into the operation object
		 * @private
		 */
		var parseQuery = function() {

			var type = query[0].toUpperCase();

			if (type == 'DELETE') {

				var word = getWord(1);

				if (word && (word.toUpperCase() == 'FROM')) {

					operation.targets = parseTargets(2);
					operation.where = parseWhere();

				} else {

					result.error = 'Syntax error. Expected FROM, got ' + word;

					return;

				}

			} else if (type == 'SELECT') {

				var word1 = getWord(1),
					word2 = getWord(2);

				if (word1 && (word1 == '*')) {
					if (word2 && (word2.toUpperCase() == 'FROM')) {
						operation.targets = parseTargets(3);
						operation.where = parseWhere();
					} else {
						result.error = 'Syntax error. Expected FROM, got ' + word;
						return;
					}
				} else {
					result.error = 'Syntax error. Expected *, got ' + word;
					return;
				}


			} else if (type == 'UPDATE') {

				operation.targets = parseTargets(1);
				operation.values = parseValues();
				operation.where = parseWhere();

				debug('Operation: ', operation);

			} else {

				result.error = 'Unknown command ' + getWord(0);
				return;

			}

			operation.type = type;

		};

		/**
		 * Parse the targets out of the query (eg, UPDATE #my-form)
		 * @param {Number} start The index of the starting point in query
		 * @return {Object} The captured element
		 * @private
		 */
		var parseTargets = function(start) {

			index = start;

			var sel = getWord(index),
				error = 'Unknown target ' + sel;

			if (sel) {

				var c = sel.substr(0, 1);

				// By id?
				if (c == '#') {

					var el = document.getElementById(sel.substr(1, sel.length));

					if (el) {

						index++;

						return [el];

					}


				// The entire body?
				} else if (inArray(BODIES, sel) > -1) {

					index++;

					return [document.body];

				}

			}

			result.error = error;

		};

		/**
		 * Parse the values of the query (eg, SET key = 'value')
		 * @return {Object} The values in key/value pair
		 */
		var parseValues = function() {

			var qry = getWord(index),
				values = [];

			if (qry.toUpperCase() == 'SET') {

				index++;

				while ((index < query.length) && query[index].toUpperCase() != 'WHERE') {

					var
						key = query[index++],
						eq = query[index++],
						value = query[index++];

					if (eq != '=') {
						result.error = 'Expected =, got ' + eq;
						return;
					}

					if (value === 'false') {
						value = false;
					} else if (value === undefined) {
						value = '';
					}

					values.push({
						key : key,
						value : value
					});

				};

				return values;

			} else {
				result.error = 'Expected SET, got ' + query[index];
			}

		};

		/**
		 * Parses the WHERE clause of the query
		 * @return {Object} The key/value where object
		 * @private
		 */
		var parseWhere = function() {

			if (result.error || !query[index]) {
				return [];
			}

			if (query[index].toUpperCase() == 'WHERE') {

				var where = [];
				index++;

				while ((index < query.length) && (query[index].toUpperCase() != 'LIMIT')) {

					var key = query[index++],
						cond = query[index++],
						value = query[index++];

					if (cond == '=') {
						type = CONDITIONAL_EQUALS;
					} else if (cond == '!=') {
						type = CONDITIONAL_NOT_EQUAL;
					} else {
						result.error = 'Unknown conditional "' + eq + '"';
						return;
					}

					where.push({
						key : key,
						type : type,
						value : value || ''
					});

				};

				return where;

			}

		};

		formatQuery(qry);
		parseQuery();
		getParsedTargets();
		execQuery();

		return result;

	};

	/**
	 * Sets the private debug method to something useful
	 * @param {Function} The function to call to handle debug messages
	 * @public
	 */
	query.setDebug = function(fn) {
		debug = fn;
	};

	return query;

})();
