
var _ = require('lodash');

var level = 0;

var parseNode = function(node) {

    level++;

    var res = [];

    if (!node) {
        debugger
    }

    if (Array.isArray(node)) {
        node.forEach(function(el) {
            res.push(parseNode(el));
        });

        return;
    }

    if (findReturn.verbose) {
        console.log('*', new Array(level * 2).join(' '), node.type);
    }

    switch (node.type) {
        case 'Program':
        case 'ForStatement':
        case 'WhileStatement':
        case 'BlockStatement':

            [].concat(node.body).forEach(function(node) {
                res.push(parseNode(node));
            });
            break;

        case 'CallExpression':
            node.arguments.forEach(function(node) {
                res.push(parseNode(node));
            });

            // Сюда надо заходить?
            if (node.callee.type === 'FunctionExpression') {
                res.push(parseNode(node.callee.body));
            }
            break;

        case 'IfStatement':
            res.push(parseNode(node.consequent));

            if (node.alternate) {
                res.push(parseNode(node.alternate));
            }
            break;

        case 'VariableDeclaration':
            node.declarations.forEach(function(node) {
                res.push(parseNode(node));
            });
            break;

        case 'VariableDeclarator':
            if (node.init) {
                res.push(parseNode(node.init));
            }
            break;

        case 'AssignmentExpression':
            res.push(parseNode(node.right));
            break;

        case 'ObjectExpression':
            node.properties.forEach(function(node) {
                res.push(parseNode(node));
            });
            break;

        case 'Property':
            res.push(parseNode(node.value));
            break;

        case 'ExpressionStatement':
            res.push(parseNode(node.expression));
            break;

        case 'ReturnStatement':
            res = {
                loc: node.loc
            };

            if (node.argument) {
                if (node.argument.arguments && node.argument.arguments.length ||
                    node.argument.type === 'Literal' ||
                    node.argument.type === 'ObjectExpression') {

                    res.args = node.argument.loc
                }
            }
            break;

        case 'FunctionExpression':
        case 'FunctionDeclaration':
        case 'BinaryExpression':
        case 'MemberExpression':
        case 'ArrayExpression':
        case 'Identifier':
        case 'Literal':
            break;

        default:
            if (node.type) {
                console.warn('[FINDRETURN: Unknown node type]', node.type);
            } else {
                console.warn('[FINDRETURN: Unknown node]', node);
            }
    }

    level--;

    return res;

};

function findReturn(node) {
    level = 0;
    return _(parseNode(node)).flatten().compact().value();
}

module.exports = findReturn;
