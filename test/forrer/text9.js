
(function() {
    window.arr.forEach(function(el) {
        console.log(1);

        if (el) {

            window.arr2.forEach(function(su) {
                console.log(su);
            });

            return {
                aaa: console.log(3)
            };
        }

        console.log(2);
    });

})();
