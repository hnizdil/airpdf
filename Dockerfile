FROM node:15.5-alpine

RUN apk --no-cache add poppler-utils

WORKDIR /home/node/app

COPY package.json .
COPY package-lock.json .

RUN npm install --production

COPY smtp.js .
COPY imap.js .
COPY shared.js .

RUN chown -R node:node .

USER node

ENTRYPOINT ["node"]
