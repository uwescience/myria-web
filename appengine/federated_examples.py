
simple_bd = """connect(%afl, "vega.cs.washington.edu:7777");

%afl("store(filter(B1, data > 0), B4)");
"""

combined_bd = """connect(%afl, "vega.cs.washington.edu:7777");

X = scan(public:adhoc:sc_points);
Y = [from X where X.v > 0 emit *];
store(Y, public:adhoc:bd_output);

%afl("store(filter(B1, data > 0), B4)");
"""

__myrial_examples = [
    ('Simple AFL query', simple_bd),
    ('AFL + Myrial query', combined_bd)
]

federated_examples = {
    'datalog': [],
    'sql': [],
    'myrial': __myrial_examples
}
