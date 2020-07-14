#!/usr/bin/env bash
set -ex

jest --coverage --collectCoverageFrom='src/*.ts'
export COVERALLS_FLAG_NAME=unit
coveralls < coverage/lcov.info --verbose

echo "completed"