#!/usr/bin/env python

""" Does database storage for node.js clang/grappa server """

import argparse
import sys
import sqlite3
import time
import json
import datetime
import subprocess
from subprocess import Popen

import os
import errno
import struct
import urllib2

raco_path = 'raco/'
grappa_path = 'grappa/'

compile_path = raco_path + 'c_test_environment/'
scheme_path = compile_path + 'schema/'
grappa_data_path = '/shared/'


def _mkdir_p(dirname):
    try:
        os.mkdir(dirname)
    except OSError, e:
        if e.errno != errno.EEXIST:
            raise e
        pass


def parse_options(args):
    parser = argparse.ArgumentParser()

    parser.add_argument('function', metavar='f', type=str,
                        help='function to call for db storing/retrieving')

    parser.add_argument('-p', nargs='+',
                        help='params for the function')

    ns = parser.parse_args(args)
    return ns


class DatastoreAPI(object):
    def __init__(self):
        self.conn = sqlite3.connect('dataset.db')

    def process_query(self, params):
        """params: rel_keys url qid backend rawQuery
        retrieves query, inserts into db"""

        relkey = params[0].split('_')
        default_schema = json.dumps({'columnNames': "[]", 'columnTypes': "[]"})
        qid = params[2]
        backend = params[3]
        raw_query = urllib2.unquote(params[4]).decode('utf-8')
        c = self.conn.cursor()
        cur_time = time.time()
        query = 'INSERT INTO dataset VALUES' + \
                ' (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        param_list = (relkey[0], relkey[1], relkey[2], qid, cur_time, params[1],
                      'ACCEPTED', cur_time, None, 0, 0, default_schema, backend,
                      raw_query)
        try:
            c.execute(query, param_list)
            self.conn.commit()
            print str(cur_time) + ' ' + qid + ' started'
        except sqlite3.IntegrityError as e:
            self.__update_query_error(qid, e.output)


    def update_query_run(self, params):
        """params: qid filename backend"""

        query = 'UPDATE dataset SET status = "RUNNING" WHERE queryId = ?'
        c = self.conn.cursor()
        c.execute(query, (params[0],))
        self.conn.commit()
        self.__run_query(params)


    def __run_query(self, params):
        """params: qid filename backend"""

        qid = params[0]
        filename = params[1]
        backend = params[2]
        cmd = ['python', 'run_query.py']
        cmd.append(backend)
        cmd.append(filename)
        if backend == 'grappa':
            grappa_name = 'grappa_' + filename
            cmd_grappa = ['mv', filename + '.cpp', grappa_name + '.cpp']
            subprocess.check_call(cmd_grappa, cwd=compile_path)
        try:
            subprocess.check_output(cmd, cwd=compile_path)
            self.__update_scheme(filename, qid, backend)
        except subprocess.CalledProcessError as e:
            self.__update_query_error(qid, e.output)


    def __update_query_error(self, qid, e):
        query = 'UPDATE dataset SET status = "ERROR" WHERE queryId = ?'
        c = self.conn.cursor()
        c.execute(query, (qid,))
        self.conn.commit()
        print 'error:' + str(e)


    def __update_scheme(self, filename, qid, backend):
        if backend == 'grappa':
            schemefile = grappa_data_path + filename
        else:
            schemefile = scheme_path + filename
            _mkdir_p(scheme_path)
        try:
            with open(schemefile, 'r') as f:
                data = f.read().split('\n')
                schema = {'columnNames': data[0], 'columnTypes': data[1]}
                query = 'UPDATE dataset SET schema = ? WHERE queryId = ?'
                c = self.conn.cursor()
                c.execute(query, (json.dumps(schema), qid))
                self.conn.commit()
                self.__update_catalog(filename, qid, backend, data[0])
            self.__update_query_success(qid)
        except sqlite3.Error as e:
            self.__update_query_error(qid, e.output)


    def __update_catalog(self, filename, qid, backend, col_names):
        if backend == 'grappa':
            filename = grappa_data_path + filename + '.bin'
            col_size = len(eval(col_names))
            file_size = os.stat(filename).st_size
            output = file_size / 8 / col_size
        else:
            filename = compile_path + filename
            p1 = Popen(['cat', filename], stdout=subprocess.PIPE)
            p2 = Popen(['wc', '-l'], stdin=p1.stdout, stdout=subprocess.PIPE)
            p1.stdout.close()  # Allow p1 to receive a SIGPIPE if p2 exits.
            output = int(p2.communicate()[0])
        c = self.conn.cursor()
        query = 'UPDATE dataset SET numTuples = ? WHERE queryId = ?'
        c.execute(query, (output, qid))
        self.conn.commit()


    def __update_query_success(self, qid):
        stop = time.time()
        sel_query = 'SELECT startTime FROM dataset WHERE queryId = ?'
        upd_query = 'UPDATE dataset SET status = "SUCCESS", endTime = ?,' + \
                    'elapsed = ? WHERE queryId = ?'
        c = self.conn.cursor()
        c.execute(sel_query, (qid,))
        start = c.fetchone()[0]
        elapsed = (stop - start) * 1000000000  # turn to nanoseconds
        params_list = (stop, elapsed, qid)
        c.execute(upd_query, params_list)
        self.conn.commit()
        print str(stop) + ' ' + qid + ' done'


    def get_query_status(self, params):
        """params: qid"""

        c = self.conn.cursor()
        query = 'SELECT * FROM dataset WHERE queryId= ?'
        c.execute(query, (params[0],))
        row = c.fetchone()
        if row[6] == 'SUCCESS':
            fin = datetime.datetime.fromtimestamp(row[8]).isoformat()
            elapsed = row[9]
        else:
            fin = 'None'
            elapsed = (time.time() - row[7]) * 1000000000
        res = {'status': row[6], 'queryId': row[3], 'url': row[5],
               'startTime': datetime.datetime.fromtimestamp(row[7]).isoformat(),
               'finishTime': fin, 'elapsedNanos': elapsed, 'profilingMode': []}
        print json.dumps(res)


    def check_catalog(self, params):
        """params: userName programName relationName"""
        c = self.conn.cursor()
        query = 'SELECT * FROM dataset WHERE userName = ? AND ' + \
                'programName = ? AND relationName = ? ORDER BY queryId DESC'
        c.execute(query, (params[0], params[1], params[2],))
        row = c.fetchone()
        res = {}
        if not row:
            print json.dumps(res)  # returns empty json
        else:
            col_names = json.loads(row[11])['columnNames']
            col_types = json.loads(row[11])['columnTypes']
            res = {'relationKey': {'userName': params[0], 'programName': params[1],
                                   'relationName': params[2]}, 'queryId': row[3],
                   'created': row[4], 'url': row[5], 'numTuples': row[10],
                   'colNames': col_names, 'colTypes': col_types}
            print json.dumps(res)


    def select_table(self, params):
        """params: min max backend"""

        min = int(params[0])
        max = int(params[1])
        backend = params[2]
        res = []
        if max == 0:
            query = 'SELECT * FROM dataset WHERE backend = ? AND ' \
                    + 'queryId >= ?'
        else:
            query = 'SELECT * FROM dataset WHERE backend = ? AND ' \
                    + ' queryId >= ? AND queryId <= ?'
        c = self.conn.cursor()
        if max == 0:
            c.execute(query, (backend, min))
        else:
            c.execute(query, (backend, min, max))
        rows = c.fetchall()
        for row in rows:
            val = {'relationKey': {'userName': row[0], 'programName': row[1],
                                   'relationName': row[2]}, 'queryId': row[3],
                   'created': row[4], 'uri': row[5], 'status': row[6],
                   'startTime': row[7], 'finishTime': row[8],
                   'elapsedNanos': row[9], 'numTuples': row[10],
                   'schema': row[11], 'backend': row[12], 'rawQuery': row[13]}
            res.append(val)
        print json.dumps({'min': self.__get_min_entry(min, backend), 
                          'max': self.__get_max_entry(max, backend), 'results': res})


    def select_row(self, params):
        """params: qid"""

        res = []
        query = 'SELECT * FROM dataset WHERE queryId = ?'
        c = self.conn.cursor()
        for row in c.execute(query, (params[0],)):
            scheme = json.loads(row[11])
            val = {'relationKey': {'userName': row[0], 'programName': row[1],
                                   'relationName': row[2]}, 'queryId': row[3],
                   'created': row[4], 'uri': row[5], 'status': row[6],
                   'startTime': row[7], 'endTime': row[8], 'elapsedNanos': row[9],
                   'numTuples': row[10], 'schema': scheme, 'rawQuery': row[13]}
            res.append(val)
        print json.dumps(res)

    def select_all(self, params):
        """params: backend"""
        backend = params[0]
        res = []
        query = 'SELECT * FROM dataset WHERE backend = ?' 
        c = self.conn.cursor()
        for row in c.execute(query, (backend,)):
            val = {'relationKey': {'userName': row[0], 'programName': row[1],
                                   'relationName': row[2]}, 'queryId': row[3],
                   'created': row[4], 'uri': row[5], 'status': row[6],
                   'startTime': row[7], 'finishTime': row[8],
                   'elapsedNanos': row[9], 'numTuples': row[10],
                   'schema': row[11], 'backend': row[12], 'rawQuery': row[13]}
            res.append(val)
        print json.dumps(res)

    def get_filename(self, params):
        """params: qid"""
        qid = params[0]
        query = 'SELECT relationName FROM dataset ' + \
                'WHERE queryId= ?'
        c = self.conn.cursor()
        c.execute(query, (qid,))
        row = c.fetchone()
        filename = row[0]
        self.__get_query_results(filename, qid)


    def __get_query_results(self, filename, qid):
        query = 'SELECT backend, schema FROM dataset WHERE queryId= ?'
        c = self.conn.cursor()
        c.execute(query, (qid,))
        row = c.fetchone()
        backend = row[0]
        schema = json.loads(row[1])
        res = []
        if backend == 'grappa':
            filename = grappa_data_path + filename + '.bin'
            res.append(schema)
            col_size = len(eval(schema['columnNames']))
            with open(filename, 'rb') as f:
                # TODO properly print out bytes as int
                data = f.read(8)
                while data:
                    tuples = ""
                    i = 0
                    while i < col_size - 1:
                        tuples = tuples + str(struct.unpack('<q', data[0])) + " "
                        data = f.read(8)
                        i = i + 1
                    tuples = tuples + str(struct.unpack('<q', data[0]))
                    val = {'tuple': tuples}
                    res.append(val)
                    data = f.read(8)
        else:
            filename = compile_path + filename
            res.append(schema)
            with open(filename, 'r') as f:
                data = f.read().split('\n')
                for row in data:
                    if row:
                        val = {'tuple': row}
                        res.append(val)

        print json.dumps(res)


    def get_num_tuples(self, params):
        """params: username, programname, relationname"""

        query = 'SELECT numTuples FROM dataset WHERE userName = ? AND ' + \
                'programName = ? AND relationName = ? ORDER BY queryId DESC'
        c = self.conn.cursor()
        c.execute(query, (params[0], params[1], params[2],))
        row = c.fetchone()
        res = {'numTuples': row[0]}
        print json.dumps(res)


    def get_latest_qid(self, params):
        """params: <none>"""
        # node doesnt like return values
        query = 'SELECT queryId FROM dataset ORDER BY queryId DESC LIMIT 1'
        c = self.conn.cursor()
        c.execute(query)
        row = c.fetchone()
        if row is None:
            print 0
        else:
            print row[0]


    def __get_min_entry(self, min, backend):
        query = 'SELECT queryId FROM dataset WHERE backend = ? AND ' \
            + 'queryId >= ? ORDER BY queryId LIMIT 1'
        c = self.conn.cursor()
        c.execute(query, (backend, min))
        row = c.fetchone()
        return row[0]


    def __get_max_entry(self, max, backend):
        if max == 0:
            query = 'SELECT queryId FROM dataset WHERE backend = ? ' \
                + 'ORDER BY queryId DESC LIMIT 1'
        else:
            query = 'SELECT queryId FROM dataset WHERE backend = ? AND ' \
                + 'queryId <= ? ORDER BY queryId DESC LIMIT 1'
        c = self.conn.cursor()
        if max == 0:
            c.execute(query, (backend,))
        else:
            c.execute(query, (backend, max))
        row = c.fetchone()
        if row is not None:
            return row[0]
        else:
            return 0


    def __latest_qid(self):
        query = 'SELECT queryId FROM dataset ORDER BY queryId DESC LIMIT 1'
        c = self.conn.cursor()
        c.execute(query)
        row = c.fetchone()
        if row is None:
            return 0
        else:
            return row[0]


    def insert_new_dataset(self, params):
        """params: filename of csv to import new dataset(s)"""

        c = self.conn.cursor()
        with open(params[0], 'r') as f:
            data = f.read().split('\n')
            query = 'INSERT INTO dataset VALUES' + \
                    '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            for row in data:
                if row=='': break
                cur_time = time.time()
                qid = self.__latest_qid() + 1
                val = row.split(',')
                num_cols = int(val[6])
                col_names = []
                col_types = []
                for i in range(num_cols):
                    col_names.append(val[7+i])
                    col_types.append(val[7+i+num_cols])
                schema = json.dumps({'columnNames': str(col_names),
                                     'columnTypes': str(col_types)})
                param_list = (val[0], val[1], val[2], qid, cur_time, val[3],
                              'SUCCESS', cur_time, cur_time, 0, val[4], schema,
                              val[5], 'Insert dataset')
                c.execute(query, param_list)
                self.conn.commit()


    def check_db(self):
        """checks if table exists, otherwise creates the db"""

        check = 'SELECT name FROM sqlite_master WHERE type="table"' + \
                'AND name="dataset"'
        c = self.conn.cursor()
        c.execute(check)
        row = c.fetchone()
        if row is None:
            create_db()


    def create_db(self):
        c = self.conn.cursor()
        create = 'CREATE TABLE IF NOT EXISTS dataset (userName text,' + \
                 ' programName text, relationName text, queryId int,' + \
                 ' created datetime, url text, status text,' + \
                 ' startTime datetime, endTime datetime, elapsed datetime,' + \
                 ' numTuples int, schema text, backend text, query text,' + \
                 'PRIMARY KEY (queryId))'
        c.execute(create)
        self.conn.commit()


def main(args):
    opt = parse_options(args)
    func = opt.function
    params = opt.p
    db = DatastoreAPI()
    db.check_db()
    # dispatch command
    getattr(db, func)(params)

if __name__ == "__main__":
    main(sys.argv[1:])
