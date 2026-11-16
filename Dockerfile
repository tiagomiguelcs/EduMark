FROM node:latest
WORKDIR /edumark
COPY . .
RUN npm install
CMD ["node", "edumark.js"] 
