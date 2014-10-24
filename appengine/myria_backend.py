from backend import Backend
from myria_catalog import MyriaCatalog
import myria
import requests
from raco.language.myrialang import (MyriaLeftDeepTreeAlgebra,
                                     MyriaHyperCubeAlgebra,
                                     compile_to_json)


class MyriaBackend(Backend):
    def __init__(self, hostname, port, ssl):
        self.hostname = hostname
        self.port = port
        self.ssl = ssl

    def catalog(self):
        return MyriaCatalog(self.connection())

    def algebra(self):
        return MyriaLeftDeepTreeAlgebra()

    def connection(self):
        return myria.MyriaConnection(hostname=self.hostname, port=self.port,
                                     ssl=self.ssl)

    def compile_query(self, query, logical_plan, physical_plan, language):
        return compile_to_json(
            query, logical_plan, physical_plan, language)

    def execute_query(self, query, logical_plan, physical_plan, language,
                      profile):
        try:
            # Get the Catalog needed to get schemas for compiling the query
            # .. and compile
            compiled = compile_to_json(
                query, logical_plan, physical_plan, language)
            compiled['profilingMode'] = profile
            query_status = self.connection().submit_query(compiled)
            if self.ssl:
                uri_scheme = "https"
            else:
                uri_scheme = "http"
            # Issue the query
            query_url = '%s://%s:%d/execute?query_id=%d' %\
                        (uri_scheme, self.hostname, self.port,
                         query_status['queryId'])
            return {'query_status': query_status, 'query_url': query_url}
        except myria.MyriaError as e:
            raise e
        except requests.ConnectionError as e:
            raise e

    def get_query_status(self, query_id):
        return self.connection().get_query_status(query_id)

    def connection_string(self):
        conn = self.connection()
        if not conn:
            return "unable to connect to %s:%d" % (self.hostname, self.port)
        else:
            try:
                workers = conn.workers()
                alive = conn.workers_alive()
                return "%s:%d [%d/%d]" % (self.hostname, self.port, len(alive),
                                          len(workers))
            except:
                return "error connecting to %s:%d" % (self.hostname, self.port)

    def backend_url(self):
        return "http://myria.cs.washington.edu/"

    def num_entries(self, limit, max_):
        return self.connection().queries(limit, max_)


class MyriaMultiJoinBackend(MyriaBackend):
    def algebra(self):
        return MyriaHyperCubeAlgebra(self.catalog())
