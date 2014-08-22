
var _ = require('lodash');
var assert = require('assert');

var fs = require('fs');
var forrer = require('../../src/forrer');

describe('simple cases', function() {

    makeTest(1);
    makeTest(2);
    makeTest(3);
    makeTest(4);
    makeTest(5);
    makeTest(6);
    makeTest(7);
    makeTest(8);

});

describe('ignore cases', function() {

    makeTest(20);

});

function makeTest(i) {
    it('test ' + i, function() {

        var code = fs.readFileSync('test/forrer/text' + i + '.js').toString();
        var expectCode = fs.readFileSync('test/forrer/text' + i + '_expect.js').toString();

        var newCode = forrer(code);

        assert.equal(expectCode.trim(), newCode.trim());
    });
}
