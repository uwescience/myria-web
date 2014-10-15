import copy
from distutils.util import strtobool
import json
import logging
import math
import os
import requests
from threading import Lock
import urllib
import webapp2

import jinja2

from raco import RACompiler
from raco.myrial.exceptions import MyrialCompileException
from raco.myrial import parser as MyrialParser
from raco.myrial import interpreter as MyrialInterpreter
from raco.language.myrialang import (MyriaLeftDeepTreeAlgebra,
                                     MyriaHyperCubeAlgebra,
                                     compile_to_json)
from raco.language.logical import OptLogicalAlgebra

from raco.viz import get_dot
from raco.myrial.keywords import get_keywords
from raco.catalog import Catalog
from raco.algebra import DEFAULT_CARDINALITY
from raco import scheme
from examples import examples
from demo3_examples import demo3_examples
from pagination import Pagination

import myria

# We need a (global) lock on the Myrial parser because yacc is not Threadsafe.
# .. see uwescience/datalogcompiler#39
# ..    (https://github.com/uwescience/datalogcompiler/issues/39)
myrial_parser_lock = Lock()
myrial_parser = MyrialParser.Parser()


def is_small_dataset(d, cell_limit=0):
    """A dataset is small if we know its size and the size is below the
    specified cell limit. (Number of cells is # cols * # rows.)"""
    return (d['numTuples'] >= 0 and
            ((cell_limit == 0) or
            (len(d['schema']['columnNames']) * d['numTuples'] <= cell_limit)))

JINJA_ENVIRONMENT = jinja2.Environment(
    loader=jinja2.FileSystemLoader('templates'),
    extensions=['jinja2.ext.autoescape'],
    autoescape=True)
JINJA_ENVIRONMENT.tests["small_dataset"] = is_small_dataset

version_file_path = os.path.join(os.path.dirname(__file__), 'VERSION')
branch_file_path = os.path.join(os.path.dirname(__file__), 'BRANCH')

try:
    with open(version_file_path, 'r') as version_file:
        VERSION = version_file.read().strip()
except:
    VERSION = "commit version file not found"

try:
    with open(branch_file_path, 'r') as branch_file:
        BRANCH = branch_file.read().strip()
except:
    BRANCH = "branch file not found"

QUERIES_PER_PAGE = 25


def get_plan(query, language, plan_type, connection,
             multiway_join=False, push_sql=False):
    catalog = None
    if multiway_join:
        catalog = MyriaCatalog(connection)
        assert catalog.get_num_servers()
    # Fix up the language string
    if language is None:
        language = "datalog"
    language = language.strip().lower()

    if multiway_join:
        target_algebra = MyriaHyperCubeAlgebra(catalog)
    else:
        target_algebra = MyriaLeftDeepTreeAlgebra()

    if language == "datalog":
        dlog = RACompiler()
        dlog.fromDatalog(query)
        if not dlog.logicalplan:
            raise SyntaxError("Unable to parse Datalog")

        if plan_type == 'logical':
            return dlog.logicalplan
        elif plan_type == 'physical':
            dlog.optimize(target=target_algebra, push_sql=push_sql)
            return dlog.physicalplan
        else:
            raise NotImplementedError('Datalog plan type %s' % plan_type)
    elif language in ["myrial", "sql"]:
        # We need a (global) lock on the Myrial parser because yacc
        # .. is not Threadsafe and App Engine uses multiple threads.
        with myrial_parser_lock:
            parsed = myrial_parser.parse(query)
        processor = MyrialInterpreter.StatementProcessor(
            MyriaCatalog(connection))
        processor.evaluate(parsed)
        if plan_type == 'logical':
            return processor.get_physical_plan(target_alg=OptLogicalAlgebra())
        elif plan_type == 'physical':
            return processor.get_physical_plan(target_alg=target_algebra,
                                               multiway_join=multiway_join,
                                               push_sql=push_sql)
        else:
            raise NotImplementedError('Myria plan type %s' % plan_type)

    raise NotImplementedError('Language %s is not supported' % language)


def get_logical_plan(query, language, connection, push_sql=False):
    return get_plan(query, language, 'logical', connection, push_sql=push_sql)


def get_physical_plan(query, language, connection,
                      multiway_join=False, push_sql=False):
    return get_plan(query, language, 'physical', connection,
                    multiway_join=multiway_join, push_sql=push_sql)


def format_rule(expressions):
    if isinstance(expressions, list):
        return "\n".join(["%s = %s" % e for e in expressions])
    return str(expressions)


def get_datasets(connection):
    if not connection:
        return []
    try:
        return connection.datasets()
    except myria.MyriaError:
        return []


class MyriaCatalog(Catalog):

    def __init__(self, connection):
        self.connection = connection

    def get_scheme(self, rel_key):
        relation_args = {
            'userName': rel_key.user,
            'programName': rel_key.program,
            'relationName': rel_key.relation
        }
        if not self.connection:
            raise RuntimeError(
                "no schema for relation %s because no connection" % rel_key)
        try:
            dataset_info = self.connection.dataset(relation_args)
        except myria.MyriaError:
            raise ValueError('No relation {} in the catalog'.format(rel_key))
        schema = dataset_info['schema']
        return scheme.Scheme(zip(schema['columnNames'], schema['columnTypes']))

    def get_num_servers(self):
        if not self.connection:
            raise RuntimeError("no connection.")
        return len(self.connection.workers_alive())

    def num_tuples(self, rel_key):
        relation_args = {
            'userName': rel_key.user,
            'programName': rel_key.program,
            'relationName': rel_key.relation
        }
        if not self.connection:
            raise RuntimeError(
                "no cardinality of %s because no connection" % rel_key)
        try:
            dataset_info = self.connection.dataset(relation_args)
        except myria.MyriaError:
            raise ValueError(rel_key)
        num_tuples = dataset_info['numTuples']
        assert isinstance(num_tuples, (int, long)), type(num_tuples)
        # that's a work round. numTuples is -1 if the dataset is old
        if num_tuples != -1:
            assert num_tuples >= 0
            return num_tuples
        return DEFAULT_CARDINALITY


class MyriaHandler(webapp2.RequestHandler):

    def get_boolean_request_param(self, name, default=False):
        """Fetch a request parameter with the specified name, and return it as
        a boolean value. Missing parameters default to False, unless the
        optional default parameter is provided.

        :param name: (string) the parameter to be decoded
        :param default: (bool) the value of the parameter if missing from
                        the request.
        """
        return bool(strtobool(self.request.get(name, str(default))))

    def handle_exception(self, exception, debug_mode):
        self.response.headers['Content-Type'] = 'text/plain'
        if isinstance(exception,
                      (ValueError, SyntaxError, MyrialCompileException)):
            self.response.status = 400
            msg = '{}: {}'.format(exception.__class__.__name__, exception)
        else:
            self.response.status = 500
            msg = ""
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

    def get_connection_string(self):
        conn = self.app.connection
        hostname = self.app.hostname
        port = self.app.port
        if not conn:
            connection_string = "unable to connect to %s:%d" % (hostname, port)
        else:
            try:
                workers = conn.workers()
                alive = conn.workers_alive()
                connection_string = "%s:%d [%d/%d]" %\
                    (hostname, port, len(alive), len(workers))
            except:
                connection_string = "error connecting to %s:%d" % (
                    hostname, port)
        return connection_string

    def base_template_vars(self):
        if self.app.ssl:
            uri_scheme = "https"
        else:
            uri_scheme = "http"
        return {'connectionString': self.get_connection_string(),
                'myriaConnection': "{s}://{h}:{p}".format(
                    s=uri_scheme, h=self.app.hostname, p=self.app.port),
                'version': VERSION,
                'branch': BRANCH}


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
        conn = self.app.connection
        try:
            limit = int(self.request.get('limit', QUERIES_PER_PAGE))
        except (ValueError, TypeError):
            limit = 1

        try:
            max_ = int(self.request.get('max', None))
        except (ValueError, TypeError):
            max_ = None
        try:
            count, queries = conn.queries(limit, max_)
        except myria.MyriaError:
            queries = []
            count = 0

        if max_ is None:
            max_ = count

        for q in queries:
            q['elapsedStr'] = nano_to_str(q['elapsedNanos'])
            if q['status'] in ['ERROR', 'KILLED']:
                q['bootstrapStatus'] = 'danger'
            elif q['status'] == 'SUCCESS':
                q['bootstrapStatus'] = 'success'
            elif q['status'] == 'RUNNING':
                q['bootstrapStatus'] = 'warning'
            else:
                q['bootstrapStatus'] = ''

        template_vars = self.base_template_vars()
        template_vars.update({'queries': queries,
                              'prevUrl': None,
                              'nextUrl': None})
        template_vars['myrialKeywords'] = get_keywords()

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
            template_vars['page_url'] = lambda *args: self.request.path

        # Actually render the page: HTML content
        self.response.headers['Content-Type'] = 'text/html'
        # .. load and render the template
        template = JINJA_ENVIRONMENT.get_template('queries.html')
        self.response.out.write(template.render(template_vars))


class Profile(MyriaPage):

    def get(self):
        conn = self.app.connection
        query_id = self.request.get("queryId")
        query_plan = {}
        if query_id != '':
            try:
                query_plan = conn.get_query_status(query_id)
            except myria.MyriaError:
                pass

        template_vars = self.base_template_vars()
        template_vars['queryPlan'] = json.dumps(query_plan)
        template_vars['queryId'] = query_id

        # Actually render the page: HTML content
        self.response.headers['Content-Type'] = 'text/html'
        # .. load and render the template
        template = JINJA_ENVIRONMENT.get_template('visualization.html')
        self.response.out.write(template.render(template_vars))


class Datasets(MyriaPage):

    def get(self, connection_=None):
        conn = self.app.connection
        try:
            datasets = conn.datasets()
        except:
            datasets = []

        for d in datasets:
            try:
                d['queryUrl'] = 'http://%s:%d/query/query-%d' %\
                    (self.app.hostname, self.app.port, d['queryId'])
            except:
                pass

        template_vars = self.base_template_vars()
        template_vars['datasets'] = datasets

        # Actually render the page: HTML content
        self.response.headers['Content-Type'] = 'text/html'
        # .. load and render the template
        template = JINJA_ENVIRONMENT.get_template('datasets.html')
        self.response.out.write(template.render(template_vars))


class Examples(MyriaPage):

    def get(self):
        # Get the language
        language = self.request.get('language')
        if not language:
            # default to MyriaL
            language = 'myrial'
        else:
            language = language.strip().lower()
        # Is language recognized?

        example_set = self.request.get('subset') or 'default'
        if example_set == 'demo3':
            examples_to_use = demo3_examples
        else:
            examples_to_use = examples

        if language not in examples_to_use:
            self.response.headers['Content-Type'] = 'text/plain'
            self.response.status = 404
            self.response.write(
                'Error 404 (Not Found): language %s not found' % language)
            return
        # Return the objects as json
        self.response.headers['Content-Type'] = 'application/json'
        self.response.write(json.dumps(examples_to_use[language]))


class Editor(MyriaPage):

    def get(self):
        # Actually render the page: HTML content
        self.response.headers['Content-Type'] = 'text/html'
        template_vars = self.base_template_vars()
        template_vars['myrialKeywords'] = get_keywords()
        template_vars['subset'] = 'default'

        # .. load and render the template
        template = JINJA_ENVIRONMENT.get_template('editor.html')
        self.response.out.write(template.render(template_vars))


class Demo3(MyriaPage):
    def get(self):
        # Actually render the page: HTML content
        self.response.headers['Content-Type'] = 'text/html'
        template_vars = self.base_template_vars()
        template_vars['myrialKeywords'] = get_keywords()
        template_vars['subset'] = 'demo3'

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
            plan = get_logical_plan(query, language, self.app.connection)
        except (MyrialCompileException,
                MyrialInterpreter.NoSuchRelationException) as e:
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
        multiway_join = self.get_boolean_request_param("multiway_join")
        push_sql = self.get_boolean_request_param("push_sql")
        try:
            optimized = get_physical_plan(
                query, language, self.app.connection, multiway_join, push_sql)
        except MyrialInterpreter.NoSuchRelationException as e:
            self.response.headers['Content-Type'] = 'text/plain'
            self.response.write(
                "Error 400 (Bad Request): Relation %s not found" % str(e))
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
        multiway_join = self.get_boolean_request_param("multiway_join")
        push_sql = self.get_boolean_request_param("push_sql")

        cached_logicalplan = str(get_logical_plan(
            query, language, self.app.connection, push_sql=push_sql))
        # Generate physical plan
        physicalplan = get_physical_plan(
            query, language, self.app.connection, multiway_join=multiway_join,
            push_sql=push_sql)

        try:
            compiled = compile_to_json(
                query, cached_logicalplan, physicalplan, language)
        except requests.ConnectionError:
            self.response.headers['Content-Type'] = 'text/plain'
            self.response.status = 503
            self.response.write(
                'Error 503 (Unavailable): Unable to connect to REST server')
            return

        self.response.headers['Content-Type'] = 'application/json'
        self.response.write(json.dumps(compiled))

    def post(self):
        "The same as get(), here because there may be long programs"
        self.get()


class Execute(MyriaHandler):

    def post(self):
        self.response.headers.add_header("Access-Control-Allow-Origin", "*")
        conn = self.app.connection

        query = self.request.get("query")
        language = self.request.get("language")
        profile = self.request.get("profile", False)
        multiway_join = self.get_boolean_request_param("multiway_join")
        push_sql = self.get_boolean_request_param("push_sql")

        cached_logicalplan = str(
            get_logical_plan(query, language, self.app.connection,
                             push_sql=push_sql))

        try:
            # Generate physical plan
            physicalplan = get_physical_plan(
                query, language, self.app.connection,
                multiway_join=multiway_join, push_sql=push_sql)

            # .. and compile
            compiled = compile_to_json(
                query, cached_logicalplan, physicalplan, language)

            compiled['profilingMode'] = profile

            # Issue the query
            query_status = conn.submit_query(compiled)
            query_url = 'http://%s:%d/execute?query_id=%d' %\
                (self.app.hostname, self.app.port, query_status['queryId'])
            self.response.status = 201
            self.response.headers['Content-Type'] = 'application/json'
            self.response.headers['Content-Location'] = query_url
            self.response.write(json.dumps(query_status))
            return
        except myria.MyriaError as e:
            self.response.headers['Content-Type'] = 'text/plain'
            self.response.status = 400
            self.response.write("Error 400 (Bad Request): %s" % str(e))
            return
        except requests.ConnectionError as e:
            self.response.headers['Content-Type'] = 'text/plain'
            self.response.status = 503
            self.response.write(
                'Error 503 (Unavailable): \
                 Unable to connect to REST server to issue query')
            return

    def get(self):
        self.response.headers.add_header("Access-Control-Allow-Origin", "*")
        conn = self.app.connection

        query_id = self.request.get("queryId")

        if not query_id:
            self.response.headers['Content-Type'] = 'text/plain'
            self.response.status = 400
            self.response.write("Error 400 (Bad Request): missing query_id")
            return

        query_status = conn.get_query_status(query_id)
        self.response.headers['Content-Type'] = 'application/json'
        self.response.write(json.dumps(query_status))


class Dot(MyriaHandler):

    def get(self):
        self.response.headers.add_header("Access-Control-Allow-Origin", "*")
        query = self.request.get("query")
        language = self.request.get("language")
        plan_type = self.request.get("type")
        multiway_join = self.get_boolean_request_param("multiway_join")
        push_sql = self.get_boolean_request_param("push_sql")

        plan = get_plan(
            query, language, plan_type, self.app.connection,
            multiway_join=multiway_join, push_sql=push_sql)

        self.response.headers['Content-Type'] = 'text/plain'
        self.response.write(get_dot(plan))

    def post(self):
        "The same as get(), here because there may be long programs"
        self.get()


class Application(webapp2.WSGIApplication):
    def __init__(self, debug=True,
                 hostname='rest.myria.cs.washington.edu',
                 port=1776, ssl=True):
        routes = [
            ('/', RedirectToEditor),
            ('/editor', Editor),
            ('/queries', Queries),
            ('/profile', Profile),
            ('/datasets', Datasets),
            ('/plan', Plan),
            ('/optimize', Optimize),
            ('/compile', Compile),
            ('/execute', Execute),
            ('/dot', Dot),
            ('/examples', Examples),
            ('/demo3', Demo3)
        ]

        # Connection to Myria. Thread-safe
        self.connection = myria.MyriaConnection(
            hostname=hostname, port=port, ssl=ssl)
        self.hostname = hostname
        self.port = port
        self.ssl = ssl

        # Quiet logging for production
        logging.getLogger().setLevel(logging.WARN)

        webapp2.WSGIApplication.__init__(
            self, routes, debug=debug, config=None)

app = Application()
