
module.exports.parse = function(node) {

    if (['FunctionExpression', 'FunctionDeclaration', 'Program'].indexOf(node.type) === -1) {
        throw new Error('Node has not lexical scope');
    }

    var vars = [];

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
        }
    }
};
