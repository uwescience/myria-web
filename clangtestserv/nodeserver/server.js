var http = require('http');
var qs = require("querystring");
var fs = require('fs');
var cp = require('child_process');
var url = require('url');
var sqlite = require("sqlite3").verbose();

var filepath = '../../submodules/raco/c_test_environment/';
var hostname = 'localhost'
var port = 1337;
var datasetfile = 'dataset.db';
var counter = 0;
//getQid();

http.createServer(function (req, res) {
  var path = url.parse(req.url).pathname;
    
  switch(path) {
    case '/dataset':
     accessDataset(req, res);
    break;
    default:
      parseQuery(req, res);
    break;
  }

}).listen(port, hostname);
console.log('Server running at http://' + hostname + ':' + port + '/');

// Examines dataset.db 
function accessDataset(req, res) {
  var exists = fs.existsSync(datasetfile);
  if (exists) {
    var db = new sqlite.Database(datasetfile);
    selectTable(db, res);
  } else {
    res.writeHead(404, {'Content-Type': 'text/html'});
    res.write("database file not found");
    res.end();
  }
}

function selectTable(db, res) {
  var jsonarr = [];
  var ts = new Date().getTime();
  db.each("SELECT * FROM dataset", function(err, row) {
    if (err) {
      console.log(err);
    } else {
      var jsonob = {relationKey :
        {relationName : row.relationName, programName: row.programName,
         userName: row.userName} , queryId: row.queryId, created: row.created, 
        uri: row.url};
      jsonarr.push(jsonob);
    }
  }, function() {
    writeJSON(jsonarr, res);
    closeDB(db)
  });
}

function closeDB(db) {
  console.log("db closed");
  db.close();
}

function writeJSON (jsonarr, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.write(JSON.stringify(jsonarr));
  res.end();
}

function getJSON(req, res, qid, start) {
  var end = new Date().toISOString();
  var query_status = {url:'http://' + hostname + ':'+ port +'/query?qid=' + qid,
		       startTime: start, finishTime: end, status: "SUCCESS",
		       queryId: qid};
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.write(JSON.stringify(query_status));
  res.end();
}
	
function insertDataset(qid, filename) {
  var exists = fs.existsSync(datasetfile);
  if (exists) {
    var db = new sqlite.Database(datasetfile);
    var curTime = new Date().toISOString();
    var relName = filename;
    var url = 'http://' + hostname + ':' + port + '/query?qid=' + qid;
    db.serialize(function() {
	var stmt = db.prepare('INSERT INTO dataset VALUES(?, ?, ?, ?, ?, ?)');
      stmt.run('public', 'adhoc-program', relName, qid, curTime, url,
	       function(err) {
                 if (err) {
                   console.log(err);
		 }
	       });
      stmt.finalize();
      closeDB(db);
    });
  }
}

function getQid() {
  var exists = fs.existsSync(datasetfile);
  var queryId = 0;
    console.log
  if (exists) {
    var db = new sqlite.Database(datasetfile);
    db.each('SELECT queryId FROM dataset ORDER BY queryID DESC LIMIT 1', function(err, row) {
     if (err) {
       console.log(err);
     } else {
       queryId = row.queryId;
     }
   }, function() {
     counter = queryId;
   });
  }
}
// Parses the query from posted json
function parseQuery(req, res) {
  var start = new Date().toISOString();
  var plan;
  var qid = counter;
  console.log("waiting");
  if (req.method == "POST") {
    console.log('post');
    var body = '';
    req.on('data', function(chunk) {
      body += chunk;
    });
    req.on('end', function() {
      var myriares = JSON.parse(body);
      plan = myriares['plan'];
      fs.writeFile(filepath +'q'+ qid +".cpp", plan,
        function(err) {
	  if (err) {
	    console.log(err);
	  }
        });
    });
    getJSON(req, res, qid, start);
    runClang(qid);
    counter++;
  } else {
    res.writeHead(400, {'Content-Type': 'text/html'});
    res.write("nothing");
    res.end();
  }
}

// runs clang on server
function runClang(qid) {
  var filename = 'q' + qid;
  var options = { encoding: 'utf8', timeout: 0, maxBuffer: 200*1024,
                  killSignal: 'SIGTERM', cwd: filepath, env: null };
  var cmd = 'python runclang.py clang ' + filename;
  cp.exec(cmd, options, function(error, stdout, stderr) {
    console.log('stdout: ' + stdout);
    if (error !== null) {
      console.log('error: ' + error);
    } else {
      console.log(filename + ' done');
      insertDataset(qid, filename);
    }
  });
}

