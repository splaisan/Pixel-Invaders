# Pixel Invaders — static-serve container (Ubuntu/any docker host)
# Created by Stephane Plaisance
# Co-authored by Claude (Anthropic)
# Version 1.1.0 — 2026-07-05
#
# Build:  docker build -t pixel-invaders:1.1.0 .
# Run:    docker run -d --name pixel-invaders -p 127.0.0.1:8080:80 pixel-invaders:1.1.0
#         (keep the 127.0.0.1 bind — reach it via SSH LocalForward, do not
#          publish this on 0.0.0.0 on institutional infrastructure)
FROM nginx:alpine

# eMudhra CA incident (2026-10-20, #1): refresh the system trust store
# (Alpine ca-certificates >= 20261020-r0).
RUN apk add --no-cache --upgrade ca-certificates

COPY index.html /usr/share/nginx/html/index.html
COPY src /usr/share/nginx/html/src

EXPOSE 80
