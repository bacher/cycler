
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
    var res = {
        code: code,
        isChanged: true
    };

    while (res.isChanged) {
        res = processCode(res.code);
    }

    return res.code;
};

var SCOPE_MAKERS = ['Program', 'FunctionExpression', 'FunctionDeclaration'];

function processCode(code) {

    var isChanged = false;

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

        if (Array.isArray(node)) {
            node.forEach(function(el) {
                parseNode(el);
            });
            return;
        }

        if (!node || !node.type) {
            return;
        }

        var pushed = false;

        if (_.contains(SCOPE_MAKERS, node.type)) {
            lexScopesStack.push(LexScope.parse(node));
            pushed = true;
        }

        if (node.type !== 'ExpressionStatement' || !checkForEach(node)) {
            for (var prop in node) {
                if (node.hasOwnProperty(prop) && prop !== 'type' && prop !== 'loc') {
                    parseNode(node[prop]);
                }
            }
        }

        if (pushed) {
            lexScopesStack.pop();
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

        var callbackIterVar = '';

        var callback = expr.arguments[0];
        if (callback.params.length) {
            callbackIterVar = callback.params[0].name;
        }

        var callbackBody = callback.body;

        var arrayIdentifier = getFragment(codeLines, callee.object.loc);

        var cycleScope = LexScope.parse(callback);

        var localScope = _.last(lexScopesStack);

        /* Если переменные в функции перекрывают переменные объявленные выше по скопам */
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

        var iterDeclaration = (callbackIterVar ? callbackIterVar + ',' : '');

        var declarationSection = 'var ' + iter + '=0,' + iterDeclaration + arrayAlias + '=' + arrayIdentifier;
        var conditionSection = iter + '<' + arrayAlias + '.length';
        var iteratorSection = '++' + iter;

        var res = 'for(' + declarationSection + ';' + conditionSection + ';' + iteratorSection + '){';
        if (callbackIterVar) {
            res += callbackIterVar + '=' + arrayAlias + '[' + iter + '];';
        }
        res += functionBody;

        outputFile += getFragment(codeLines, {
            start: lastSavedLoc,
            end: node.loc.start
        });

        outputFile += res;

        lastSavedLoc = node.loc.end;

        isChanged = true;

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

    return {
        code: outputFile,
        isChanged: isChanged
    };
}
