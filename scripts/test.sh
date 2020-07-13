#!/usr/bin/env bash
set -e

jest --coverage --collectCoverageFrom='src/*.ts'
export COVERALLS_FLAG_NAME=unit
coveralls < coverage/lcov.info --verbose