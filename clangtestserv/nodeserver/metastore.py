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

conn = sqlite3.connect('dataset.db')
raco_path = os.environ["RACO_HOME"] + '/'
grappa_path = os.environ["GRAPPA_HOME"] + '/'
compile_path = raco_path + 'c_test_environment/'
scheme_path = compile_path + 'schema/'
grappa_data_path = '/shared/'


def parse_options(args):
    parser = argparse.ArgumentParser()

    parser.add_argument('function', metavar='f', type=str,
                        help='function to call for db storing/retrieving')

    parser.add_argument('-p', nargs='+',
                        help='params for the function')

    ns = parser.parse_args(args)
    return ns


# params: rel_keys url qid backend
# retrieves query, inserts into db
def process_query(params):
    conn = sqlite3.connect('dataset.db')
    relkey = params[0].split('_')
    default_schema = json.dumps({'columnNames': "[]", 'columnTypes': "[]"})
    qid = params[2]
    backend = params[3]
    c = conn.cursor()
    cur_time = time.time()
    query = 'INSERT INTO dataset VALUES' + \
            '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    param_list = (relkey[0], relkey[1], relkey[2], qid, cur_time, params[1],
                  'ACCEPTED', cur_time, None, 0, 0, default_schema, backend)
    try:
        c.execute(query, param_list)
        conn.commit()
        print str(cur_time) + ' ' + qid + ' started'
    except sqlite3.IntegrityError as e:
        update_query_error(qid, e.output)


# params: qid filename backend
def update_query_run(params):
    conn = sqlite3.connect('dataset.db')
    query = 'UPDATE dataset SET status = "RUNNING" WHERE queryId = ?'
    c = conn.cursor()
    c.execute(query, (params[0],))
    conn.commit()
    run_query(params)


# params: qid filename backend
def run_query(params):
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
        update_scheme(filename, qid, backend)
    except subprocess.CalledProcessError as e:
        update_query_error(qid, e.output)


def update_query_error(qid, e):
    stat_query = 'UPDATE dataset SET status = "ERROR" WHERE queryId = ?'
    cat_query = 'UPDATE dataset SET numTuples = 0 WHERE queryId = ?'
    c = conn.cursor()
    c.execute(stat_query, (qid,))
    c.execute(cat_query, (qid,))
    conn.commit()
    print 'error:' + str(e)


def update_scheme(filename, qid, backend):
    if backend == 'grappa':
        openfile = grappa_data_path + filename
    else:
        openfile = scheme_path + filename
    try:
        with open(openfile + '.schema', 'r') as f:
            data = f.read().split('\n')
            schema = {'columnNames': data[0], 'columnTypes': data[1]}
            query = 'UPDATE dataset SET schema = ? WHERE queryId = ?'
            c = conn.cursor()
            c.execute(query, (json.dumps(schema), qid))
            conn.commit()
            update_catalog(filename, qid, backend, data[0])
            update_query_success(qid)
    except IOError as e:
        update_query_error(qid, e.output)


def update_catalog(filename, qid, backend, col_names):
    if backend == 'grappa':
        filename = grappa_data_path + filename + '.bin'
    else:
        filename = compile_path + filename
        p1 = Popen(['cat', filename], stdout=subprocess.PIPE)
        p2 = Popen(['wc', '-l'], stdin=p1.stdout, stdout=subprocess.PIPE)
        p1.stdout.close()  # Allow p1 to receive a SIGPIPE if p2 exits.
        output = int(p2.communicate()[0])
    if backend == 'grappa':
        col_size = len(eval(col_names))
        file_size = os.stat(filename).st_size
        tuple_size = 8
        output = file_size / tuple_size / col_size
    c = conn.cursor()
    query = 'UPDATE dataset SET numTuples = ? WHERE queryId = ?'
    c.execute(query, (output, qid))
    conn.commit()


def update_query_success(qid):
    stop = time.time()
    sel_query = 'SELECT startTime FROM dataset WHERE queryId = ?'
    upd_query = 'UPDATE dataset SET status = "SUCCESS", endTime = ?,' + \
                'elapsed = ? WHERE queryId = ?'
    c = conn.cursor()
    c.execute(sel_query, (qid,))
    start = c.fetchone()[0]
    elapsed = (stop - start) * 1000000000  # turn to nanoseconds
    params_list = (stop, elapsed, qid)
    c.execute(upd_query, params_list)
    conn.commit()
    print str(stop) + ' ' + qid + ' done'


# params: qid
def get_query_status(params):
    c = conn.cursor()
    query = 'SELECT * FROM dataset WHERE queryId= ?'
    c.execute(query, (params[0],))
    row = c.fetchone()
    if row[6] == 'SUCCESS':
        fin = datetime.datetime.fromtimestamp(row[8]).isoformat()
        elapsed = row[9]
    else:
        fin = 'None'
        elapsed = (time.time() - row[7]) * 1000000000
    conn.close()
    res = {'status': row[6], 'queryId': row[3], 'url': row[5],
           'startTime': datetime.datetime.fromtimestamp(row[7]).isoformat(),
           'finishTime': fin, 'elapsedNanos': elapsed}
    print json.dumps(res)


# params: userName programName relationName
def check_catalog(params):
    c = conn.cursor()
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


# params: backend
def select_table(params):
    conn = sqlite3.connect('dataset.db')
    res = []
    query = 'SELECT * FROM dataset WHERE backend = ?'
    c = conn.cursor()
    for row in c.execute(query, (params[0], )):
        val = {'relationKey': {'userName': row[0], 'programName': row[1],
                               'relationName': row[2]}, 'queryId': row[3],
               'created': row[4], 'uri': row[5], 'status': row[6],
               'startTime': row[7], 'endTime': row[8], 'elapsedNanos': row[9],
               'numTuples': row[10], 'schema': row[11], 'backend': row[12]}
        res.append(val)
    conn.close()
    print json.dumps(res)


# params: qid
def select_row(params):
    conn = sqlite3.connect('dataset.db')
    res = []
    query = 'SELECT * FROM dataset WHERE queryId = ?'
    c = conn.cursor()
    for row in c.execute(query, (params[0],)):
        scheme = json.loads(row[11])
        val = {'relationKey': {'userName': row[0], 'programName': row[1],
                               'relationName': row[2]}, 'queryId': row[3],
               'created': row[4], 'uri': row[5], 'status': row[6],
               'startTime': row[7], 'endTime': row[8], 'elapsedNanos': row[9],
               'numTuples': row[10], 'schema': scheme}
        res.append(val)
    conn.close()
    print json.dumps(res)


# params: qid
def get_filename(params):
    qid = params[0]
    query = 'SELECT relationName FROM dataset ' + \
            'WHERE queryId= ?'
    conn = sqlite3.connect('dataset.db')
    c = conn.cursor()
    c.execute(query, (qid,))
    row = c.fetchone()
    filename = row[0]
    conn.close()
    get_query_results(filename, qid)


def get_query_results(filename, qid):
    query = 'SELECT backend, schema FROM dataset WHERE queryId= ?'
    conn = sqlite3.connect('dataset.db')
    c = conn.cursor()
    c.execute(query, (qid,))
    row = c.fetchone()
    backend = row[0]
    res = []
    if backend == 'grappa':
        filename = grappa_data_path + filename + '.bin'
        res.append(json.loads(row[1]))
        with open(filename, 'rb') as f:
            # TODO properly print out bytess as ints
            data = f.read(4)
            while data:
                val = {'tuple': data}
                res.append(val)
                data = f.read(4)
    else:
        filename = compile_path + filename
        res.append(json.loads(row[1]))
        with open(filename, 'r') as f:
            data = f.read().split('\n')
            for row in data:
                if row:
                    val = {'tuple': row}
                    res.append(val)

    print json.dumps(res)


# params: qid
def get_num_tuples(params):
    query = 'SELECT numTuples FROM dataset WHERE queryId= ?'
    conn = sqlite3.connect('dataset.db')
    c = conn.cursor()
    c.execute(query, params[0])
    row = c.fetchone()
    res = {'numTuples': row[0]}
    conn.close()
    print json.dumps(res)


# checks if table exists, otherwise creates the s
def check_db():
    check = 'SELECT name FROM sqlite_master WHERE type="table"' + \
            'AND name="dataset"'
    c = conn.cursor()
    c.execute(check)
    row = c.fetchone()
    if row is None:
        create = 'CREATE TABLE IF NOT EXISTS dataset (userName text,' + \
                 ' programName text, relationName text, queryId int ' + \
                 ' primary key, created datatime, url text, status text,' + \
                 ' startTime datetime, endTime datetime, elapsed datetime,' + \
                 ' numTuples int, schema text, backend text)'
        c.execute(create)
        conn.commit()


def main(args):
    opt = parse_options(args)
    func = opt.function
    params = opt.p
    check_db()
    if func == 'process_query':
        process_query(params)
    elif func == 'get_query_status':
        get_query_status(params)
    elif func == 'update_query_run':
        update_query_run(params)
    elif func == 'check_catalog':
        check_catalog(params)
    elif func == 'select_table':
        select_table(params)
    elif func == 'select_row':
        select_row(params)
    elif func == 'get_filename':
        get_filename(params)
    elif func == 'num_tuples':
        get_num_tuples(params)

if __name__ == "__main__":
    main(sys.argv[1:])
