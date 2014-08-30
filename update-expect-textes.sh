#!/usr/bin/env sh

./forrer test/forrer/positive/text1.js > test/forrer/positive/text1.js_e.js &&
./forrer test/forrer/positive/text2.js > test/forrer/positive/text2.js_e.js &&
./forrer test/forrer/positive/text3.js > test/forrer/positive/text3.js_e.js &&
./forrer test/forrer/positive/text4.js > test/forrer/positive/text4.js_e.js &&
./forrer test/forrer/positive/text5.js > test/forrer/positive/text5.js_e.js &&
./forrer test/forrer/positive/text6.js > test/forrer/positive/text6.js_e.js &&
./forrer test/forrer/positive/text7.js > test/forrer/positive/text7.js_e.js &&
./forrer test/forrer/positive/text8.js > test/forrer/positive/text8.js_e.js &&
./forrer test/forrer/positive/text9.js > test/forrer/positive/text9.js_e.js &&
./forrer test/forrer/positive/text10.js > test/forrer/positive/text10.js_e.js &&

./forrer test/forrer/negative/text1.js > test/forrer/negative/text1.js_e.js &&
./forrer test/forrer/negative/text2.js > test/forrer/negative/text2.js_e.js &&
./forrer test/forrer/negative/text3.js > test/forrer/negative/text3.js_e.js &&
./forrer test/forrer/negative/text4.js > test/forrer/negative/text4.js_e.js &&
./forrer test/forrer/negative/text5.js > test/forrer/negative/text5.js_e.js &&
./forrer test/forrer/negative/text6.js > test/forrer/negative/text6.js_e.js
