#!/usr/bin/env bash
set -ex

jest --coverage --collectCoverageFrom='src/*.ts'
export COVERALLS_FLAG_NAME=all
export COVERALLS_PARALLEL=true
export COVERALLS_REPO_TOKEN=ogKjzqSNzjP70fIkxb1BZpCrumXvsWZiv
coveralls < coverage/lcov.info --verbose
