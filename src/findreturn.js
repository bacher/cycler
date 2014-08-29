
var _ = require('lodash');

var res = [];
var level = 0;

var parseNode = function(node) {

    if (!node) {
        return;
    }

    if (Array.isArray(node)) {
        node.forEach(function(el) {
            parseNode(el);
        });
        return;
    }

    level++;

    if (findReturn.verbose) {
        console.log('*', new Array(level * 2).join(' '), node.type);
    }

    switch (node.type) {
        case 'Program':
        case 'ForStatement':
        case 'WhileStatement':
        case 'BlockStatement':
            parseNode(node.body);
            break;

        case 'IfStatement':
            parseNode(node.consequent);
            parseNode(node.alternate);
            break;

        case 'TryStatement':
            parseNode(node.block);
            parseNode(node.handlers);
            parseNode(node.finalizer);
            break;

        case 'SwitchStatement':
            parseNode(node.cases);
            break;

        case 'SwitchCase':
            parseNode(node.consequent);
            break;

        case 'ReturnStatement':
            var ret = {
                loc: node.loc
            };

            if (node.argument) {
                if (node.argument.arguments && node.argument.arguments.length ||
                    node.argument.type === 'Literal' ||
                    node.argument.type === 'ObjectExpression') {

                    ret.args = node.argument.loc
                }
            }
            res.push(ret);
            break;
    }

    level--;
};

function findReturn(node) {
    level = 0;

    res = [];

    parseNode(node);

    return res;
}

module.exports = findReturn;
