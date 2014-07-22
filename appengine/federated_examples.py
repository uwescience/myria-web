
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

%afl("store(subarray(waveform_signal_table, 325553800041, 1, 325553800041, 100), B23)");
'''

mimic_federated = '''connect(%afl, "http://vega.cs.washington.edu:8080");

order = scan(public:adhoc:poe_order);
med = scan(public:adhoc:poe_med);

X = distinct([from order, med
              where order.poe_id=med.poe_id
                    and drug_name="Metoprolol"
              emit subject_id]);
store(X, mimic_output);

exportMyriaToSciDB(mimic_output, "J111");
%afl("store(filter(J111, f0 > 100), J222)");
'''

retail_join = '''txheader = scan(txheader);
product = scan(product);
txtype = scan(txtype);
txdetail = scan(txdetail);
storetable = scan(public:adhoc:"store");

X = [from txheader, txtype, txdetail, product, storetable
     where txheader.TxHeaderID=txdetail.TxHeaderID AND
           txheader.StoreID=storetable.StoreID AND
           txheader.TxTypeID=txtype.TxTypeID AND
           txdetail.ProductID=product.ProductID
     emit count(*)];
store(X, retail_query_output);
'''

__myrial_examples = [
    ('federated mimic query', mimic_federated),
    ('Standalone mimic query', mimic_query),
    ('Retail table join', retail_join),
    ('Simple join', simple_join),
    ('Simple AFL query', simple_bd),
    ('AFL + Myrial query', combined_bd)
]

federated_examples = {
    'datalog': [],
    'sql': [],
    'myrial': __myrial_examples
}
