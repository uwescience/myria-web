#!/usr/bin/env python

import cgi, json, sys
import cgitb; cgitb.enable()  # for troubleshooting
fs = cgi.FieldStorage()

print "Content-type:text/html\n\n"
print '<html>'
print '<head>'
print '</head>'
print '<body>'
print fs
message = fs.getvalue("message", "(no message)")

print """

  <p>Previous message: %s</p>

</body>

</html>
""" % message

