
(function() {

    function a() {
        return 33;
    }

    var b = function() {
        return 33;
    };

    for (var i = 0; i < 100; ++i) {
        if (true) {
            5 + 5;
        } else {
            return 3;
        }
    }
})();
