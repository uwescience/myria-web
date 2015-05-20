import json
import requests
import url


class ClangError(Exception):
    def __init__(self, err=None):
        if isinstance(err, requests.Response):
            msg = 'Error {} ({})'.format(err.status_code, err.reason)
            if err.text:
                msg = '{}: {}'.format(msg, err.text)
            Exception.__init__(self, msg)
        else:
            Exception.__init__(self, err)


class ClangConnection(object):

    def __init__(self, hostname, port, ssl):
        self.hostname = hostname
        self.port = port
        self.ssl = ssl
        self.url = url.generate_base_url(ssl, hostname, port)

    def _post_json(self, requrl, json_obj):
        headers = {'Content-type': 'application/json'}
        return requests.Session().post(requrl, data=json.dumps(json_obj),
                                       headers=headers)

    def submit_query(self, json_obj):
        r = self._post_json(self.url, json_obj)
        return r.json()

    def status(self, qid):
        requrl = url.generate_url(self.url, 'status', 'qid', qid)
        r = requests.Session().get(requrl)
        return r.json()

    def catalog(self, rel_args):
        requrl = url.generate_url(self.url, 'catalog')
        r = self._post_json(requrl, rel_args)
        ret = r.json()
        if ret:
            return ret
        raise ClangError

    def get_num_tuples(self, rel_args):
        requrl = url.generate_url(self.url, 'tuples')
        r = self._post_json(requrl, rel_args)
        ret = r.json()
        if ret:
            return ret
        raise ClangError

    def queries(self, limit, max_id, min_id, q):
        requrl = url.generate_url(self.url, 'queries')
        data = {'min': min_id, 'max': max_id, 'backend': 'clang'}
        r = self._post_json(requrl, data)
        ret = r.json()
        if ret:
            return ret
        raise ClangError
