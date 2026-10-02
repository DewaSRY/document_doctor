{
	email ${acme_email}
}

${api_domain} {
	request_body {
		max_size 60MB
	}
	reverse_proxy ai-translation:${app_port} {
		header_up X-Forwarded-For {http.request.header.X-Portal-Client-IP}
	}
}