
var _ = require('lodash');
var esprima = require('esprima');
var FragUtils = require('./fragutils');
var LexScope = require('./lexscope');
var getReturnLoc = require('./findreturn');

var getFragment = FragUtils.getFragment;

var DEBUG = false;

module.exports = function(code) {

    var codeLines = code.split('\n');
    codeLines.unshift('');

    var lastSavedLoc = { line: 1, column: 0 };

    var outputFile = '';

    var ast = esprima.parse(code, {
        loc: true,
        raw: true
    });

    var lexScopesStack = [];

    function parseNode(node) {
        if (!node) {
            return;
        }

        switch (node.type) {
            case 'Program':
                // Глобальный скоуп
                lexScopesStack.push(LexScope.parse(node));
            case 'ForStatement':
            case 'WhileStatement':
            case 'BlockStatement':
                [].concat(node.body).forEach(function(node) {
                    parseNode(node);
                });
                break;

            case 'CallExpression':
                node.arguments.forEach(function(el) {
                    parseNode(el);
                });

                parseNode(node.callee);
                break;

            case 'VariableDeclaration':
                node.declarations.forEach(function(el) {
                    parseNode(el);
                });
                break;

            case 'VariableDeclarator':
                parseNode(node.init);
                break;

            case 'AssignmentExpression':
                parseNode(node.right);
                break;

            case 'FunctionExpression':
            case 'FunctionDeclaration':
                lexScopesStack.push(LexScope.parse(node));

                parseNode(node.body);

                lexScopesStack.pop();
                break;

            case 'ObjectExpression':
                node.properties.forEach(function(prop) {
                    parseNode(prop);
                });
                break;

            case 'Property':
                parseNode(node.value);
                break;

            case 'ExpressionStatement':

                var expr = node.expression;

                if (expr.type === 'CallExpression') {
                    var callee = expr.callee;

                    if (callee.type === 'MemberExpression'
                        && callee.property.name === 'forEach'
                        && expr.arguments.length === 1
                        && expr.arguments[0].type === 'FunctionExpression'
                        ) {

                        if (processForEach(node, expr, callee)) {
                            return;
                        }
                    }
                }

                parseNode(expr);
                break;
        }
    }

    function processForEach(node, expr, callee) {

        logFragment(node);
        logFragment(expr);
        logFragment(callee);

        var callback = expr.arguments[0];
        var callbackIterVar = callback.params[0].name;

        var callbackBody = callback.body;

        logFragment(callbackBody);

        var arrayIdentifier = getFragment(codeLines, callee.object.loc);

        var cycleScope = LexScope.parse(callback);

        var localScope = _.last(lexScopesStack);

        var intesect = localScope.filter(function(variable) {
            return cycleScope.indexOf(variable) !== -1;
        });

        if (intesect.length) {
            return;
        }

        var allScopesVars = [];
        lexScopesStack.forEach(function(scope) {
            allScopesVars = allScopesVars.concat(scope);
        });
        allScopesVars = allScopesVars.concat(cycleScope);

        var iter = '_i';
        while (allScopesVars.indexOf(iter) !== -1) {
            iter = '_' + iter;
        }

        var returns = getReturnLoc(expr.arguments[0].body);

        var functionBody = getFragment(codeLines, callbackBody.loc).substring(1);
        var lines = functionBody.split('\n');

        for (var i = returns.length - 1; i >= 0; --i) {
            var retObj = returns[i];
            var ret = retObj.loc;

            var args = '';

            if (retObj.args) {
                args = '(' + getFragment(codeLines, retObj.args) + ');';
            }

            var pos = {
                line: ret.start.line - callbackBody.loc.start.line,
                lineEnd: ret.end.line - callbackBody.loc.start.line,
                column: ret.start.column,
                columnEnd: ret.end.column
            };

            if (pos.line === 0) {
                pos.column = callbackBody.loc.start.column - ret.start.column;
                pos.columnEnd = callbackBody.loc.start.column - ret.end.column;
            }

            var origLine = lines[pos.line];

            var newLine = args + origLine.substr(0, pos.column) + 'continue';

            if (pos.line === pos.lineEnd) {
                newLine += lines[pos.lineEnd].substr(pos.columnEnd - 1);
            }

            lines[pos.line] = newLine;

            for (var j = pos.line + 1; j <= pos.lineEnd; ++j) {
                lines[j] = '';
            }
        }

        functionBody = lines.join('\n');

        var res =
            'for(var ' + iter + '=0,' + callbackIterVar + ';' + iter + '<' + arrayIdentifier + '.length;++' + iter + ')' +
            '{' + callbackIterVar + '=' + arrayIdentifier + '[' + iter + '];';
        res += functionBody;

        outputFile += getFragment(codeLines, {
            start: lastSavedLoc,
            end: node.loc.start
        });

        outputFile += res;

        lastSavedLoc = node.loc.end;

        return true;
    }

    function logFragment(node) {
        DEBUG && console.log(getFragment(codeLines, node.loc));
    }

    parseNode(ast);

    outputFile += getFragment(codeLines, {
        start: lastSavedLoc,
        end: 'EOF'
    });

    return outputFile
};
