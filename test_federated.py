import requests


query = """-- exec myriax
-------------------------
-- Constants + Functions
-------------------------
const bins: 10;

def iif(expression, true_value, false_value):
    case when expression then true_value
         else false_value end;
def bin(x, high, low): greater(least(int((bins-1) * (x - low) / iif(high != low, high - low, 1)),
                                bins - 1), 0);
def difference(current, previous, previous_time, time):
    iif(previous_time >= 0,
        (current - previous) * iif(previous_time < time, 1, -1),
        current);
uda HarrTransformGroupBy(time, x) {
  [0.0 as coefficient, 0.0 as _sum, 0 as _count, -1 as _time];
  [difference(x, coefficient, _time, time), _sum + x, _count + 1, time];
  [coefficient, _sum / int(_count)];
};

------------------------------------------------------------------------------------
-- Harr Transform
------------------------------------------------------------------------------------
vectors = scan(SciDB:Demo:Vectors);

groups = [from vectors emit
                 id,
                 int(floor(time/2)) as time,
                 HarrTransformGroupBy(time, value) as [coefficient, mean]];

histogram = [from groups
             emit id,
                  bin(coefficient, 1, 0) as index,
                  count(bin(coefficient, 1, 0)) as value];

-- *******************************
--- Added to test orchestrator
r = scan(Brandon:Demo:Vectors);
histogram = histogram + r;
-- *******************************

sink(histogram);
"""

payload = {'query': query,
           'language': 'myrial',
           'backend': 'federated',
           'profile': False,
           'push_sql': False}

r = requests.post("http://localhost:8080/execute", data=payload)

print r.text
