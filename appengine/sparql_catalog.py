from raco.catalog import Catalog
from raco import scheme


class SPARQLCatalog(Catalog):
    def __init__(self):
        pass

    def num_tuples(self, rel_key):
        return -1

    def get_scheme(self, rel_key):
        # FIXME: hardcoding sp2bench
        col_names = ['subject', 'object', 'predicate']
        col_types = ['STRING_TYPE', 'STRING_TYPE', 'STRING_TYPE']
        schema = {'columnNames': col_names, 'columnTypes': col_types}

        return scheme.Scheme(zip(schema['columnNames'], schema['columnTypes']))

    def get_num_servers(self):
        return 1


