# syntax=docker/dockerfile:1
# Firebase auth + firestore emulators (firestore needs a JVM).

FROM node:22-alpine
RUN apk add --no-cache openjdk21-jre-headless
RUN npm install -g firebase-tools
WORKDIR /app
# Bake the firestore emulator jar so startup needs no download.
RUN firebase setup:emulators:firestore
COPY firebase.emulator.json ./firebase.json
COPY firestore.rules firestore.indexes.json ./
EXPOSE 9099 8080
CMD ["firebase", "emulators:start", "--only", "auth,firestore", "--project", "demo-campus"]
