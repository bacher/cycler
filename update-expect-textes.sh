#!/usr/bin/env sh

find test/forrer/*/*[^_e].js -exec ./forrer {} -o {}_e.js {} \;
