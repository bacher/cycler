#!/usr/bin/env node

var fs = require('fs');
var esprima = require('esprima');
var LexScope = require('./lexscope');
var getReturnLoc = require('./findreturn.js');

var DEBUG = false;

var fileName = process.argv[process.argv.length - 1];

var code = fs.readFileSync(fileName).toString();
var codeLines = code.split('\n');
codeLines.unshift('');

var lastSavedLoc = { line: 1, column: 0 };

var outputFile = '';

var ast = esprima.parse(code, {
    loc: true,
    raw: true
});

var level = 0;
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
            if (node.callee.type === 'FunctionExpression') {
                parseNode(node.callee.body);
            }
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
                    logFragment(node);
                    logFragment(expr);
                    logFragment(callee);

                    //console.log('==============');
                    //console.log(node.loc);
                    //console.log(expr.loc);

                    var callback = expr.arguments[0];
                    var callbackIterVar = callback.params[0].name;

                    var callbackBody = callback.body;

                    logFragment(callbackBody);

                    var arrayIdentifier = getFragment(callee.object.loc);

                    var cycleScope = LexScope.parse(callback);

                    var localScope = lexScopesStack[lexScopesStack.length - 1];
                    var intesect = localScope.filter(function(variable) {
                        return cycleScope.indexOf(variable) !== -1;
                    });
                    if (intesect.length) {
                        parseNode(expr);
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

                    //console.log('AA31');
                    //console.log(JSON.stringify(expr, 4));

                    var returns = getReturnLoc(expr.arguments[0].body);

                    var functionBody = getFragment(callbackBody.loc).substring(1);
                    var lines = functionBody.split('\n');

                    for (var i = returns.length - 1; i >= 0; --i) {
                        var retObj = returns[i];
                        var ret = retObj.loc;

                        // ####

                        var args = '';

                        if (retObj.args) {
//                            var posArg = {
//                                line: argsLoc.start.line - callbackBody.loc.start.line,
//                                lineEnd: argsLoc.end.line - callbackBody.loc.end.line,
//                                column: argsLoc.start.column,
//                                columnEnd: argsLoc.end.column
//                            }
//
//                            if (posArg.line === 0) {
//                                posArg.column = callbackBody.loc.start.column - argsLoc.start.column;
//                                posArg.columnEnd = callbackBody.loc.start.column - argsLoc.end.column;
//                            }

                            args = getFragment(retObj.args) + ';';
                        }

                        // ####

                        var pos = {
                            line: ret.start.line - callbackBody.loc.start.line,
                            column: ret.start.column,
                            columnEnd: ret.end.column
                        };

                        if (pos.line === 0) {
                            pos.column = callbackBody.loc.start.column - ret.start.column;
                            pos.columnEnd = callbackBody.loc.start.column - ret.end.column;
                        }

                        var origLine = lines[pos.line];
                        var newLine = args + origLine.substr(0, pos.column) + 'continue' + origLine.substr(pos.columnEnd - 1);
                        lines[pos.line] = newLine;
                    }

                    functionBody = lines.join('\n');

                    var res =
                        'for(var '+iter+'=0,'+callbackIterVar+';'+iter+'<'+arrayIdentifier+'.length;++'+iter+')' +
                            '{'+callbackIterVar+'='+arrayIdentifier+'['+iter+'];';
                    res += functionBody;

                    outputFile += getFragment({
                        start: lastSavedLoc,
                        end: node.loc.start
                    });

                    outputFile += res;

                    lastSavedLoc = node.loc.end;
                } else {
                    parseNode(expr);
                }
            } else {
                parseNode(expr);
            }
            break;
    }
}

function getFragment(loc) {
    var toEnd = (loc.end === 'EOF');

    var line1 = loc.start.line;
    var line2 = toEnd ? codeLines.length - 1 : loc.end.line;

    var col1 = loc.start.column;
    var col2 = toEnd ? codeLines[line2].length : loc.end.column;

    var fragment = '';

    if (line1 === line2) {
        fragment = codeLines[line1].substring(col1, col2);
    } else {
        fragment = codeLines[line1].substring(col1) + '\n';

        for (var line = line1 + 1; line < line2; ++line) {
            fragment += codeLines[line] + '\n';
        }
        fragment += codeLines[line2].substring(0, col2);
    }

    return fragment;
}

function logFragment(node) {
    DEBUG && console.log(getFragment(node.loc));
}

parseNode(ast);

outputFile += getFragment({
    start: lastSavedLoc,
    end: 'EOF'
});

DEBUG && console.log('==== RESULT ====');
console.log(outputFile);

//console.log(JSON.stringify(ast, null, 4));
