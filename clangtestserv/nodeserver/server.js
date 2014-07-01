var http = require('http');
var qs = require("querystring");
var fs = require('fs');
var cp = require('child_process');

var url = 'http://localhost:8080/compile?query=A(x)+%3A-+R2(x%2C3)&language=datalog&backend=clang';
var filepath = '../../submodules/raco/c_test_environment/';

var counter = 0;
var myriares;
http.createServer(function (req, res) {
    var plan;
    var qid = counter;
    console.log("wait");
    if (req.method == "POST") {
	console.log('post');
	var body = '';
	req.on('data', function(chunk) {
            body += chunk;
	});
	req.on('end', function() {
	    myriares = JSON.parse(body);
	    
	    plan = myriares['plan'];
	    fs.writeFile(filepath + 'q' + qid + ".cpp", plan, function(err) {
		if (err) {
		    console.log(err);
		}
	    });
	});

	runClang(qid);

	counter++;
   }

    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write("success");

    res.end();
}).listen(1337, 'localhost');
console.log('Server running at http://localhost:1337/');

function runClang(qid) {
    var filename = 'q' + qid;
    var options = { encoding: 'utf8', timeout: 0, maxBuffer: 200*1024,
		    killSignal: 'SIGTERM', cwd: filepath, env: null };
    var cmd = 'python runclang.py clang ' + filename;
    cp.exec(cmd, options, function(error, stdout, stderr) {
	console.log('stdout: ' + stdout);
	console.log('stderr: ' + stderr);
	if (error !== null) {
	    console.log('exec error: ' + error);
	}
	console.log(filename + ' done');
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
