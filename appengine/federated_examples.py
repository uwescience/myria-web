
simple_bd = """connect(%afl, "vega.cs.washington.edu:7777");

%afl("b2 = filter(b1, val > 1000)");
"""

__myrial_examples = [
    ('Simple bigdog query', simple_bd)
]

federated_examples = {
    'datalog': [],
    'sql': [],
    'myrial': __myrial_examples
}
