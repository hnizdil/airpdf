FROM node:15.5-alpine

RUN apk --no-cache add poppler-utils

USER node

WORKDIR /home/node/app

COPY --chown=node:node app/* .

RUN npm install --production

ENTRYPOINT ["node"]
