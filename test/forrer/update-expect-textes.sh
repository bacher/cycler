#!/usr/bin/env bash

src/run.js test/forrer/text1.js > test/forrer/text1_expect.js &&
src/run.js test/forrer/text2.js > test/forrer/text2_expect.js &&
src/run.js test/forrer/text3.js > test/forrer/text3_expect.js &&
src/run.js test/forrer/text4.js > test/forrer/text4_expect.js &&
src/run.js test/forrer/text5.js > test/forrer/text5_expect.js &&
src/run.js test/forrer/text6.js > test/forrer/text6_expect.js &&
src/run.js test/forrer/text7.js > test/forrer/text7_expect.js &&
src/run.js test/forrer/text8.js > test/forrer/text8_expect.js &&

src/run.js test/forrer/text20.js > test/forrer/text20_expect.js
