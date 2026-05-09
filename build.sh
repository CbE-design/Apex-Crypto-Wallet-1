#!/bin/bash
set -e
npm install --legacy-peer-deps
./node_modules/.bin/next build
