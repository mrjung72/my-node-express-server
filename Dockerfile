FROM node:22-slim

WORKDIR /app

# Cloud Run에서 Cloud SQL 연동을 위한 시스템 의존성 (필요 시)
# slim 이미지를 사용하여 크기를 줄이되, 필요한 라이브러리가 있다면 여기서 설치

ENV NODE_ENV=production

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

EXPOSE 8080

CMD ["npm", "start"]
