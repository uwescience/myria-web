from raco import RACompiler
from raco.language import MyriaAlgebra
from raco.myrialang import compile_to_json
from raco.viz import plan_to_dot
from google.appengine.ext.webapp import template
import json
import myria
import os.path
import webapp2

defaultquery = """A(x) :- R(x,3)"""
hostname = "localhost"
port = 8753

def programplan(query, target):
    dlog = RACompiler()

    dlog.fromDatalog(query)
    return dlog.logicalplan

def format_rule(expressions):
    return "\n".join(["%s = %s" % e for e in expressions])

class MainPage(webapp2.RequestHandler):
    def get(self, query=defaultquery):

        dlog = RACompiler()
        dlog.fromDatalog(query)
        plan = format_rule(dlog.logicalplan)
        dlog.optimize(target=MyriaAlgebra, eliminate_common_subexpressions=False)
        myria_plan = format_rule(dlog.physicalplan)

        self.response.headers['Content-Type'] = 'text/html'

        path = os.path.join(os.path.dirname(__file__), 'templates/editor.html')
        try:
            connection = myria.MyriaConnection(hostname=hostname, port=port)
            workers = connection.workers()
            connection_string = "(%s:%d [%d workers])" % (hostname, port, len(workers))
        except myria.MyriaError:
            connection_string = "(unable to connect to %s:%d)" % (hostname, port)

        self.response.out.write(template.render(path, locals()))

class Plan(webapp2.RequestHandler):
    def get(self):
        query = self.request.get("query")
        dlog = RACompiler()
        dlog.fromDatalog(query)
        plan = format_rule(dlog.logicalplan)

        self.response.headers['Content-Type'] = 'text/plain'
        self.response.write(plan)

class Optimize(webapp2.RequestHandler):
    def get(self):
        query = self.request.get("query")

        dlog = RACompiler()
        dlog.fromDatalog(query)

        dlog.optimize(target=MyriaAlgebra, eliminate_common_subexpressions=False)

        optimized = format_rule(dlog.physicalplan)

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

        compiled = compile_to_json(query, cached_logicalplan, dlog.physicalplan)

        self.response.headers['Content-Type'] = 'application/json'
        self.response.write(compiled)

class Execute(webapp2.RequestHandler):
    def get(self):
        self.response.headers['Content-Type'] = 'application/json'
        try:
            connection = myria.MyriaConnection(hostname=hostname, port=port)
        except myria.MyriaError:
            self.response.write("Unable to connect to REST server to issue query")

        query = self.request.get("query")

        dlog = RACompiler()
        dlog.fromDatalog(query)
        # Cache logical plan
        cached_logicalplan = str(dlog.logicalplan)

        # Generate physical plan
        dlog.optimize(target=MyriaAlgebra, eliminate_common_subexpressions=False)
        compiled = compile_to_json(query, cached_logicalplan, dlog.physicalplan)

        # Issue the query
        try:
            ret = connection.submit_query(compiled)
            self.response.headers['Content-Type'] = 'application/json'
            self.response.write(json.dumps(ret))
        except myria.MyriaError as e:
            self.response.headers['Content-Type'] = 'text/plain'
            self.response.write(e)

class Dot(webapp2.RequestHandler):
    def get(self):
        query = self.request.get("query")
        svg_type = self.request.get("type")

        dlog = RACompiler()
        dlog.fromDatalog(query)

        if svg_type is None or len(svg_type) == 0 or svg_type.lower() == "ra":
            plan = dlog.logicalplan
        elif svg_type.lower() == "myria":
            dlog.optimize(target=MyriaAlgebra, eliminate_common_subexpressions=False)
            plan = dlog.physicalplan
        else:
            self.abort(400, detail="argument type expected 'ra' or 'myria'")

        self.response.headers['Content-Type'] = 'text/plain'
        self.response.write(plan_to_dot(plan))

app = webapp2.WSGIApplication([
   ('/', MainPage),
   ('/plan', Plan),
   ('/optimize', Optimize),
   ('/compile', Compile),
   ('/execute', Execute),
   ('/dot', Dot)
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
