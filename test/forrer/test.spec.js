
var _ = require('lodash');
var assert = require('assert');

var fs = require('fs');
var forrer = require('../../src/forrer');

var TEST_PATH = './test/forrer';

describe('positive cases', function() {

    makeTests('positive');

});

describe('ignore cases', function() {

    makeTests('negative');

});

function makeTests(directory) {
    var files = fs.readdirSync(TEST_PATH + '/' + directory);

    files.filter(function(file) {
        return /^text\d+\.js$/.test(file);
    }).forEach(function(file) {
        makeTest(directory, file);
    });
}

function makeTest(directory, name) {
    it(name, function() {
        var code = fs.readFileSync(TEST_PATH + '/' + directory + '/' + name).toString();
        var expectCode = fs.readFileSync(TEST_PATH + '/' + directory + '/' + name + '_e.js').toString();

        var newCode = forrer(code);

        assert.equal(expectCode.trim(), newCode.trim());
    });
}
