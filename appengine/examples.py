import os

# Examples is a dictionary from language -> [pairs]. Each pair is (Label, Code).
datalog_examples = [
  ('Filter', '''A(x) :- R(x,3)'''),
  ('Join and filter', '''A(x) :- R(x,y), S(y,z,4), z<3'''),
  ('Self-join', '''A(x,z) :- R(x,y), R(y,z)'''),
  ('Triangles', '''A(x,y,z) :- R(x,y), S(y,z), T(z,x)'''),
  ('Cross Product', '''A(x,z) :- S(x), T(z)'''),
  ('Two cycles', 'A(x,z) :- R(x,y), S(y,a,z), T(z,b,x), W(a,b)'),
  ('Two Chained Rules', 'A(x,z) :- R(x,y,z).\nB(w) :- A(3,w)'),
  ('Two Independent Rules', 'A(x,z) :- R(x,y,z).\nB(w) :- C(3,w)'),
  ('Project TwitterK', 'JustX(x) :- TwitterK(x,y)'),
  ('Self Join TwitterK', 'SelfJoin(x,z) :- TwitterK(x,y), TwitterK(y,z)'),
  ('In Degrees from TwitterK', 'InDegree(x, COUNT(y)) :- TwitterK(x,y)'),
  ('Two Hops Count in TwitterK', 'TwoHopsCountK(x,z,COUNT(y)) :- TwitterK(x,y), TwitterK(y,z)'),
  ('Triangles TwitterK', 'Triangles(x,y,z) :- TwitterK(x,y), TwitterK(y,z), TwitterK(z,x)'),
  ('NCCDC Filtered to Attack Window', '''attackwindow(src, dst, time) :-
    nccdc(src,dst,proto,time, x, y, z)
    , time > 1366475761
    , time < 1366475821'''),
  ('NCCDC DDOS Victims', '''InDegree(dst, count(time)) :- nccdc(src, dst, prot, time, x, y, z).
Victim(dst) :- InDegree(dst, cnt), cnt > 10000'''),
  ('SP2Bench Q10', '''Q10(subject, predicate) :-
    sp2bench_1m(subject, predicate, 'person:Paul_Erdoes')'''),
  ('SP2Bench Q3a', '''Q3a(article) :- sp2bench_1m(article, 'rdf:type', 'bench:Article')
              , sp2bench_1m(article, 'swrc:pages', value)'''),
  ('SP2Bench Q1', '''Q1(yr) :- sp2bench_1m(journal, 'rdf:type', 'bench:Journal')
        , sp2bench_1m(journal, 'dc:title', 'Journal 1 (1940)')
        , sp2bench_1m(journal, 'dcterms:issued', yr)''')
]


def get_example(name):
    path = os.path.join(os.path.dirname(__file__),
                    'examples/{}'.format(name))
    with open(path) as fh:
        return fh.read().strip()

load_twitterk_data = '''T1 = load("https://s3-us-west-2.amazonaws.com/uwdb/sampleData/TwitterK.csv",
csv(schema(a:int, b:int),skip=0));
store(T1, TwitterK, [a, b]);'''

justx = '''T1 = scan(TwitterK);
T2 = [from T1 emit $0 as x];
store(T2, JustX);'''

aggregation = '''T1 = scan(TwitterK);
Agg = [from T1 emit count(a) AS cnt, T1.a AS id];
store(Agg, Twitter_aggregate, [$1]);'''

twohops = '''T1 = scan(TwitterK);
T2 = scan(TwitterK);
Joined = [from T1, T2
          where T1.$1 = T2.$0
          emit T1.$0 as src, T1.$1 as link, T2.$1 as dst];
store(Joined, TwoHopsInTwitter);'''

stateful_apply = '''apply counter() {
  [0 AS c];
  [c + 1];
  c;
};
T1 = scan(TwitterK);
T2 = [from T1 emit $0, counter()];
store (T2, K);'''

union = '''T2 =  scan(TwitterK);
T3 = scan(TwitterK);
result = T2+T3;
store(result, union_result);'''

connected_components = '''E = scan(TwitterK);
V = select distinct E.$0 from E;
CC = [from V emit V.$0 as node_id, V.$0 as component_id];
do
  new_CC = [from E, CC where E.$0 = CC.$0 emit E.$1, CC.$1] + CC;
  new_CC = [from new_CC emit new_CC.$0, MIN(new_CC.$1)];
  delta = diff(CC, new_CC);
  CC = new_CC;
while [from delta emit count(*) > 0];
comp = [from CC emit CC.$1 as id, count(CC.$0) as cnt];
store(comp, TwitterCC);'''

myria_examples = [
    ('Load TwitterK data', load_twitterk_data),
    ('Projection', justx),
    ('Aggregation', aggregation),
    ('Calculate all two hops in the TwitterK relation using a simple join', twohops),
    ('Stateful Apply', stateful_apply),
    ('Union', union),
    ('Connected components', connected_components),
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
