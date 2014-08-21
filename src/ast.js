#!/usr/bin/env node

var esprima = require('esprima');

process.stdin.setEncoding('utf8');

var jsCode = '';
process.stdin.on('readable', function() {
    var chunk = process.stdin.read();
    if (chunk !== null) {
        jsCode += chunk;
    }
});

process.stdin.on('end', function() {
    var ast = esprima.parse(jsCode);
    console.log(JSON.stringify(ast, null, 2));
});
