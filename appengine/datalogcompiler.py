from raco import RACompiler
from raco.language import MyriaAlgebra
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
        target = self.request.get("target")
    
        dlog = RACompiler()
        dlog.fromDatalog(query)
    
        targetalgebra = globals()[target] # assume the argument is in local scope
        dlog.optimize(target=targetalgebra, eliminate_common_subexpressions=False)
    
        optimized = format_rule(dlog.physicalplan)
    
        self.response.headers['Content-Type'] = 'text/plain'
        self.response.write(optimized)

class Compile(webapp2.RequestHandler):
    def get(self):
        query = self.request.get("query")
        target = self.request.get("target")
    
        dlog = RACompiler()
        dlog.fromDatalog(query)
    
        targetalgebra = globals()[target] # assume the argument is in local scope
        dlog.optimize(target=targetalgebra, eliminate_common_subexpressions=False)
    
        compiled = dlog.compile()
    
        self.response.headers['Content-Type'] = 'text/plain'
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
