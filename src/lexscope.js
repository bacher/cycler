
var _ = require('lodash');

function parse(node) {

    if (!_.contains(['Program', 'FunctionExpression', 'FunctionDeclaration'], node.type)) {
        throw new Error('Node has not lexical scope');
    }

    var vars = [];
    var level = 0;

    if (node.type === 'FunctionExpression') {
        node.params.forEach(function(param) {
            if (param.type === 'Identifier') {
                vars.push(param.name);
            }
        });
    }

    findVars(node, true);

    return vars;

    function findVars(node, isRoot) {
        if (!node) {
            return;
        }

        if (Array.isArray(node)) {
            node.forEach(function(el) {
                findVars(el);
            });

            return;
        }

        level++;

        if (parse.verbose) {
            console.log(new Array(level).join('  '), node.type);
        }

        switch (node.type) {
            case 'Identifier':
                vars.push(node.name);
                break;

            case 'VariableDeclaration':
                findVars(node.declarations);
                break;

            case 'VariableDeclarator':
                findVars(node.id);
                break;

            case 'ForStatement':
                findVars(node.init);
                findVars(node.body);
                break;

            case 'WhileStatement':
            case 'BlockStatement':
                findVars(node.body);
                break;

            case 'IfStatement':
                findVars(node.consequent);
                findVars(node.alternate);
                break;

            case 'TryStatement':
                findVars(node.block);
                findVars(node.handlers);
                findVars(node.finalizer);
                break;

            case 'CatchClause':
                findVars(node.param);
                findVars(node.body);
                break;

            case 'Program':
                if (isRoot) {
                    findVars(node.body);
                }
                break;

            case 'FunctionExpression':
            case 'FunctionDeclaration':
                if (isRoot) {
                    findVars(node.params);
                    findVars(node.body);
                } else {
                    findVars(node.id);
                }
                break;

            case 'SwitchStatement':
                findVars(node.cases);
                break;

            case 'SwitchCase':
                findVars(node.consequent);
                break;

            case 'ForInStatement':
                findVars(node.left);
                findVars(node.body);
                break;

            case 'CallExpression':
            case 'ReturnStatement':
            case 'AssignmentExpression':
            case 'Literal':
            case 'UnaryExpression':
            case 'ThrowStatement':
            case 'BreakStatement':
            case 'ContinueStatement':
            case 'ObjectExpression':
            case 'UpdateExpression':
            case 'ExpressionStatement':
                break;

            default:
                if (node.type) {
                    console.warn('[LEX: Unknown node type]', node.type);
                } else {
                    console.warn('[LEX: Unknown node]', node);
                }
        }

        level--;
    }
}

module.exports.parse = parse;
