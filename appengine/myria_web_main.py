import json
import os.path
from threading import Lock
import urllib
import webapp2
import csv

from raco import RACompiler
from raco.myrial import parser as MyrialParser
from raco.myrial import interpreter as MyrialInterpreter
from raco.language import MyriaAlgebra
from raco.myrialang import compile_to_json
from raco.viz import get_dot
from raco import scheme
from examples import examples
import jinja2

import myria
from states_to_utilization import get_utilization
from tests.data import EXAMPLE_DETAILS

defaultquery = """A(x) :- R(x,3)"""
hostname = "vega.cs.washington.edu"
port = 1776
# We need a (global) lock on the Myrial parser because yacc is not Threadsafe.
# .. see uwescience/datalogcompiler#39
# ..    (https://github.com/uwescience/datalogcompiler/issues/39)
myrial_parser_lock = Lock()
myrial_parser = MyrialParser.Parser()


JINJA_ENVIRONMENT = jinja2.Environment(
    loader=jinja2.FileSystemLoader('templates'),
    extensions=['jinja2.ext.autoescape'],
    autoescape=True)

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
        else:
            raise NotImplementedError('Datalog plan type %s' % plan_type)
    elif language == "myria":
        # We need a (global) lock on the Myrial parser because yacc is not Threadsafe.
        # .. and App Engine uses multiple threads.
        with myrial_parser_lock:
            parsed = myrial_parser.parse(query)
        processor = MyrialInterpreter.StatementProcessor(MyriaCatalog())
        processor.evaluate(parsed)
        if plan_type == 'logical':
            return processor.get_logical_plan()
        elif plan_type == 'physical':
            return processor.get_physical_plan()
        else:
            raise NotImplementedError('Myria plan type %s' % plan_type)
    else:
        raise NotImplementedError('Language %s is not supported' % language)

    raise NotImplementedError('Should not be able to get here')


def get_logical_plan(query, language):
    return get_plan(query, language, 'logical')


def get_physical_plan(query, language=None):
    return get_plan(query, language, 'physical')


def format_rule(expressions):
    if isinstance(expressions, list):
        return "\n".join(["%s = %s" % e for e in expressions])
    return str(expressions)


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
            'user_name': 'public',
            'program_name': 'adhoc',
            'relation_name': relation_name
        }
        try:
            dataset_info = self.connection.dataset(relation_key)
        except myria.MyriaError:
            return None
        schema = dataset_info['schema']
        return scheme.Scheme(zip(schema['column_names'], schema['column_types']))


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
    if m:
        elapsed_str = '%dm ' % m + elapsed_str
    if h:
        elapsed_str = '%dh ' % h + elapsed_str
    if d:
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

        template_vars = {'queries': queries}

        # Actually render the page: HTML content
        self.response.headers['Content-Type'] = 'text/html'
        # .. connection string
        template_vars['connection_string'] = self.get_connection_string()
        # .. load and render the template
        template = JINJA_ENVIRONMENT.get_template('queries.html')
        self.response.out.write(template.render(template_vars))


class Stats(MyriaPage):
    def get(self):
        template_vars = {
            'query_id': self.request.get("query_id"),
            'fragment_id': self.request.get("fragment_id"),
            'worker_id': self.request.get("worker_id"),
            'format': self.request.get("format")
        }

        tmpl = 'queryvis.html'
        if template_vars['fragment_id']:
            tmpl = 'fragmentvis.html'
            if template_vars['worker_id']:
                tmpl = 'operatorvis.html'

        if tmpl == 'queryvis.html':
            try:
                connection = myria.MyriaConnection(hostname=hostname, port=port)
            except myria.MyriaError:
                self.response.headers['Content-Type'] = 'text/plain'
                self.response.status = 503
                self.response.write("Error 503 (Service Unavailable): Unable to connect to REST server to issue query")
                return
            frags = connection.get_fragment_ids(template_vars['query_id'])
            template_vars['fragments'] = frags

        # Actually render the page: HTML content
        self.response.headers['Content-Type'] = 'text/html'
        # .. connection string
        template_vars['connection_string'] = self.get_connection_string()
        # .. load and render the template
        template = JINJA_ENVIRONMENT.get_template(tmpl)
        self.response.out.write(template.render(template_vars))


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

        template_vars = {'datasets': datasets}

        # Actually render the page: HTML content
        self.response.headers['Content-Type'] = 'text/html'
        # .. connection string
        template_vars['connection_string'] = self.get_connection_string()
        # .. load and render the template
        template = JINJA_ENVIRONMENT.get_template('datasets.html')
        self.response.out.write(template.render(template_vars))


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
        template = JINJA_ENVIRONMENT.get_template('editor.html')
        self.response.out.write(template.render(template_vars))


class Plan(webapp2.RequestHandler):
    def get(self):
        query = self.request.get("query")
        language = self.request.get("language")
        try:
            plan = get_logical_plan(query, language)
        except MyrialInterpreter.NoSuchRelationException as e:
            self.response.headers['Content-Type'] = 'text/plain'
            self.response.write("Error 400 (Bad Request): Relation %s not found" % str(e))
            self.response.status = 400
            return

        self.response.headers['Content-Type'] = 'text/plain'
        self.response.write(format_rule(plan))


class Optimize(webapp2.RequestHandler):
    def get(self):
        query = self.request.get("query")
        language = self.request.get("language")
        try:
            optimized = get_physical_plan(query, language)
        except MyrialInterpreter.NoSuchRelationException as e:
            self.response.headers['Content-Type'] = 'text/plain'
            self.response.write("Error 400 (Bad Request): Relation %s not found" % str(e))
            self.response.status = 400
            return

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
            ret = {'query_status': query_status, 'url': query_url}
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
        show_details = self.request.get("details", False) in ["true", "1"]

        try:
            query_status = connection.get_query_status(query_id)
            self.response.headers['Content-Type'] = 'application/json'
            ret = {'query_status': query_status, 'url': self.request.url}
            if show_details:
                ret['details'] = EXAMPLE_DETAILS
            self.response.write(json.dumps(ret))
        except myria.MyriaError as e:
            self.response.headers['Content-Type'] = 'text/plain'
            self.response.write(e)


class StatsData(webapp2.RequestHandler):
    def get(self):
        try:
            connection = myria.MyriaConnection(hostname=hostname, port=port, timeout=600)
        except myria.MyriaError:
            self.response.headers['Content-Type'] = 'text/plain'
            self.response.status = 503
            self.response.write("Error 503 (Service Unavailable): Unable to connect to REST server to issue query")
            return

        query_id = self.request.get("query_id")
        fragment_id = self.request.get("fragment_id")
        worker_id = self.request.get("worker_id")
        aggregated = self.request.get("aggregated").lower() in ["true", "1"]

        try:
            logs = connection.get_profile_logs(query_id, fragment_id, worker_id)
            if aggregated:
                ret = get_utilization(logs)
                self.response.headers['Content-Type'] = 'application/csv'
                writer = csv.writer(self.response.out)
                writer.writerow(['time', 'value'])
                writer.writerows(ret['data'])
            else:
                self.response.write(json.dumps(logs))
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
        self.response.write(get_dot(plan))

app = webapp2.WSGIApplication(
    [
        ('/', RedirectToEditor),
        ('/editor', Editor),
        ('/queries', Queries),
        ('/stats', Stats),
        ('/statsdata', StatsData),
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
