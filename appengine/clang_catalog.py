import ast
import json
from appengine import myria, requests
from appengine.raco import scheme
from appengine.raco.catalog import Catalog

__author__ = 'brandon'


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
            dataset_info = self.check_datasets(relation_args)
        except myria.MyriaError:
            raise ValueError('No relation {} in the catalog'.format(rel_key))

        col_names = [item.encode('utf-8') for item in ast.literal_eval(
            dataset_info['colNames'])]
        col_types = [item.encode('utf-8') for item in ast.literal_eval(
            dataset_info['colTypes'])]

        schema = {'columnNames': col_names, 'columnTypes': col_types}

        return scheme.Scheme(zip(schema['columnNames'], schema['columnTypes']))

    def check_datasets(self, rel_args):
        url = 'http://%s/catalog' % (self.connection.get_conn_string())
        r = requests.Session().post(url, data=json.dumps(rel_args))
        ret = r.json()
        if ret:
            return ret
        raise myria.MyriaError

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
            dataset_info = self.get_num_tuples(relation_args)
        except myria.MyriaError:
            raise ValueError(rel_key)
        num_tuples = dataset_info['numTuples']
        assert type(num_tuples) is int
        return num_tuples

    def get_num_tuples(self, rel_args):
        url = 'http://%s/tuples' % (self.connection.get_conn_string())
        r = requests.Session().post(url, data=json.dumps(rel_args))
        return r.json()