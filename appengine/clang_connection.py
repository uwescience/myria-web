import myria
import json
import requests
import url


class ClangConnection(object):

    def __init__(self, hostname, port, ssl):
        self.hostname = hostname
        self.port = port
        self.ssl = ssl
        self.url = url.generate_base_url(ssl, hostname, port)

    def submit_query(self, jsons):
        r = requests.Session().post(self.url, data=json.dumps(jsons))
        return r.json()

    def status(self, qid):
        requrl = url.generate_url(self.url, 'status', 'qid', qid)
        r = requests.Session().get(requrl)
        return r.json()

    def catalog(self, rel_args):
        requrl = url.generate_url(self.url, 'catalog')
        r = requests.Session().post(requrl, data=json.dumps(rel_args))
        ret = r.json()
        if ret:
            return ret
        raise myria.MyriaError

    def get_num_tuples(self, rel_args):
        requrl = url.generate_url(self.url, 'tuples')
        r = requests.Session().post(requrl, data=json.dumps(rel_args))
        ret = r.json()
        if ret:
            return ret
        raise myria.MyriaError

    def queries(self, limit, max_id, min_id, q):
        requrl = url.generate_url(self.url, 'queries')
        data = {'min': min_id, 'max': max_id, 'backend': 'clang'}
        r = requests.Session().post(requrl, data=json.dumps(data))
        ret = r.json()
        if ret:
            return ret
        raise myria.MyriaError
