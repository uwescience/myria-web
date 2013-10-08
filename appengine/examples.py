# Examples is a dictionary from language -> [pairs]. Each pair is (Label, Code).
datalog_examples = [
  ('Select', '''A(x) :- R(x,3)'''),
  ('Select2', '''A(x) :- R(x,y), S(y,z,4), z<3'''),
  ('Self-join', '''A(x,z) :- R(x,y), R(y,z)'''),
  ('Triangle', '''A(x,z) :- R(x,y), S(y,z), T(z,x)'''),
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

myria_examples = [
  ('JustX', '''T1 = SCAN(Twitter);

T2 = [FROM T1 EMIT x=$0];

STORE (T2, JustX);'''),
  ('Sigma-Clipping', '''Points = SCAN(public:adhoc:Points, v:float);

aggs = [FROM Points EMIT _sum=SUM(v), sumsq=SUM(v*v), cnt=COUNT(v)];
newBad = SCAN(empty, v:float);

bounds = [FROM Points EMIT lower=MIN(v), upper=MAX(v)];

DO
    -- Incrementally update aggs and stats
    new_aggs = [FROM newBad EMIT _sum=SUM(v), sumsq=SUM(v*v), cnt=COUNT(v)];
    aggs = [FROM aggs, new_aggs EMIT _sum=aggs._sum - new_aggs._sum,
            sumsq=aggs.sumsq - new_aggs.sumsq, cnt=aggs.cnt - new_aggs.cnt];

    stats = [FROM aggs EMIT mean=_sum/cnt,
             std=SQRT(1.0/(cnt*(cnt-1)) * (cnt * sumsq - _sum * _sum))];

    -- Compute the new bounds
    newBounds = [FROM stats EMIT lower=mean - 2 * std, upper=mean + 2 * std];

    tooLow = [FROM Points, bounds, newBounds WHERE newBounds.lower > v
              AND v >= bounds.lower EMIT v=Points.v];
    tooHigh = [FROM Points, bounds, newBounds WHERE newBounds.upper < v
               AND v <= bounds.upper EMIT v=Points.v];
    newBad = UNIONALL(tooLow, tooHigh);

    bounds = newBounds;
    continue = [FROM newBad EMIT COUNT(v) > 0];
WHILE continue;

output = [FROM Points, bounds WHERE Points.v > bounds.lower AND
          Points.v < bounds.upper EMIT v=Points.v];
DUMP(output);''')
]

examples = { 'datalog' : datalog_examples,
             'myria' : myria_examples }