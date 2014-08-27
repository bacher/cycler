var list = [1, 2, 3, 4, 5];
var quad = [[1, 2, 3, 4, 5], [1, 2, 3, 4, 5]];

for(var _i=0,el,_m=list;_i<_m.length;++_i){el=_m[_i];
    console.log(el);
}

for(var _i=0,l,_m=quad;_i<_m.length;++_i){l=_m[_i];
    l.forEach(function(el) {
        console.log(el);
    });
}