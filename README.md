cycler
======

CLI/Node program for **safe (based of AST tree)** transforming **"forEach"** methods into **"for"** cycles.

### Usage:

#### Bash:
```
forrer source.js > processed.js
```

#### Node.js:
````javascript
var forrer = require('./src/forrer');

var code = 'arr.forEach(function(a) { console.log(a); });';

console.log(forrer(code));
````

#### Transformation look like:

````javascript
arr.forEach(function(a) { console.log(a); });
````
into
````javascript
for(var _i=0,a,_m=arr;_i<_m.length;++_i){a=_m[_i]; console.log(a); }
````

#### You can see diff for source file in examples folders `examples/gamelogic.js`:
https://github.com/Bacher/cycler/blob/master/examples/gamelogic.diff
