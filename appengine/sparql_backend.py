from backend import Backend
from sparql_catalog import SPARQLCatalog
from raco.viz import operator_to_dot
from raco.language.sparql import SPARQLAlgebra


class SPARQLBackend(Backend):
    def __init__(self, hostname, port, ssl):
        pass

    def catalog(self):
        return SPARQLCatalog()

    def algebra(self):
        return SPARQLAlgebra()

    def connection(self):
        # want to remove this in #278
        return None

    def compile_query(self, query, logical_plan, physical_plan, language=None):
        return {'rawQuery': str(query), 'logicalRa': str(logical_plan),
                'plan': compile(physical_plan),
                'dot': operator_to_dot(physical_plan)}

    def execute_query(self, query, logical_plan, physical_plan, language=None,
                      profile=False):
        start_index = logical_plan.find("Store(") + 6
        end_index = logical_plan.find(")", start_index)
        relkey = logical_plan[start_index:end_index].replace(":", "_")
        compiled = {'plan': compile(physical_plan), 'backend': "sparql",
                'relkey': relkey, 'rawQuery': str(query)}
        return {'query_status': compiled, 'query_url': ""}

    def get_query_status(self, query_id):
        return "(TODO status here)"

    def connection_string(self):
        return "local (SPARQL code only)"

    def connection_url(self, uri_scheme):
        return ""

    def backend_url(self):
        return ""

    def queries(self, limit, max_id, min_id, q):
        return "(TODO empty json?)"
