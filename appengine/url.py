def generate_base_url(ssl, hostname, port):
    if ssl:
        uri_scheme = "https"
    else:
        uri_scheme = "http"
        return '%s://%s:%d' % (uri_scheme, hostname, port)


def generate_url(url, path, param_name=None, param=None):
    url = '%s/%s' % (url, path)
    if param_name is not None:
        return '%s?%s=%s' % (url, param_name, param)
    else:
        return url
