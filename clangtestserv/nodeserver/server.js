var http = require('http');
var qs = require("querystring");
var fs = require('fs');
var url = 'http://localhost:8080/compile?query=A(x)+%3A-+R(x%2C3)&language=datalog&backend=clang';

var qid = 0;
var plan;
http.createServer(function (req, res) {
    accept();
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write('<html><head><body><p>' + qid
	      + ' ' + plan + '</p></body></head></html>');
    res.end();
}).listen(1337, 'localhost');
console.log('Server running at http://localhost:1337/');


function accept() {
    
    http.get(url, function(res) {
	var body = '';
	
	res.on('data', function(chunk) {
	    body += chunk;
	});
	
	res.on('end', function() {
	    var myriares = JSON.parse(body);
	    qid++;
	    plan = myriares['plan'];
	    fs.writeFile(qid + ".cpp", plan, function(err) {
		if (err) {
		    console.log(err);
		} else {
		    console.log("not errr");
		}
	    });
	});
    }).on('error', function(e) {
	console.log("error! ", e);
    });

}

function test() {
var postHTML = 
  '<html><head><title>Post Example</title></head>' +
  '<body>' +
  '<form method="post">' +
  'Input 1: <input name="qid"><br>' +
  'Input 2: <input name="plan"><br>' +
  '<input type="submit">' +
  '</form>' +
  '</body></html>';

    var body = "";
    if (req.method == 'POST') {
	req.on('data', function(chunk) {
            body += chunk;
	});
	req.on('end', function() {
	    var variables = qs.parse(body);
	    console.log('post ' + body + " " + variables['qid']);
	    res.writeHead(200, {'Content-Type': 'text/html'});
	    res.write('<p>' + variables['qid'] + ' ' + variables['plan']
		      + '</p>');
	    res.end(postHTML);
	});
   } else if (req.method == 'GET') {
       console.log('get');
       res.writeHead(200, {'Content-Type': 'text/html'});
       res.end(postHTML);
   }
}
