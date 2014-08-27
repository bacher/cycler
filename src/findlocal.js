
var _ = require('lodash');

/**
 * Ищет вхождения нод с задаными типами в локальном контексте.
 * @param {ASTNode} node
 * @param {[string]|string} types
 * @return {Array}
 */
function parse(node, types) {

    if (!Array.isArray(types)) {
        types = [types];
    }

    if (!_.contains(['Program', 'FunctionExpression', 'FunctionDeclaration'], node.type)) {
        throw new Error('Node has not lexical scope');
    }

    var vars = [];
    var level = 0;

    findVars(node);

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

        if (_.contains(types, node.type)) {
            vars.push(node);
            return;
        }

        if (level > 1 && node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration') {
            return;
        }

        for (var prop in node) {
            if (node.hasOwnProperty(prop) && prop !== 'loc' && prop !== 'type') {
                findVars(node[prop]);
            }
        }

        level--;
    }
}

module.exports.parse = parse;
