#!/usr/bin/env sh

./forrer examples/abook.js > examples/abook_.js &&
diff examples/abook.js examples/abook_.js > examples/abook.diff

./forrer examples/gamelogic.js > examples/gamelogic_.js &&
diff examples/gamelogic.js examples/gamelogic_.js > examples/gamelogic.diff

./forrer examples/mailbox.js > examples/mailbox_.js &&
diff examples/mailbox.js examples/mailbox_.js > examples/mailbox.diff

exit 0
