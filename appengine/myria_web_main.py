from raco import RACompiler
from raco.myrial import parser as MyrialParser
from raco.myrial import interpreter as MyrialInterpreter
from raco.language import MyriaAlgebra
from raco.myrialang import compile_to_json
from raco.viz import plan_to_dot
from google.appengine.ext.webapp import template

import myria

import json
import os.path
from threading import Lock
import urllib
import webapp2

defaultquery = """A(x) :- R(x,3)"""
hostname = "vega.cs.washington.edu"
port = 1776
# We need a (global) lock on the Myrial parser because yacc is not Threadsafe.
# .. see uwescience/datalogcompiler#39
# ..    (https://github.com/uwescience/datalogcompiler/issues/39)
myrial_parser_lock = Lock()

def get_plan(query, language, plan_type):
    # Fix up the language string
    if language is None:
        language = "datalog"
    language = language.strip().lower()

    if language == "datalog":
        dlog = RACompiler()
        dlog.fromDatalog(query)
        if not dlog.logicalplan:
            raise SyntaxError("Unable to parse Datalog from query '''%s'''" % query)
        if plan_type == 'logical':
            return dlog.logicalplan
        dlog.optimize(target=MyriaAlgebra, eliminate_common_subexpressions=False)
        if plan_type == 'physical':
            return dlog.physicalplan
    elif language == "myria":
        # We need a (global) lock on the Myrial parser because yacc is not Threadsafe.
        # .. and App Engine uses multiple threads.
        with myrial_parser_lock:
            parser = MyrialParser.Parser()
            parsed = parser.parse(query)
        processor = MyrialInterpreter.StatementProcessor()
        processor.evaluate(parsed)
        if plan_type == 'logical':
            return processor.output_symbols
        if plan_type == 'physical':
            raise NotImplementedError('Myria physical plans')
    else:
        raise NotImplementedError('Language %s is not supported' % language)

    raise NotImplementedError('Should not be able to get here')

def get_logical_plan(query, language):
    return get_plan(query, language, 'logical')

def get_physical_plan(query, language=None):
    return get_plan(query, language, 'physical')

def format_rule(expressions):
    return "\n".join(["%s = %s" % e for e in expressions])

def get_datasets(connection=None):
    if connection is None:
        try:
            connection = myria.MyriaConnection(hostname=hostname, port=port)
        except myria.MyriaError:
            return []
    try:
        return connection.datasets()
    except myria.MyriaError:
        return []

class MyriaCatalog:
    def __init__(self, connection=None):
        if not connection:
            connection = myria.MyriaConnection(hostname=hostname, port=port)
        self.connection = connection

    def get_scheme(self, relation_name):
        relation_key = {
                'user_name' : 'public',
                'program_name' : 'adhoc',
                'relation_name' : relation_name
        }
        try:
            dataset_info = self.connection.dataset(relation_key)
        except myria.MyriaError:
            return None
        scheme = dataset_info['schema']
        return zip(scheme['column_names'], scheme['column_types'])

def get_queries(connection=None):
    if connection is None:
        try:
            connection = myria.MyriaConnection(hostname=hostname, port=port)
        except myria.MyriaError:
            return []
    try:
        return connection.queries()
    except myria.MyriaError:
        return []

class RedirectToEditor(webapp2.RequestHandler):
    def get(self, query=None):
        if query is not None:
            self.redirect("/editor?query=%s" % urllib.quote(query, ''), True)
        else:
            self.redirect("/editor", True)

class MyriaPage(webapp2.RequestHandler):
    def get_connection_string(self, connection=None):
        try:
            if connection is None:
                connection = myria.MyriaConnection(hostname=hostname, port=port)
            workers = connection.workers()
            alive = connection.workers_alive()
            connection_string = "%s:%d [%d/%d]" % (hostname, port, len(alive), len(workers))
        except myria.MyriaError:
            connection_string = "unable to connect to %s:%d" % (hostname, port)
        return connection_string

def nano_to_str(elapsed):
    if elapsed is None:
        return None
    s = elapsed / 1000000000.0
    m, s = divmod(s, 60)
    h, m = divmod(m, 60)
    d, h = divmod(h, 24)
    elapsed_str = ' %fs' % s
    if m > 0:
        elapsed_str = '%dm ' % m + elapsed_str
    if h > 0:
        elapsed_str = '%dh ' % h + elapsed_str
    if d > 0:
        elapsed_str = '%dd ' % d + elapsed_str
    return elapsed_str

class Queries(MyriaPage):
    def get(self):
        try:
            connection = myria.MyriaConnection(hostname=hostname, port=port)
            queries = connection.queries()
        except myria.MyriaError:
            connection = None
            queries = []

        for q in queries:
            q['elapsed_str'] = nano_to_str(q['elapsed_nanos'])
            if q['status'] == 'KILLED':
                q['bootstrap_status'] = 'danger'
            elif q['status'] == 'SUCCESS':
                q['bootstrap_status'] = 'success'
            elif q['status'] == 'RUNNING':
                q['bootstrap_status'] = 'warning'
            else:
                q['bootstrap_status'] = ''

        # Actually render the page: HTML content
        self.response.headers['Content-Type'] = 'text/html'
        # .. connection string
        connection_string = self.get_connection_string(connection)
        # .. load and render the template
        path = os.path.join(os.path.dirname(__file__), 'templates/queries.html')
        self.response.out.write(template.render(path, locals()))


class Datasets(MyriaPage):
    def get(self):
        try:
            connection = myria.MyriaConnection(hostname=hostname, port=port)
            datasets = connection.datasets()
        except myria.MyriaError:
            connection = None
            datasets = []

        for d in datasets:
            try:
                d['query_url'] = 'http://%s:%d/query/query-%d' % (hostname, port, d['query_id'])
            except:
                pass

        # Actually render the page: HTML content
        self.response.headers['Content-Type'] = 'text/html'
        # .. connection string
        connection_string = self.get_connection_string(connection)
        # .. load and render the template
        path = os.path.join(os.path.dirname(__file__), 'templates/datasets.html')
        self.response.out.write(template.render(path, locals()))
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
  ('JustX', '''T1 = SCAN(public:adhoc:Twitter,
          follower:int, followee:int);

T2 = [FROM T1 EMIT x=$0];

STORE (T2, JustX);'''),
]

examples = { 'datalog' : datalog_examples,
             'myria' : myria_examples }

class Examples(MyriaPage):
    def get(self):
        # Get the language
        language = self.request.get('language')
        if not language:
            # default to Datalog
            language = 'datalog'
        else:
            language = language.strip().lower()
        # Is language recognized?
        if language not in examples:
        # Is the language recognized?
            self.response.headers['Content-Type'] = 'text/plain'
            self.response.status = 404
            self.response.write('Error 404 (Not Found): language %s not found' % language)
            return
        # Return the objects as json
        self.response.headers['Content-Type'] = 'application/json'
        self.response.write(json.dumps(examples[language]))

class Editor(MyriaPage):
    def get(self, query=defaultquery):
        # Actually render the page: HTML content
        self.response.headers['Content-Type'] = 'text/html'
        template_vars = {}
        # .. pass in the query
        template_vars['query'] = query
        # .. pass in the Datalog examples to start
        template_vars['examples'] = examples['datalog']
        # .. connection string
        template_vars['connection_string'] = self.get_connection_string()
        # .. load and render the template
        path = os.path.join(os.path.dirname(__file__), 'templates/editor.html')
        self.response.out.write(template.render(path, template_vars))

class Plan(webapp2.RequestHandler):
    def get(self):
        query = self.request.get("query")
        language = self.request.get("language")
        plan = get_logical_plan(query, language)

        self.response.headers['Content-Type'] = 'text/plain'
        self.response.write(format_rule(plan))

class Optimize(webapp2.RequestHandler):
    def get(self):
        query = self.request.get("query")
        language = self.request.get("language")
        optimized = get_physical_plan(query, language)

        self.response.headers['Content-Type'] = 'text/plain'
        self.response.write(optimized)

class Compile(webapp2.RequestHandler):
    def get(self):
        query = self.request.get("query")

        dlog = RACompiler()
        dlog.fromDatalog(query)
        # Cache logical plan
        cached_logicalplan = str(dlog.logicalplan)

        # Generate physical plan
        dlog.optimize(target=MyriaAlgebra, eliminate_common_subexpressions=False)

        # Get the Catalog needed to get schemas for compiling the query
        try:
            catalog = MyriaCatalog()
        except myria.MyriaError:
            catalog = None
        # .. and compile it
        try:
            compiled = compile_to_json(query, cached_logicalplan, dlog.physicalplan, catalog)
            self.response.headers['Content-Type'] = 'application/json'
            self.response.write(json.dumps(compiled))
            return
        except ValueError as e:
            self.response.headers['Content-Type'] = 'text/plain'
            self.response.write("Error 400 (Bad Request): %s" % str(e))
            self.response.status = 400
            return

class Execute(webapp2.RequestHandler):
    def post(self):
        try:
            connection = myria.MyriaConnection(hostname=hostname, port=port)
        except myria.MyriaError:
            self.response.headers['Content-Type'] = 'text/plain'
            self.response.write("Error 503 (Service Unavailable): Unable to connect to REST server to issue query")
            self.response.status = 503
            return

        query = self.request.get("query")
        language = self.request.get("language")

        cached_logicalplan = str(get_logical_plan(query, language))

        # Generate physical plan
        physicalplan = get_physical_plan(query, language)

        # Get the Catalog needed to get schemas for compiling the query
        try:
            catalog = MyriaCatalog()
        except myria.MyriaError:
            catalog = None
        # .. and compile
        try:
            compiled = compile_to_json(query, cached_logicalplan, physicalplan, catalog)
        except ValueError as e:
            self.response.headers['Content-Type'] = 'text/plain'
            self.response.write("Error 400 (Bad Request): %s" % str(e))
            self.response.status = 400
            return

        # Issue the query
        try:
            query_status = connection.submit_query(compiled)
            query_url = 'http://%s:%d/execute?query_id=%d' % (hostname, port, query_status['query_id'])
            ret = {'query_status' : query_status, 'url' : query_url}
            self.response.status = 201
            self.response.headers['Content-Type'] = 'application/json'
            self.response.headers['Content-Location'] = query_url
            self.response.write(json.dumps(ret))
            return
        except myria.MyriaError as e:
            self.response.headers['Content-Type'] = 'text/plain'
            self.response.status = 400
            self.response.write("Error 400 (Bad Request): %s" % str(e))
            return

    def get(self):
        try:
            connection = myria.MyriaConnection(hostname=hostname, port=port)
        except myria.MyriaError:
            self.response.headers['Content-Type'] = 'text/plain'
            self.response.status = 503
            self.response.write("Error 503 (Service Unavailable): Unable to connect to REST server to issue query")
            return

        query_id = self.request.get("query_id")

        try:
            query_status = connection.get_query_status(query_id)
            self.response.headers['Content-Type'] = 'application/json'
            ret = {'query_status' : query_status, 'url' : self.request.url}
            self.response.write(json.dumps(ret))
        except myria.MyriaError as e:
            self.response.headers['Content-Type'] = 'text/plain'
            self.response.write(e)


class Dot(webapp2.RequestHandler):
    def get(self):
        query = self.request.get("query")
        language = self.request.get("language")
        plan_type = self.request.get("type")

        plan = get_plan(query, language, plan_type)

        self.response.headers['Content-Type'] = 'text/plain'
        self.response.write(plan_to_dot(plan))

app = webapp2.WSGIApplication([
   ('/', RedirectToEditor),
   ('/editor', Editor),
   ('/queries', Queries),
   ('/datasets', Datasets),
   ('/plan', Plan),
   ('/optimize', Optimize),
   ('/compile', Compile),
   ('/execute', Execute),
   ('/dot', Dot),
   ('/examples', Examples),
  ],
  debug=True
)

"""
TODO: 
Debug conditions: A(x,z) :- R(x,p1,y),R(y,p2,z),R(z,p3,w)
Multiple rules
Recursion
Show graph visually
Protobuf
Show parse errors (with link to error)
"""
