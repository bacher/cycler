
require('colors');
var _ = require('lodash');
var esprima = require('esprima');
var FragUtils = require('./fragutils');
var LexScope = require('./lexscope');
var getReturnLoc = require('./findreturn');
var findNodes = require('./findnodes');

var getFragment = FragUtils.getFragment;

var DEBUG = false;

module.exports = function(code) {

    var codeLines = code.split('\n');
    codeLines.unshift('');

    var lastSavedLoc = { line: 1, column: 0 };

    var outputFile = '';

    var ast;

    try {
        ast = esprima.parse(code, {
            loc: true,
            raw: true
        });
    } catch(e) {
        console.warn('  [PARSE ERROR]'.red);
        console.warn('    Error:'.red, e.message.red);
        process.exit(1);
    }

    var lexScopesStack = [];

    function parseNode(node) {
        if (!node) {
            return;
        }

        if (Array.isArray(node)) {
            node.forEach(function(el) {
                parseNode(el);
            });

            return;
        }

        switch (node.type) {
            case 'Program':
                // Глобальный скоп
                lexScopesStack.push(LexScope.parse(node));
            case 'ForStatement':
            case 'WhileStatement':
            case 'BlockStatement':
                parseNode(node.body);
                break;

            case 'CallExpression':
                parseNode(node.arguments);
                parseNode(node.callee);
                break;

            case 'VariableDeclaration':
                parseNode(node.declarations);
                break;

            case 'VariableDeclarator':
                parseNode(node.init);
                break;

            case 'AssignmentExpression':
            case 'LogicalExpression':
            case 'BinaryExpression':
                parseNode(node.left);
                parseNode(node.right);
                break;

            case 'FunctionExpression':
            case 'FunctionDeclaration':
                lexScopesStack.push(LexScope.parse(node));

                parseNode(node.body);

                lexScopesStack.pop();
                break;

            case 'ObjectExpression':
                parseNode(node.properties);
                break;

            case 'Property':
                parseNode(node.value);
                break;

            case 'ExpressionStatement':
                if (!checkForEach(node)) {
                    parseNode(node.expression);
                }
                break;

            case 'MemberExpression':
                parseNode(node.object);
                break;

            case 'IfStatement':
                parseNode(node.test);
                parseNode(node.consequent);
                parseNode(node.alternate);
                break;

            case 'UnaryExpression':
            case 'ReturnStatement':
                parseNode(node.argument);
                break;

            case 'ThisExpression':
            case 'Identifier':
            case 'Literal':
                break;

            case 'ArrayExpression':
                parseNode(node.elements);
                break;

            case 'ConditionalExpression':
                parseNode(node.test);
                parseNode(node.left);
                parseNode(node.right);
                break;

            case 'TryStatement':
                parseNode(node.block);
                parseNode(node.handlers);
                parseNode(node.finalizer);
                break;

            case 'CatchClause':
                parseNode(node.param);
                parseNode(node.body);
                break;

            case 'ForInStatement':
                parseNode(node.left);
                parseNode(node.right);
                parseNode(node.body);
                break;

            case 'SwitchStatement':
                parseNode(node.discriminant);
                parseNode(node.cases);
                break;

            case 'SwitchCase':
                parseNode(node.consequent);
                break;

            case 'NewExpression':
                parseNode(node.callee);
                parseNode(node.arguments);
                break;

            case 'ThrowStatement':
                parseNode(node.argument);
                break;

            case 'BreakStatement':
                break;

            default:
                console.warn('[FORRER: Unknown node]', node.type);
        }
    }

    function checkForEach(node) {
        var expr = node.expression;

        if (expr.type === 'CallExpression') {
            var callee = expr.callee;

            if (callee.type === 'MemberExpression'
                && callee.property.name === 'forEach'
                && expr.arguments.length === 1
                && expr.arguments[0].type === 'FunctionExpression'
                ) {

                return processForEach(node, expr, callee);
            }
        }
    }

    function processForEach(node, expr, callee) {

        var callback = expr.arguments[0];
        var callbackIterVar = callback.params[0].name;

        var callbackBody = callback.body;

        var arrayIdentifier = getFragment(codeLines, callee.object.loc);

        var cycleScope = LexScope.parse(callback);

        var localScope = _.last(lexScopesStack);

        /* Если переменные в функции перекрывают перменные объявленные выше по скопам */
        if (_.intersection(localScope, cycleScope).length) {
            return;
        }

        /* Если внутри функции используется this */
        if (findNodes.localParse(callback, 'ThisExpression').length) {
            return;
        }

        /* Если внутри функции объявлены замыкания использующие переменные из локального скопа */
        if (findNodes.localParse(callback, ['FunctionDeclaration', 'FunctionExpression']).some(function(node) {
            var expresions = [];

            findNodes.parse(node, 'Identifier').forEach(function(expr) {
                expresions.push(expr.name);
            });

            if (_.intersection(expresions, cycleScope).length) {
                return true;
            }

        })) {
            return;
        }

        var allScopesVars = _.flatten(lexScopesStack).concat(cycleScope);

        var iter = '_i';
        while (allScopesVars.indexOf(iter) !== -1) {
            iter = '_' + iter;
        }

        var arrayAlias = '_m';
        while (allScopesVars.indexOf(arrayAlias) !== -1) {
            arrayAlias = '_' + arrayAlias;
        }

        var returns = getReturnLoc(callback.body);

        var functionBody = getFragment(codeLines, callbackBody.loc).substring(1);
        var lines = functionBody.split('\n');

        _.forEachRight(returns, function(retObj) {
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
        });

        functionBody = lines.join('\n');

        var res =
            'for(var ' + iter + '=0,' + callbackIterVar + ',' + arrayAlias + '=' + arrayIdentifier + ';' + iter + '<' + arrayAlias + '.length;++' + iter + ')' +
            '{' + callbackIterVar + '=' + arrayAlias + '[' + iter + '];';
        res += functionBody;

        outputFile += getFragment(codeLines, {
            start: lastSavedLoc,
            end: node.loc.start
        });

        outputFile += res;

        lastSavedLoc = node.loc.end;

        return true;
    }

    function logFragment(label, node) {
        if (DEBUG) {
            if (typeof label === 'string') {
                console.warn('[' + label + ']', getFragment(codeLines, node.loc));
            } else {
                console.warn(getFragment(codeLines, label.loc));
            }
        }
    }

    parseNode(ast);

    outputFile += getFragment(codeLines, {
        start: lastSavedLoc,
        end: 'EOF'
    });

    return outputFile
};
