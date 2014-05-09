import os

# Examples is a dictionary from language -> [pairs]. Each pair is (Label, Code).
datalog_examples = [
  ('Filter', '''A(x) :- R(x,3)'''),
  ('Join and filter', '''A(x) :- R(x,y), S(y,z,4), z<3'''),
  ('Self-join', '''A(x,z) :- R(x,y), R(y,z)'''),
  ('Triangles', '''A(x,y,z) :- R(x,y), S(y,z), T(z,x)'''),
  ('Cross Product', '''A(x,z) :- S(x), T(z)'''),
  ('Two cycles', 'A(x,z) :- R(x,y), S(y,a,z), T(z,b,x), W(a,b)'),
  ('Two Chained Rules', 'A(x,z) :- R(x,y,z)\n\nB(w) :- A(3,w)'),
  ('Two Independent Rules', 'A(x,z) :- R(x,y,z)\n\nB(w) :- C(3,w)'),
  ('Project TwitterK', 'JustX(x) :- TwitterK(x,y)'),
  ('Self Join TwitterK', 'SelfJoin(x,z) :- TwitterK(x,y), TwitterK(y,z)'),
  ('In Degrees from TwitterK', 'InDegree(x, COUNT(y)) :- TwitterK(x,y)'),
  ('Two Hops Count in TwitterK', 'TwoHopsCountK(x,z,COUNT(y)) :- TwitterK(x,y), TwitterK(y,z)'),
  ('Triangles TwitterK', 'Triangles(x,y,z) :- TwitterK(x,y), TwitterK(y,z), TwitterK(z,x)'),
  ('NCCDC Filtered to Attack Window', '''attackwindow(src, dst, time) :-
    nccdc(src,dst,proto,time, x, y, z)
    , time > 1366475761
    , time < 1366475821'''),
  ('NCCDC DDOS Victims', '''InDegree(dst, count(time)) :- nccdc(src, dst, proto, time, x, y, z)

Victim(dst) :- InDegree(dst, cnt), cnt > 10000'''),
  ('SP2Bench Q10', '''Q10(subject, predicate) :-
    sp2bench_1m(subject, predicate, 'person:Paul_Erdoes')'''),
  ('SP2Bench Q3a', '''Q3a(article) :-
    sp2bench_1m(article, 'rdf:type', 'bench:Article')
    , sp2bench_1m(article, 'swrc:pages', value)'''),
  ('SP2Bench Q1', '''Q1(yr) :-
    sp2bench_1m(journal, 'rdf:type', 'bench:Journal')
    , sp2bench_1m(journal, 'dc:title', 'Journal 1 (1940)')
    , sp2bench_1m(journal, 'dcterms:issued', yr)''')
]


def get_example(name):
    path = os.path.join(os.path.dirname(__file__),
                    'examples/{}'.format(name))
    with open(path) as fh:
        return fh.read().strip()


justx = '''T1 = scan(TwitterK);
T2 = [from T1 emit $0 as x];
store(T2, JustX);'''

myria_examples = [
    ('JustX', justx),
#    ('Sigma-Clipping', get_example('sigma-clipping-v0.myl')),
#    ('Sigma-Clipping Optimized', get_example('sigma-clipping.myl')),
#    ('Highlighter demo', get_example('language_demo.myl'))
]

sql_examples = [
    ('JustX', '''JustX = SELECT $0 AS x FROM SCAN(TwitterK) AS Twitter;

store(JustX, public:adhoc:JustX);'''),
    ('InDegree', '''InDegree = SELECT $0, COUNT($1) FROM SCAN(TwitterK) AS Twitter;

store(InDegree, public:adhoc:InDegree);'''),
]

examples = { 'datalog' : datalog_examples,
             'myrial' : myria_examples,
             'sql' : sql_examples }
