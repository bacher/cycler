var list = [1, 2, 3, 4, 5];
var quad = [[1, 2, 3, 4, 5], [1, 2, 3, 4, 5]];

for(var _i=0,el;_i<list.length;++_i){el=list[_i];
    console.log(el);
}

for(var _i=0,l;_i<quad.length;++_i){l=quad[_i];
    l.forEach(function(el) {
        console.log(el);
    });
}
