
(function() {

    for(var _i=0,el,_m=window.arr;_i<_m.length;++_i){el=_m[_i];
        console.log(el);

        setTimeout(function() {
            console.log(el);
        }, 1000);
    }

})();

