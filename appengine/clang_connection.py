import json
from appengine import requests
from appengine.raco.compile import compile
from appengine.raco.viz import operator_to_dot

__author__ = 'brandon'


class ClangConnection(object):

    def __init__(self, hostname, port):
        self.hostname = hostname
        self.port = port

    def get_conn_string(self):
        return "%s:%d" % (self.hostname, self.port)

    def create_clang_json(self, query, logical_plan, physical_plan):
        return {'rawQuery': query, 'logicalRa': str(logical_plan),
                'plan': compile(physical_plan),
                'dot': operator_to_dot(physical_plan)}

    def create_clang_execute_json(self, logical_plan, physical_plan, backend):
        start_index = logical_plan.find("(") + 1
        end_index = logical_plan.find(")")
        relkey = logical_plan[start_index:end_index].replace(":", "_")
        return {'plan': compile(physical_plan), 'backend': backend,
                'relkey': relkey}

    def submit_clang_query(self, compiled):
        url = 'http://%s:%d' % (self.hostname, self.port)
        r = requests.Session().post(url, data=json.dumps(compiled))
        return r.json()

    def check_clang_query(self, qid):
        url = 'http://%s:%d/status?qid=%s' % (self.hostname, self.port, qid)
        r = requests.Session().get(url)
        return r.json()