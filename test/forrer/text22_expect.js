
(function() {

    window.arr.forEach(function(el) {
        console.log(el);

        setTimeout(function() {
            console.log(el);
        }, 1000);
    });

})();

