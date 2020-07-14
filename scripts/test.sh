#!/usr/bin/env bash
set -ex

jest --coverage --collectCoverageFrom='src/*.ts'
export COVERALLS_FLAG_NAME=unit
# export COVERALLS_PARALLEL=true
# export COVERALLS_SERVICE_JOB_NUMBER=211
coveralls < coverage/lcov.info --verbose
