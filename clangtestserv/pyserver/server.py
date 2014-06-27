#from http://thomasfischer.biz/python-simple-json-tcp-server-and-client/
import SocketServer
import json

class MyTCPServer(SocketServer.ThreadingTCPServer):
    allow_reuse_address = True

class MyTCPServerHandler(SocketServer.BaseRequestHandler):
    def handle(self):
        # TODO figure out size to read in
        readsize = 10192
	print "hello <%s>" % (self.request.recv(readsize).strip())

        try:
            data = json.loads(self.request.recv(readsize).strip())
            # process the data, i.e. print it:
            print data
            # write to file qid.cpp
            filename = str(data['qid']) + ".cpp"
            if filename == "None.cpp":
                filename = "temp.cpp"
            with open(filename, 'w') as outfile:
                json.dump(data['plan'], outfile)
            # send some 'ok' back
            self.request.sendall(json.dumps({"return": 'ok',
                                             "query_status":'200'}))
        except Exception, e:
            print "Exception while receiving message: ", e

server = MyTCPServer(('127.0.0.1', 13373), MyTCPServerHandler)
server.serve_forever()
