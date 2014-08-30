
(function() {
    window.arr.forEach(function(el) {
        console.log(1);

        if (el) {
            return {
                aaa: console.log(3)
            };
        }

        console.log(2);
    });

})();
