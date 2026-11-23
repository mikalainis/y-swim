# y-swim.com, built for Google Cloud Run.
# The site is plain HTML/JS in frontend/ (no build step); this image just serves it with nginx.
# "unprivileged" = runs as a non-root user and listens on 8080, which is what Cloud Run expects.
FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY frontend/ /usr/share/nginx/html/

EXPOSE 8080
