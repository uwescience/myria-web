from backend import Backend
from raco.backends.myria.connection import MyriaConnection
from raco.backends.scidb.connection import SciDBConnection
from raco.backends.federated.connection import FederatedConnection
from raco.backends.federated.catalog import FederatedCatalog
from raco.backends.federated.algebra import FederatedAlgebra
from raco.backends.myria.myria import MyriaLeftDeepTreeAlgebra
from raco.backends.scidb.algebra import SciDBAFLAlgebra
from raco.backends.federated.movers.filesystem import SciDBToMyria
from raco.backends.myria.catalog import MyriaCatalog
from raco.backends.scidb.catalog import SciDBCatalog


class FederatedBackend(Backend):
    def __init__(self, myriaresturl, scidburl):
        self.myriaconnection = MyriaConnection(rest_url=myriaresturl)
        self.scidbconnection = SciDBConnection(scidburl)
        self.federatedconnection = FederatedConnection([self.myriaconnection, self.scidbconnection], [SciDBToMyria()])
        self.federatedcatalog = FederatedCatalog([MyriaCatalog(self.myriaconnection), SciDBCatalog(self.scidbconnection)])

    def get_query_status(self, query_id):
        raise NotImplementedError

    def catalog(self):
        # FIXME: expects myria web catalog not raco catalog (have adapter?)
        return self.federatedcatalog

    def execute_query(self, query, logical_plan, physical_plan, language=None,
                      profile=False):
        result = self.federatedconnection.execute_query(physical_plan)
        return result

    def connection_info(self):
        raise NotImplementedError

    def compile_query(self, query, physical_plan, language=None):
        raise NotImplementedError

    def connection_url(self, uri_scheme="http"):
        raise NotImplementedError

    def backend_url(self):
        raise NotImplementedError

    def queries(self, limit, max_id, min_id, q):
        raise NotImplementedError

    def algebra(self):
        return FederatedAlgebra([MyriaLeftDeepTreeAlgebra(), SciDBAFLAlgebra()],
                                self.federatedcatalog)
