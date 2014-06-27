#from http://thomasfischer.biz/python-simple-json-tcp-server-and-client/
import socket
import json
import cgi

# sends data json to server
data = {"plan": "plan", "qid":123}
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.connect(('127.0.0.1', 13373))
s.send(json.dumps(data))
result = json.loads(s.recv(1024))
print result
s.close()
