import ast
import myria
from raco import scheme
from raco.catalog import Catalog


class ClangCatalog(Catalog):

    def __init__(self, connection):
        self.connection = connection

    def get_scheme(self, rel_key):
        relation_args = {
            'userName': rel_key.user,
            'programName': rel_key.program,
            'relationName': rel_key.relation
        }
        if not self.connection:
            raise RuntimeError(
                "no schema for relation %s because no connection" % rel_key)
        try:
            dataset_info = self.connection.catalog(relation_args)

        except myria.MyriaError:
            raise ValueError('No relation {} in the catalog'.format(rel_key))

        col_names = [item.encode('utf-8') for item in ast.literal_eval(
            dataset_info['colNames'])]
        col_types = [item.encode('utf-8') for item in ast.literal_eval(
            dataset_info['colTypes'])]
        schema = {'columnNames': col_names, 'columnTypes': col_types}

        return scheme.Scheme(zip(schema['columnNames'], schema['columnTypes']))

    def get_num_servers(self):
        if not self.connection:
            raise RuntimeError("no connection.")
        return 1

    def num_tuples(self, rel_key):
        relation_args = {
            'userName': rel_key.user,
            'programName': rel_key.program,
            'relationName': rel_key.relation
        }

        if not self.connection:
            raise RuntimeError(
                "no cardinality of %s because no connection" % rel_key)
        try:
            dataset_info = self.connection.get_num_tuples(relation_args)
        except myria.MyriaError:
            raise ValueError(rel_key)
        num_tuples = dataset_info['numTuples']
        assert type(num_tuples) is int
        return num_tuples
