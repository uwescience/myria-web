#!/usr/bin/env python

""" Does database storage for node.js server """

import argparse
import sys
import sqlite3
import time
import json
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
    write_file(params[0], qid, params[3])


def write_file(filename, qid, plan):
    print compile_path + filename + '.cpp'
    f = open(compile_path + filename + '.cpp', 'w')
    f.write(plan)
    print plan
    f.close()
    pass


def main(args):
    opt = parse_options(args)
    func = opt.function
    params = opt.p
    if func == 'process_query':
        process_query(params)
    elif func == 'clang':
        pass


if __name__ == "__main__":
    main(sys.argv[1:])
