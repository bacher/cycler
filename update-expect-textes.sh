#!/usr/bin/env bash

./forrer test/forrer/text1.js > test/forrer/text1_expect.js &&
./forrer test/forrer/text2.js > test/forrer/text2_expect.js &&
./forrer test/forrer/text3.js > test/forrer/text3_expect.js &&
./forrer test/forrer/text4.js > test/forrer/text4_expect.js &&
./forrer test/forrer/text5.js > test/forrer/text5_expect.js &&
./forrer test/forrer/text6.js > test/forrer/text6_expect.js &&
./forrer test/forrer/text7.js > test/forrer/text7_expect.js &&
./forrer test/forrer/text8.js > test/forrer/text8_expect.js &&

./forrer test/forrer/text20.js > test/forrer/text20_expect.js
