#!/usr/bin/env bash

cd "$(dirname "${BASH_SOURCE[0]}")"

docker run \
	--env-file .env \
	--volume "${PWD}/jwt.keys.json:/home/node/app/jwt.keys.json:ro" \
	--rm -i airpdf smtp.js
