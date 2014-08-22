#!/usr/bin/env node

var fs = require('fs');

var forrer = require('./forrer');

var fileName = process.argv[process.argv.length - 1];

var code = fs.readFileSync(fileName).toString();

console.log(forrer(code));
