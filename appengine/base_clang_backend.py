from backend import Backend
from clang_catalog import ClangCatalog
from clang_connection import ClangConnection
import myria
import requests
from abc import abstractmethod
import raco.compile
from raco.viz import operator_to_dot


class BaseClangBackend(Backend):
    def __init__(self, hostname, port, ssl):
        self.hostname = hostname
        self.port = port
        self.ssl = ssl
        self.connection = ClangConnection(self.hostname, self.port, self.ssl)

    def catalog(self):
        return ClangCatalog(self.connection)

    @abstractmethod
    def algebra(self):
        pass

    @abstractmethod
    def _backend_name(self):
        pass

    @abstractmethod
    def _num_alive(self):
        pass

    @abstractmethod
    def _num_workers(self):
        pass

    @staticmethod
    def _compile(physical_plan):
        return raco.compile.compile(physical_plan)

    @staticmethod
    def _create_json_for_compile(query, logical_plan, physical_plan,
                                 compiled_plan,
                                 dots):
        return {'rawQuery': str(query), 'logicalRa': str(logical_plan),
                'plan': compiled_plan,
                'dot': dots}

    @staticmethod
    def _create_json_for_execute(query, logical_plan, physical_plan,
                                 compiled_plan, backend_name):
        start_index = logical_plan.find("Store(") + 6
        end_index = logical_plan.find(")", start_index)
        relkey = logical_plan[start_index:end_index].replace(":", "_")
        return {'plan': compiled_plan,
                'backend': backend_name,
                'relkey': relkey, 'rawQuery': str(query)}

    def compile_query(self, query, logical_plan, physical_plan, language=None):
        return self._create_json_for_compile(
            query, logical_plan, physical_plan, self._compile(physical_plan),
            operator_to_dot(physical_plan))

    def execute_query(self, query, logical_plan, physical_plan, language=None,
                      profile=False):
        try:
            sub_json = self._create_json_for_execute(
                query, logical_plan,
                physical_plan, self._compile(physical_plan),
                self._backend_name())
            query_status = self.connection.submit_query(sub_json)
            query_url = 'http://%s:%d/query?qid=%d' % \
                        (self.hostname, self.port, query_status['queryId'])
            return {'query_status': query_status, 'query_url': query_url}
        except myria.MyriaError as e:
            raise e
        except requests.ConnectionError as e:
            raise e

    def get_query_status(self, query_id):
        return self.connection.status(query_id)

    def connection_string(self):
        conn = self.connection
        if not conn:
            return "unable to connect to %s:%d" % (self.hostname, self.port)
        else:
            return "{0}:{1}[{2}/{3}]".format(self.hostname, self.port,
                                   self._num_alive, self._num_workers)

    def connection_url(self, uri_scheme):
        return "http://{h}:{p}".format(h=self.hostname, p=self.port)

    def backend_url(self):
        return "ftp://ftp.cs.washington.edu/tr/2014/10/UW-CSE-14-10-01.pdf"

    def queries(self, limit, max_id, min_id, q):
        return self.connection.queries(limit, max_id, min_id, q)
