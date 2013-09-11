from raco import RACompiler
from raco.language import MyriaAlgebra
from raco.myrialang import compile_to_json
from raco.viz import plan_to_dot
from google.appengine.ext.webapp import template
import os.path
import traceback
import webapp2

defaultquery = """A(x) :- R(x,3)"""

def programplan(query,target):
    dlog = RACompiler()

    dlog.fromDatalog(query)
    return dlog.logicalplan

def format_rule(expressions):
    return "\n".join(["%s = %s" % e for e in expressions])

class RequestHandlerBase(webapp2.RequestHandler):
    def handle_exception(self, exception, debug_mode):
        if isinstance(exception, webapp2.HTTPException):
            self.response.set_status(exception.code)
            self.response.out.write(str(exception))
        else:
            self.response.set_status(500)
            self.response.out.write(traceback.format_exc(exception))
        self.response.headers['Content-Type'] = 'text/plain'
        
class MainPage(RequestHandlerBase):
    def get(self,query=defaultquery):

        dlog = RACompiler()
        dlog.fromDatalog(query)
        plan = format_rule(dlog.logicalplan)
        dlog.optimize(target=MyriaAlgebra, eliminate_common_subexpressions=False)
        myria_plan = format_rule(dlog.physicalplan)
    
        self.response.headers['Content-Type'] = 'text/html'
    
        path = os.path.join(os.path.dirname(__file__), 'templates/editor.html')
    
        self.response.out.write(template.render(path, locals()))

class Plan(RequestHandlerBase):
    def get(self):
        query = self.request.get("query")
        dlog = RACompiler()
        dlog.fromDatalog(query)
        plan = format_rule(dlog.logicalplan)
    
        self.response.headers['Content-Type'] = 'text/plain'
        self.response.write(plan)

class Optimize(RequestHandlerBase):
    def get(self):
        query = self.request.get("query")
    
        dlog = RACompiler()
        dlog.fromDatalog(query)
    
        dlog.optimize(target=MyriaAlgebra, eliminate_common_subexpressions=False)
    
        optimized = format_rule(dlog.physicalplan)
    
        self.response.headers['Content-Type'] = 'text/plain'
        self.response.write(optimized)

class Compile(RequestHandlerBase):
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

class Dot(RequestHandlerBase):
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
   ('/plan',Plan),
   ('/optimize',Optimize),
   ('/compile',Compile),
   ('/dot',Dot)
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
