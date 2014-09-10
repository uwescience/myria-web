from backend import Backend
from clang_catalog import ClangCatalog
from clang_connection import ClangConnection
import myria
import requests
from raco.language.grappalang import GrappaAlgebra


class GrappaBackend(Backend):
    # might use a grappa catalog if clang and grappa are on different servers
    def __init__(self, hostname, port):
        self.clanghostname = hostname
        self.clangport = port

    def catalog(self):
        return ClangCatalog(self.connection())

    def algebra(self):
        return GrappaAlgebra('file')

    def connection(self):
        return ClangConnection(self.clanghostname, self.clangport)

    def compile_query(self, query, logical_plan, physical_plan, language=None):
        return self.connection().create_json(
            query, logical_plan, physical_plan)

    def execute_query(self, query, logical_plan, physical_plan, language=None,
                      profile=False):
        try:
            compiled = self.connection().create_execute_json(
                query, logical_plan, physical_plan, "grappa")
            query_status = self.connection().submit_query(compiled)
            query_url = 'http://%s:%d/query?qid=%d' %\
                        (self.clanghostname, self.clangport,
                         query_status['queryId'])
            return {'query_status': query_status, 'query_url': query_url}
        except myria.MyriaError as e:
            raise e
        except requests.ConnectionError as e:
            raise e

    def get_query_status(self, query_id):
        return self.connection().check_query(query_id)

    def connection_string(self):
        conn = self.connection()
        if not conn:
            return "unable to connect to %s:%d" % (self.clanghostname,
                                                   self.clangport)
        else:
            return "%s:%d" % (self.clanghostname, self.clangport)
