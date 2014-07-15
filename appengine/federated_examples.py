
simple_bd = """connect(%afl, "vega.cs.washington.edu:7777");

%afl("store(filter(B1, data > 0), B4)");
"""

combined_bd = """connect(%afl, "vega.cs.washington.edu:7777");

X = scan(public:adhoc:sc_points);
Y = [from X where X.v > 0 emit *];
store(Y, public:adhoc:bd_output);

%afl("store(filter(B1, data > 0), B4)");
"""

simple_join = '''Dept = scan(public:adhoc:department);
Emp = scan(public:adhoc:employee);

EmpDept = [from Emp, Dept
           where Emp.dept_id=Dept.id
           emit Emp.*, Dept.name as dept_name];
Rich = [from EmpDept where salary > 6000 emit name, dept_name];

store(Rich, myrial_output);'''

__myrial_examples = [
    ('Simple join', simple_join),
    ('Simple AFL query', simple_bd),
    ('AFL + Myrial query', combined_bd)
]

federated_examples = {
    'datalog': [],
    'sql': [],
    'myrial': __myrial_examples
}
