import myria
import json
import requests
import url
from raco.compile import compile
from raco.viz import operator_to_dot


class ClangConnection(object):

    def __init__(self, hostname, port, ssl):
        self.hostname = hostname
        self.port = port
        self.ssl = ssl
        self.url = url.generate_base_url(ssl, hostname, port)

    def create_json(self, query, logical_plan, physical_plan):
        return {'rawQuery': str(query), 'logicalRa': str(logical_plan),
                'plan': compile(physical_plan),
                'dot': operator_to_dot(physical_plan)}

    def create_execute_json(self, query, logical_plan, physical_plan, backend):
        start_index = logical_plan.find("Store(") + 6
        end_index = logical_plan.find(")", start_index)
        relkey = logical_plan[start_index:end_index].replace(":", "_")
        return {'plan': compile(physical_plan), 'backend': backend,
                'relkey': relkey, 'rawQuery': str(query)}

    def submit_query(self, compiled):
        r = requests.Session().post(self.url, data=json.dumps(compiled))
        return r.json()

    def check_query(self, qid):
        requrl = url.generate_url(self.url, 'status', 'qid', qid)
        r = requests.Session().get(requrl)
        return r.json()

    def check_datasets(self, rel_args):
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

    def num_queries(self, limit, max_):
        requrl = url.generate_url(self.url, 'entries')
        r = requests.Session().post(requrl)
        ret = r.json()
        if ret:
            return ret, True
        raise myria.MyriaError
