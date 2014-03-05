import json
from threading import Lock
import urllib
import webapp2
import csv
import copy
import math

import jinja2

from raco import RACompiler
from raco.myrial.exceptions import MyrialCompileException
from raco.myrial import parser as MyrialParser
from raco.myrial import interpreter as MyrialInterpreter
from raco.language import MyriaAlgebra
from raco.myrialang import compile_to_json
from raco.viz import get_dot
from raco import scheme
from examples import examples
from pagination import Pagination

import myria

defaultquery = """A(x) :- R(x,3)"""
hostname = "vega.cs.washington.edu"
port = 8777
# We need a (global) lock on the Myrial parser because yacc is not Threadsafe.
# .. see uwescience/datalogcompiler#39
# ..    (https://github.com/uwescience/datalogcompiler/issues/39)
myrial_parser_lock = Lock()
myrial_parser = MyrialParser.Parser()


JINJA_ENVIRONMENT = jinja2.Environment(
    loader=jinja2.FileSystemLoader('templates'),
    extensions=['jinja2.ext.autoescape'],
    autoescape=True)

QUERIES_PER_PAGE = 10


def get_plan(query, language, plan_type):
    # Fix up the language string
    if language is None:
        language = "datalog"
    language = language.strip().lower()

    if language == "datalog":
        dlog = RACompiler()
        dlog.fromDatalog(query)
        if not dlog.logicalplan:
            raise SyntaxError("Unable to parse Datalog")
        if plan_type == 'logical':
            return dlog.logicalplan
        dlog.optimize(target=MyriaAlgebra, eliminate_common_subexpressions=False)
        if plan_type == 'physical':
            return dlog.physicalplan
        else:
            raise NotImplementedError('Datalog plan type %s' % plan_type)
    elif language in ["myrial", "sql"]:
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

    def get_scheme(self, rel_key):
        relation_args = {
            'userName': rel_key.user,
            'programName': rel_key.program,
            'relationName': rel_key.relation
        }
        try:
            dataset_info = self.connection.dataset(relation_args)
        except myria.MyriaError:
            return None
        schema = dataset_info['schema']
        return scheme.Scheme(zip(schema['columnNames'], schema['columnTypes']))


def get_queries(connection=None):
    if connection is None:
        try:
            connection = myria.MyriaConnection(hostname=hostname, port=port)
        except myria.MyriaError:
            return []
    try:
        return connection.queries()[1]
    except myria.MyriaError:
        return []

class MyriaHandler(webapp2.RequestHandler):
    def handle_exception(self, exception, debug_mode):
        self.response.headers['Content-Type'] = 'text/plain'
        if isinstance(exception, (SyntaxError, MyrialCompileException)):
            self.response.status = 400
            msg = str(exception)
        else:
            self.response.status = 500
            self.response.out.write("Error 500 (Internal Server Error)")
            if debug_mode:
                self.response.out.write(": \n\n")
                import traceback
                msg = traceback.format_exc()

        self.response.out.write(msg)

class RedirectToEditor(MyriaHandler):
    def get(self, query=None):
        if query is not None:
            self.redirect("/editor?query=%s" % urllib.quote(query, ''), True)
        else:
            self.redirect("/editor", True)


class MyriaPage(MyriaHandler):
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
            limit = int(self.request.get('limit', QUERIES_PER_PAGE))
            max_ = self.request.get('max', None)
            count, queries = connection.queries(limit, max_)
            if max_:
                max_ = int(max_)
            else:
                max_ = count
        except myria.MyriaError:
            connection = None
            queries = []

        for q in queries:
            q['elapsedStr'] = nano_to_str(q['elapsedNanos'])
            if q['status'] == 'KILLED':
                q['bootstrapStatus'] = 'danger'
            elif q['status'] == 'SUCCESS':
                q['bootstrapStatus'] = 'success'
            elif q['status'] == 'RUNNING':
                q['bootstrapStatus'] = 'warning'
            else:
                q['bootstrapStatus'] = ''

        template_vars = {'queries': queries,
                         'prevUrl': None,
                         'nextUrl': None}

        if queries:
            page = int(math.ceil(count - max_) / limit) + 1
            args = {arg: self.request.get(arg)
                    for arg in self.request.arguments()
                    if arg != 'page'}

            def page_url(page, current_max, pagination):
                largs = copy.copy(args)
                if page > 0:
                    largs['max'] = (current_max +
                                    (pagination.page - page) * limit)
                else:
                    largs.pop("max", None)
                return '{}?{}'.format(
                    self.request.path, urllib.urlencode(largs))

            template_vars['pagination'] = Pagination(
                page, limit, count)
            template_vars['current_max'] = max_
            template_vars['page_url'] = page_url
        else:
            template_vars['current_max'] = 0
            template_vars['pagination'] = Pagination(
                1, limit, 0)

        # Actually render the page: HTML content
        self.response.headers['Content-Type'] = 'text/html'
        # .. connection string
        template_vars['connectionString'] = self.get_connection_string()
        # .. load and render the template
        template = JINJA_ENVIRONMENT.get_template('queries.html')
        self.response.out.write(template.render(template_vars))


class Profile(MyriaPage):
    def get(self):
        query_id = self.request.get("queryId")
        query_plan = {}
        if query_id != '':
            try:
                connection = myria.MyriaConnection(hostname=hostname, port=port)
                query_plan = connection.get_query_status(query_id)
            except myria.MyriaError:
                pass

        template_vars = {
            'queryId': query_id,
            'myriaConnection': "%s:%d" % (hostname, port),
            'queryPlan': json.dumps(query_plan)
        }

        # Actually render the page: HTML content
        self.response.headers['Content-Type'] = 'text/html'
        # .. connection string
        template_vars['connectionString'] = self.get_connection_string()
        # .. load and render the template
        template = JINJA_ENVIRONMENT.get_template('visualization.html')
        self.response.out.write(template.render(template_vars))


class Histogram(MyriaPage):
    def get(self):
        query_id = self.request.get("queryId")
        fragment_id = self.request.get("fragmentId")

        def get_historgram(data):
            WORKER = 0
            TIME = 1
            TYPE = 2
            workers = set()
            # ignore header
            data.next()
            for trans in data:
                worker = int(trans[WORKER])
                if trans[TYPE] == 'call':
                    workers.add(worker)
                elif trans[TYPE] == 'return':
                    # This should be a remove but there seems to be
                    # a missing call
                    workers.discard(worker)
                else:
                    continue
                yield [trans[TIME], list(workers)]

        try:
            connection = myria.MyriaConnection(hostname=hostname, port=port)
            ret = get_historgram(
                connection.get_profiling_log_roots(query_id, fragment_id))
            self.response.headers['Content-Type'] = 'text/plain'
            writer = csv.writer(self.response.out)
            writer.writerow(['time', 'value'])
            writer.writerows(ret)
        except myria.MyriaError as e:
            raise
            self.response.headers['Content-Type'] = 'text/plain'
            self.response.write(e)


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
                d['queryUrl'] = 'http://%s:%d/query/query-%d' % (hostname, port, d['queryId'])
            except:
                pass

        template_vars = {'datasets': datasets}

        # Actually render the page: HTML content
        self.response.headers['Content-Type'] = 'text/html'
        # .. connection string
        template_vars['connectionString'] = self.get_connection_string()
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
        template_vars['connectionString'] = self.get_connection_string()
        # .. load and render the template
        template = JINJA_ENVIRONMENT.get_template('editor.html')
        self.response.out.write(template.render(template_vars))


class Plan(MyriaHandler):
    def post(self):
        "The same as get(), here because there may be long programs"
        self.get()

    def get(self):
        self.response.headers.add_header("Access-Control-Allow-Origin", "*")
        query = self.request.get("query")
        language = self.request.get("language")
        try:
            plan = get_logical_plan(query, language)
        except (MyrialCompileException, MyrialInterpreter.NoSuchRelationException) as e:
            self.response.headers['Content-Type'] = 'text/plain'
            self.response.write(str(e))
            self.response.status = 400
            return

        self.response.headers['Content-Type'] = 'application/json'
        self.response.write(json.dumps(format_rule(plan)))


class Optimize(MyriaHandler):
    def get(self):
        self.response.headers.add_header("Access-Control-Allow-Origin", "*")
        query = self.request.get("query")
        language = self.request.get("language")
        try:
            optimized = get_physical_plan(query, language)
        except MyrialInterpreter.NoSuchRelationException as e:
            self.response.headers['Content-Type'] = 'text/plain'
            self.response.write("Error 400 (Bad Request): Relation %s not found" % str(e))
            self.response.status = 400
            return

        self.response.headers['Content-Type'] = 'application/json'
        self.response.write(json.dumps(format_rule(optimized)))

    def post(self):
        "The same as get(), here because there may be long programs"
        self.get()

class Compile(MyriaHandler):
    def get(self):
        self.response.headers.add_header("Access-Control-Allow-Origin", "*")
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

        self.response.headers['Content-Type'] = 'application/json'
        self.response.write(json.dumps(compiled))

    def post(self):
        "The same as get(), here because there may be long programs"
        self.get()


class Execute(MyriaHandler):
    def post(self):
        self.response.headers.add_header("Access-Control-Allow-Origin", "*")
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
            query_url = 'http://%s:%d/execute?query_id=%d' % (hostname, port, query_status['queryId'])
            ret = {'queryStatus': query_status, 'url': query_url}
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
        self.response.headers.add_header("Access-Control-Allow-Origin", "*")
        try:
            connection = myria.MyriaConnection(hostname=hostname, port=port)
        except myria.MyriaError:
            self.response.headers['Content-Type'] = 'text/plain'
            self.response.status = 503
            self.response.write("Error 503 (Service Unavailable): Unable to connect to REST server to issue query")
            return

        query_id = self.request.get("queryId")

        try:
            query_status = connection.get_query_status(query_id)
            self.response.headers['Content-Type'] = 'application/json'
            ret = {'queryStatus': query_status, 'url': self.request.url}
            self.response.write(json.dumps(ret))
        except myria.MyriaError as e:
            self.response.headers['Content-Type'] = 'text/plain'
            self.response.write(e)

class Dot(MyriaHandler):
    def get(self):
        self.response.headers.add_header("Access-Control-Allow-Origin", "*")
        query = self.request.get("query")
        language = self.request.get("language")
        plan_type = self.request.get("type")

        plan = get_plan(query, language, plan_type)

        self.response.headers['Content-Type'] = 'text/plain'
        self.response.write(get_dot(plan))

    def post(self):
        "The same as get(), here because there may be long programs"
        self.get()

app = webapp2.WSGIApplication(
    [
        ('/', RedirectToEditor),
        ('/editor', Editor),
        ('/queries', Queries),
        ('/profile', Profile),
        ('/histogram', Histogram),
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
