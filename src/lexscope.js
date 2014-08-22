
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

    findVars(node);


    return vars;

    function findVars(node) {
        if (!node) {
            return;
        }

        level++;

        if (parse.verbose) {
            console.log(new Array(level).join('  '), node.type);
        }

        switch (node.type) {
            case 'VariableDeclaration':
                node.declarations.forEach(function(decl) {
                    if (decl.id.type === 'Identifier') {
                        vars.push(decl.id.name);
                    }
                });
                break;

            case 'ForStatement':
                findVars(node.init);
                findVars(node.body);
                break;

            case 'WhileStatement':
                findVars(node.body);
                break;

            case 'IfStatement':
                findVars(node.consequent);
                findVars(node.alternate);
                break;

            case 'Program':
            case 'BlockStatement':
                node.body.forEach(function(expr) {
                    findVars(expr);
                });
                break;

            case 'FunctionExpression':
                findVars(node.body);
                break;

            case 'ExpressionStatement':
                findVars(node.expression);
                break;

            case 'CallExpression':
            case 'ReturnStatement':
            case 'AssignmentExpression':
                break;

            default:
                console.log('[Lex: Unknown node]', node.type);
        }

        level--;
    }
}

module.exports.parse = parse;
