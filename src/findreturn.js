
var parseNode = module.exports = function(node) {

    var res = [];

    switch (node.type) {
        case 'ForStatement':
        case 'WhileStatement':
        case 'BlockStatement':
            node.body.forEach(function(node) {
                res = res.concat(parseNode(node));
            });
            break;
        case 'CallExpression':
            node.arguments.forEach(function(el) {
                res = res.concat(parseNode(el));
            });

            // Сюда надо заходить?
            if (node.callee.type === 'FunctionExpression') {
                res = res.concat(parseNode(node.callee.body));
            }
            break;
        case 'IfStatement':
            res = res.concat(parseNode(node.consequent));
            if (node.alternate) {
                res = res.concat(parseNode(node.alternate));
            }
            break;
        case 'VariableDeclaration':
            node.declarations.forEach(function(el) {
                res = res.concat(parseNode(el));
            });
            break;
        case 'VariableDeclarator':
            res = res.concat(parseNode(node.init));
            break;
        case 'AssignmentExpression':
            res = res.concat(parseNode(node.right));
            break;
        case 'ObjectExpression':
            node.properties.forEach(function(prop) {
                res = res.concat(parseNode(prop));
            });
            break;
        case 'Property':
            res = res.concat(parseNode(node.value));
            break;
        case 'ExpressionStatement':
            res = res.concat(parseNode(node.expression));
            break;
        case 'ReturnStatement':
            var ret = {
                loc: node.loc
            };

            if (node.argument && node.argument.arguments.length) {
                ret.args = node.argument.loc
            }

            return ret;

        // Skip:
        case 'FunctionExpression':
        case 'FunctionDeclaration':
    }

    return res;

};
