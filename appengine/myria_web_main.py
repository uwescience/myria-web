from raco import RACompiler
from raco.language import MyriaAlgebra
from raco.myrialang import compile_to_json
from google.appengine.ext.webapp import template
import os.path

import webapp2

defaultquery = """A(x,z) :- R(x,y),S(y,z),T(z,x)"""

def programplan(query,target):
    dlog = RACompiler()

    dlog.fromDatalog(query)
    return dlog.logicalplan

def format_rule(expressions):
    return "\n".join(["%s = %s" % e for e in expressions])


class MainPage(webapp2.RequestHandler):
    def get(self,query=defaultquery):

        dlog = RACompiler()
        dlog.fromDatalog(query)
        plan = format_rule(dlog.logicalplan)
        dlog.optimize(target=MyriaAlgebra, eliminate_common_subexpressions=False)
        myria_plan = format_rule(dlog.physicalplan)
    
        self.response.headers['Content-Type'] = 'text/html'
    
        path = os.path.join(os.path.dirname(__file__), 'templates/editor.html')
    
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


app = webapp2.WSGIApplication([
   ('/', MainPage),
   ('/plan',Plan),
   ('/optimize',Optimize),
   ('/compile',Compile)
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
