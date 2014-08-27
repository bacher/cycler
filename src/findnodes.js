
var _ = require('lodash');

/**
 * @typedef {Object} ASTNode
 * @property {string} type
 * @property {Object} [loc]
 * @property {Object|Array} * specific node fields
 */

/**
 * Ищет вхождения нод с задаными типами.
 * @param {ASTNode} rootNode
 * @param {[string]|string} types
 * @param {Object} [options]
 * @param {boolean} [options.localScope=false]
 * @return {Array}
 */
function parse(rootNode, types, options) {
    options = options || {};

    if (!Array.isArray(types)) {
        types = [types];
    }

    if (options.localScope) {
        if (!_.contains(['Program', 'FunctionExpression', 'FunctionDeclaration'], rootNode.type)) {
            throw new Error('Node has not lexical scope');
        }
    }

    var vars = [];
    var level = 0;

    findVars(rootNode);

    return vars;

    function findVars(node) {

        if (Array.isArray(node)) {
            node.forEach(function(el) {
                findVars(el);
            });

            return;
        }

        if (!node || !node.type) {
            return;
        }

        level++;

        if (parse.verbose) {
            console.log(new Array(level).join('  '), node.type);
        }

        if (node !== rootNode && _.contains(types, node.type)) {
            vars.push(node);
        }

        if (options.localScope) {
            if (level > 1 && node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration') {
                return;
            }
        }

        for (var prop in node) {
            if (node.hasOwnProperty(prop) && prop !== 'loc' && prop !== 'type') {
                findVars(node[prop]);
            }
        }

        level--;
    }
}

/**
 * Ищет вхождения нод с задаными типами в локальном контексте.
 * @param {ASTNode} node
 * @param {[string]|string} types
 * @return {Array}
 */
function localParse(node, types) {
    return parse(node, types, { localScope: true });
}

module.exports = {
    parse: parse,
    localParse: localParse
};
