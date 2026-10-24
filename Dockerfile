FROM nginx:alpine

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

COPY index.html app.html admin.html verificar.html pago-exitoso.html pago-pendiente.html /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/
COPY assets/ /usr/share/nginx/html/assets/
COPY icons/ /usr/share/nginx/html/icons/
COPY favicon-fvplus.png favicon.png favicon.ico manifest.json sw.js robots.txt sitemap.xml /usr/share/nginx/html/

EXPOSE 8080
