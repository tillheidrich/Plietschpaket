# Marketing site: build the static pages, serve them with nginx.
FROM python:3.13-alpine AS build
ARG SITE_BASE=https://plietschpaket.heidrich-digital.de/
WORKDIR /site
COPY . .
RUN python3 build.py --base "$SITE_BASE"

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /site/dist /usr/share/nginx/html
EXPOSE 80
