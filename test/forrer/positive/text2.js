var list = [1, 2, 3, 4, 5];
var quad = [[1, 2, 3, 4, 5], [1, 2, 3, 4, 5]];

list.forEach(function(el) {
    console.log(el);
});

quad.forEach(function(l) {
    l.forEach(function(el) {
        console.log(el);
    });
});