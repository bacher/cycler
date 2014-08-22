#!/usr/bin/env bash

src/run.js examples/abook.js > examples/abook_.js &&
diff examples/abook.js examples/abook_.js > examples/abook.diff

src/run.js examples/gamelogic.js > examples/gamelogic_.js &&
diff examples/gamelogic.js examples/gamelogic_.js > examples/gamelogic.diff

src/run.js examples/mailbox.js > examples/mailbox_.js &&
diff examples/mailbox.js examples/mailbox_.js > examples/mailbox.diff

exit 0
