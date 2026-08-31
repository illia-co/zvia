FROM nginx:alpine

RUN apk add --no-cache wget

COPY index.html /usr/share/nginx/html/index.html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
HEALTHCHECK CMD wget -qO- http://localhost/ | grep -q zvia-demo-shop
