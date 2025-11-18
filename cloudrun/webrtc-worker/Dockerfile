FROM node:20-bookworm

WORKDIR /app

# انسخ تعريف الحزم أولاً
COPY package*.json ./

# استخدم install (لا ci) لأن ما عندنا package-lock.json
RUN npm install --omit=dev

# انسخ السورس
COPY ./src ./src

ENV NODE_OPTIONS=--enable-source-maps
CMD ["node","src/index.js"]
