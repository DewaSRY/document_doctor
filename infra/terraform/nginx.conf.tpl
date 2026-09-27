# Rendered by templatefile() in main.tf from variables (nginx_port,
# app_port, rate_limit_*, client_max_body_size, proxy_timeout_seconds), then
# shipped to the instance base64-encoded inside user_data.sh.tpl. Mounted at
# /etc/nginx/conf.d/default.conf, replacing the stock nginx image config.
#
# ai-translation itself is not published on the instance's public interface —
# nginx is the only public entrypoint, reaching it by compose service name
# over the shared docker network (see docker-compose.prod.yaml).

limit_req_zone $binary_remote_addr zone=ai_translation:10m rate=${rate_limit_rps}r/s;

server {
    listen ${nginx_port};
    server_name _;

    # Document uploads (10 MB) and PDF merges (50 MB total); nginx's default is 1m.
    client_max_body_size ${client_max_body_size};

    location / {
        limit_req zone=ai_translation burst=${rate_limit_burst} nodelay;
        limit_req_status 429;

        proxy_pass http://ai-translation:${app_port};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Translation runs synchronously on CPU and can take minutes.
        proxy_read_timeout ${proxy_timeout_seconds}s;
        proxy_send_timeout ${proxy_timeout_seconds}s;
    }
}
