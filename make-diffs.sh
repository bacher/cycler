#!/usr/bin/env sh

./forrer examples/gamelogic.js > examples/gamelogic_.js &&
diff examples/gamelogic.js examples/gamelogic_.js > examples/gamelogic.diff

exit 0
