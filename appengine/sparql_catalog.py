from raco.catalog import Catalog


class SPARQLCatalog(Catalog):
    def __init__(self):
        pass

    def num_tuples(self, rel_key):
        return -1

    def get_scheme(self, rel_key):
        return "(TODO scheme)"

    def get_num_servers(self):
        return 1


