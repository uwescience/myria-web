
simple_bd = """connect(%afl, "http://vega.cs.washington.edu:8080");

%afl("store(filter(B1, data > 0), B4)");
"""

combined_bd = """connect(%afl, "http://vega.cs.washington.edu:8080");

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

mimic_query = '''connect(%afl, "http://vega.cs.washington.edu:8080");

order = scan(public:adhoc:poe_order);
med = scan(public:adhoc:poe_med);

treatments = [from order, med where order.poe_id=med.poe_id
              emit subject_id, drug_name];
store(treatments, mimic_output);

%afl("store(filter(B1, data > 0), B21)");
'''

__myrial_examples = [
    ('mimic query', mimic_query),
    ('Simple join', simple_join),
    ('Simple AFL query', simple_bd),
    ('AFL + Myrial query', combined_bd)
]

federated_examples = {
    'datalog': [],
    'sql': [],
    'myrial': __myrial_examples
}
