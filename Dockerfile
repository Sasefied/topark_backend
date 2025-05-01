FROM node:23-alpine

WORKDIR /app
COPY package.json /app
RUN npm install
COPY . /app

ENV PORT=8000
EXPOSE 8000

CMD ["npm", "start"]