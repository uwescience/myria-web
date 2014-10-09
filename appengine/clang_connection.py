import myria
import json
import requests
from raco.compile import compile
from raco.viz import operator_to_dot


class ClangConnection(object):

    def __init__(self, hostname, port):
        self.hostname = hostname
        self.port = port

    def create_json(self, query, logical_plan, physical_plan):
        return {'rawQuery': str(query), 'logicalRa': str(logical_plan),
                'plan': compile(physical_plan),
                'dot': operator_to_dot(physical_plan)}

    def create_execute_json(self, query, logical_plan, physical_plan, backend):
        start_index = logical_plan.find("(") + 1
        end_index = logical_plan.find(")")
        relkey = logical_plan[start_index:end_index].replace(":", "_")
        return {'plan': compile(physical_plan), 'backend': backend,
                'relkey': relkey, 'rawQuery': str(query)}

    def submit_query(self, compiled):
        url = 'http://%s:%d' % (self.hostname, self.port)
        r = requests.Session().post(url, data=json.dumps(compiled))
        return r.json()

    def check_query(self, qid):
        url = 'http://%s:%d/status?qid=%s' % (self.hostname, self.port, qid)
        r = requests.Session().get(url)
        return r.json()

    def check_datasets(self, rel_args):
        url = 'http://%s:%d/catalog' % (self.hostname, self.port)
        r = requests.Session().post(url, data=json.dumps(rel_args))
        ret = r.json()
        if ret:
            return ret
        raise myria.MyriaError

    def get_num_tuples(self, rel_args):
        url = 'http://%s:%d/tuples' % (self.hostname, self.port)
        r = requests.Session().post(url, data=json.dumps(rel_args))
        ret = r.json()
        if ret:
            return ret
        raise myria.MyriaError

    def num_entries(self, limit, max_):
        url = 'http://%s:%d/entries' % (self.hostname, self.port)
        r = requests.Session().post(url)
        ret = r.json()
        if ret:
            return ret, True
        raise myria.MyriaError
