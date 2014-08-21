
var _ = require('lodash');
var assert = require('assert');

var fs = require('fs');
var esprima = require('esprima');
var findreturn = require('../../src/findreturn');
//findreturn.verbose = true;


describe('simple case', function(){

    makeTest(1);
    makeTest(2);
    makeTest(3);

});

function makeTest(i) {
    it('test ' + i, function() {

        var code = fs.readFileSync('test/findreturn/text' + i + '.js').toString();

        var astTree = esprima.parse(code, {
            loc: true,
            raw: true
        });

        var returns = findreturn(astTree);

        assert.equal(returns.length, 1);
    });
}
