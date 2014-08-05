#!/usr/bin/env python

""" Does database storage for node.js server """

import argparse
import sys
import sqlite3
import time
import json
import datetime
#from datetime import date
conn = sqlite3.connect('dataset.db')
compile_path = '../../submodules/raco/c_test_environment/'
dataset_path = compile_path + 'datasets/'
scheme_path = compile_path + 'schema/'


def parse_options(args):
    parser = argparse.ArgumentParser()

    parser.add_argument('function', metavar='f', type=str,
                        help='function to call for db storing/retrieving')

    parser.add_argument('-p', nargs='+',
                        help='params for the function')

    ns = parser.parse_args(args)
    return ns


# params: filename url qid
def process_query(params):
    relkey = params[0].split(':')
    qid = params[2]
    c = conn.cursor()
    cur_time = time.time()
    query = 'INSERT INTO dataset VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    param_list = (relkey[0], relkey[1], relkey[2], qid, cur_time, params[1],
                  'ACCEPTED', cur_time, None, 0, 0, "")
    c.execute(query, param_list)
    conn.commit()
    conn.close()


# params: filename qid plan
def write_file(params):
    f = open(compile_path + params[0] + '.cpp', 'w')
    f.write(params[2])
    f.close()


# params: qid
def update_query_run(params):
    query = 'UPDATE dataset SET status = "RUNNING" WHERE queryId = ?'
    c = conn.cursor()
    c.execute(query, (params[0],))
    conn.commit()
    conn.close()


# params: qid
def update_query_success(params):
    qid = params[0]
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
    conn.close()


# params qid
def get_query_status(params):
    c = conn.cursor()
    query = 'SELECT * FROM dataset WHERE queryId= ?'
    c.execute(query, (params[0],))
    row = c.fetchone()
    if not row[8]:
        fin = 'None'
        elapsed = time.time()
    else:
        fin = datetime.datetime.fromtimestamp(row[8]).isoformat()
        elapsed = row[9]
    res = {"status": row[6], "queryId": row[3], "url": row[5],
           "startTime": datetime.datetime.fromtimestamp(row[7]).isoformat(),
           "finishTime": fin, "elapsedNanos": elapsed}
    conn.close()
    print json.dumps(res)


def main(args):
    opt = parse_options(args)
    func = opt.function
    params = opt.p
    if func == 'process_query':
        process_query(params)
    elif func == 'get_query_status':
        get_query_status(params)
    elif func == 'update_query_run':
        update_query_run(params)
    elif func == 'update_query_success':
        update_query_success(params)
    elif func == 'write_file':
        write_file(params)


if __name__ == "__main__":
    main(sys.argv[1:])
