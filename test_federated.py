import requests

myriaweb_url = 'http://localhost:8080'
#myriaweb_url = 'http://localhost:8090'

#-- exec myriax
querym = """-- exec myriax
------------------------------------------------------------------------------------
-- Import from SciDB
------------------------------------------------------------------------------------
symbols0x1 = load("file:///{path_prefix}/0/out/transform_1", csv(schema(id:int, index:int, value:int)));
symbols1x1 = load("file:///{path_prefix}/1/out/transform_1", csv(schema(id:int, index:int, value:int)));
symbols0x2 = load("file:///{path_prefix}/0/out/transform_2", csv(schema(id:int, index:int, value:int)));
symbols1x2 = load("file:///{path_prefix}/1/out/transform_2", csv(schema(id:int, index:int, value:int)));
symbols0x3 = load("file:///{path_prefix}/0/out/transform_3", csv(schema(id:int, index:int, value:int)));
symbols1x3 = load("file:///{path_prefix}/1/out/transform_3", csv(schema(id:int, index:int, value:int)));
symbols0x4 = load("file:///{path_prefix}/0/out/transform_4", csv(schema(id:int, index:int, value:int)));
symbols1x4 = load("file:///{path_prefix}/1/out/transform_4", csv(schema(id:int, index:int, value:int)));
symbols0x5 = load("file:///{path_prefix}/0/out/transform_5", csv(schema(id:int, index:int, value:int)));
symbols1x5 = load("file:///{path_prefix}/1/out/transform_5", csv(schema(id:int, index:int, value:int)));
symbols0x6 = load("file:///{path_prefix}/0/out/transform_6", csv(schema(id:int, index:int, value:int)));
symbols1x6 = load("file:///{path_prefix}/1/out/transform_6", csv(schema(id:int, index:int, value:int)));
symbols0x7 = load("file:///{path_prefix}/0/out/transform_7", csv(schema(id:int, index:int, value:int)));
symbols1x7 = load("file:///{path_prefix}/1/out/transform_7", csv(schema(id:int, index:int, value:int)));
symbols0x8 = load("file:///{path_prefix}/0/out/transform_8", csv(schema(id:int, index:int, value:int)));
symbols1x8 = load("file:///{path_prefix}/1/out/transform_8", csv(schema(id:int, index:int, value:int)));

symbols = symbols0x1 + symbols0x2 + symbols0x3 + symbols0x4 +
          symbols0x5 + symbols0x6 + symbols0x7 + symbols0x8 +
          symbols1x1 + symbols1x2 + symbols1x3 + symbols1x4 +
          symbols1x5 + symbols1x6 + symbols1x7 + symbols1x8;
store(symbols, symbols);
symbols = scan(symbols);
""".format(path_prefix = 'state/partition1/scidb-bhaynes/data/000') +\
"""
--========================================================================
-- Myria
--========================================================================

const test_vector_id1: 1;
def idf(w_ij, w_ijN, N): log(N / w_ijN) * w_ij;


------------------------------------------------------------------------------------
-- IDF
------------------------------------------------------------------------------------
ids = distinct([from symbols emit id]);
N = [from ids emit count(*) as N];
frequencies = [from symbols emit value, index, count(*) as frequency];

tfv = [from symbols, frequencies, N
       where symbols.value = frequencies.value
       emit id, index, idf(value, frequency, N) as value];

------------------------------------------------------------------------------------
-- Conditioning
------------------------------------------------------------------------------------
moments = [from tfv emit id,
                         avg(value) as mean,
                         -- Sample estimator
                         sqrt((stdev(value)*stdev(value)*count(value))/(count(value)-1)) as std];
conditioned_tfv = [from tfv, moments
                   where tfv.id = moments.id
                   emit id, index, value as v, mean, std, (value - mean) / std as value];
sum_squares = [from conditioned_tfv
               emit id, sum(pow(value, 2)) as sum_squares];

------------------------------------------------------------------------------------
-- k-NN
------------------------------------------------------------------------------------

test_vector = [from conditioned_tfv where id = test_vector_id1 emit *];

products = [from test_vector as x,
                 conditioned_tfv as y
                where x.index = y.index
                emit y.id as id, sum(x.value * y.value) as product];

correlations = [from products, sum_squares
                where products.id = sum_squares.id
                emit products.id as id, product / sum_squares as rho];

sink(correlations);
"""


queryh = """
const test_vector_id: 1;
const bins: 10;
vectors = scan(SciDB:Demo:Vectors);

-------------------------
-- Constants + Functions
-------------------------
const alpha: 1.0;

def log2(x): log(x) / log(2);
def mod2(x): x - int(x/2)*2;
def iif(expression, true_value, false_value):
    case when expression then true_value
         else false_value end;
def bucket(x, high, low): greater(least(int((bins-1) * (x - low) / iif(high != low, high - low, 1)),
                                bins - 1), 0);
def difference(current, previous, previous_time, time):
    iif(previous_time >= 0,
        (current - previous) * iif(previous_time < time, 1, -1),
        current);

symbols = empty(id:int, index:int, value:int);

------------------------------------------------------------------------------------
-- Harr Transform
------------------------------------------------------------------------------------
uda HarrTransformGroupBy(alpha, time, x) {
  [0.0 as coefficient, 0.0 as _sum, 0 as _count, -1 as _time];
  [difference(x, coefficient, _time, time), _sum + x, _count + 1, time];
  [coefficient, _sum / int(_count * alpha)];
};

iterations = [from vectors where id = test_vector_id emit 0 as i, int(ceil(log2(count(*)))) as total];
do
    groups = [from vectors emit
                     id,
                     int(floor(time/2)) as time,
                     HarrTransformGroupBy(alpha, time, value) as [coefficient, mean]];
    coefficients = [from groups emit id, coefficient];
    range = [from vectors emit max(value) - min(value) as high, min(value) - max(value) as low];
    histogram = [from coefficients, range
                 emit id,
                      bucket(coefficient, high, low) as index,
                      count(bucket(coefficient, high, low)) as value];
    symbols = symbols + [from histogram, iterations emit id, index + i*bins as index, value];
    vectors = [from groups emit id, time, mean as value];
    iterations = [from iterations emit $0 + 1, $1];
while [from iterations emit $0 < $1];

sink(symbols);

--========================================================================
-- Myria
--========================================================================

const test_vector_id1: 1;
def idf(w_ij, w_ijN, N): log(N / w_ijN) * w_ij;


------------------------------------------------------------------------------------
-- IDF
------------------------------------------------------------------------------------
ids = distinct([from symbols emit id]);
N = [from ids emit count(*) as N];
frequencies = [from symbols emit value, index, count(*) as frequency];

tfv = [from symbols, frequencies, N
       where symbols.value = frequencies.value
       emit id, index, idf(value, frequency, N) as value];

------------------------------------------------------------------------------------
-- Conditioning
------------------------------------------------------------------------------------
moments = [from tfv emit id,
                         avg(value) as mean,
                         -- Sample estimator
                         sqrt((stdev(value)*stdev(value)*count(value))/(count(value)-1)) as std];
conditioned_tfv = [from tfv, moments
                   where tfv.id = moments.id
                   emit id, index, value as v, mean, std, (value - mean) / std as value];
sum_squares = [from conditioned_tfv
               emit id, sum(pow(value, 2)) as sum_squares];

------------------------------------------------------------------------------------
-- k-NN
------------------------------------------------------------------------------------

test_vector = [from conditioned_tfv where id = test_vector_id1 emit *];

products = [from test_vector as x,
                 conditioned_tfv as y
                where x.index = y.index
                emit y.id as id, sum(x.value * y.value) as product];

correlations = [from products, sum_squares
                where products.id = sum_squares.id
                emit products.id as id, product / sum_squares as rho];

sink(correlations);
"""

querys = """-- exec scidb
scan(relation600x256);
"""

payload = {'query': querys,   #querym
           'language': 'myrial',
           'backend': 'federated',
           'profile': False,
           'push_sql': False}

r = requests.post("{0}/execute".format(myriaweb_url), data=payload)

print r.text
