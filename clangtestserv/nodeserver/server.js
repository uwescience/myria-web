var http = require('http');
var qs = require("querystring");
var fs = require('fs');
var cp = require('child_process');
var url = require('url');
var sqlite = require("sqlite3").verbose();

var compilepath = '../../submodules/raco/c_test_environment/';
var datasetpath = compilepath + 'datasets/';
var hostname = 'localhost'
var port = 1337;
var datasetfile = 'dataset.db';
var counter = 0;
//getQid();

http.createServer(function (req, res) {
  var path = url.parse(req.url).pathname;
    
  switch(path) {
    case '/dataset':
      accessDataset(req, res, qid=-1, selectTable);
    break;
    case '/query':
      processQid(req, res);
    break;
    case '/data':
      displayData(req, res);
    break;
    case '/status':
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end();
    break;
    default:
      var start = new Date().getTime();
      parseQuery(req, res, start);
    break;
  }

}).listen(port, hostname);
console.log('Server running at http://' + hostname + ':' + port + '/');

function displayData(req, res) {
  if (req.method == "GET") {
    var body = '';
    req.on('data', function(chunk) {
      body += chunk;
    });

    req.on('end', function() {
      var url_parts = url.parse(req.url, true);
      qid = url_parts.query['qid'];
      accessDataset(req, res, qid, getRelKeys);
    });
  }
}

function processQid(req, res) {
  var qid = -1;
  if (req.method == "GET") {
    var body = '';
    req.on('data', function(chunk) {
      body += chunk;
    });

    req.on('end', function() {
      var url_parts = url.parse(req.url, true);
      qid = url_parts.query['qid'];
      accessDataset(req, res, qid, selectTable);
    });
  }
}

// Examines dataset.db 
function accessDataset(req, res, qid, callfn) {
  var exists = fs.existsSync(datasetfile);
  if (exists) {
    var db = new sqlite.Database(datasetfile);
    callfn(db, res, qid);
   } else {
    res.writeHead(404, {'Content-Type': 'text/html'});
    res.write("database file not found");
    res.end();
  }
}

// finds filename of qid
function getRelKeys(db, res, qid) {
  var query = 'SELECT userName, programName, relationName FROM dataset ' +
	      'WHERE queryId=' + qid;
  db.each(query, function(err, row) {
    if (err) {
      console.log('relKeys: ' + err);
    } else {
      var filename = row.userName + ':' + row.programName + ':' +
	    row.relationName + '.txt';
      displayResults(filename, res);	
    }
  }, function() {
    closeDB(db)
  });
}

// displays query results
function displayResults(filename, res) {
  var jsonarr = [];
  fs.readFile(datasetpath + filename, {encoding: 'utf8'}, function(err, data) {
    if (err) {
      console.log('display results' + err);
    } else {
      var arr = data.split('\n');
      for (var i = 0; i < arr.length-1; i++) {
        jsonarr.push({'tuple': arr[i]});
      }
      writeJSON(jsonarr, res);
    }
  });
}

// Retrieves data to populate dataset table
function selectTable(db, res, qid) {
  var jsonarr = [];
  var ts = new Date().getTime();
  var query = 'SELECT * FROM dataset';
  if (qid != -1) {
      query += ' WHERE queryId=' + qid;
  }
  db.each(query, function(err, row) {
    if (err) {
      console.log('select table: ' + err);
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

// closes the db after use
function closeDB(db) {
  console.log("db closed");
  db.close();
}

// Writes the json array 
function writeJSON (jsonarr, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.write(JSON.stringify(jsonarr));
  res.end();
}

// Retrieves the status of the query in json format
function getStatus(req, res, qid, start) {
  var end = new Date().getTime();
  var query_status = {url:'http://' + hostname + ':'+ port +'/query?qid=' + qid,
                      status: 'ACCEPTED', queryId: qid,
                      startTime: new Date(start).toISOString(),
                      finishTime: 0,
                      elapsedNanos: end - start}
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.write(JSON.stringify(query_status));
  res.end();
}

// Inserts query information into database	
function insertDataset(filename, qid) {
  var exists = fs.existsSync(datasetfile);
  if (exists) {
    var db = new sqlite.Database(datasetfile);
    var curTime = new Date().toISOString();
    var relkey = filename.split(':');
    var url = 'http://' + hostname + ':' + port;
    db.serialize(function() {
      var stmt = db.prepare('INSERT INTO dataset VALUES(?, ?, ?, ?, ?, ?)');
      stmt.run(relkey[0], relkey[1], relkey[2], qid, curTime, url,
	       function(err) {
                 if (err) {
                   console.log('insert dataset: ' + err);
		 }
	       });
      stmt.finalize();
      closeDB(db);
    });
  }
}

// Retrieves the latest qid to prevent 
function getQid() {
  var exists = fs.existsSync(datasetfile);
  var queryId = 0;
  if (exists) {
    var db = new sqlite.Database(datasetfile);
    db.each('SELECT queryId FROM dataset ORDER BY queryID DESC LIMIT 1', 
     function(err, row) {
       if (err) {
	 console.log('getQid' + err);
       } else {
         queryId = row.queryId;
       }
     }, function() {
       counter = queryId;
     });
  }
}

// Parses the query from posted json
function parseQuery(req, res, start) {
  var plan, filename, qid = counter;
  if (req.method == "POST") {
    console.log('query recieved');
    var body = '';
    req.on('data', function(chunk) {
      body += chunk;
    });

    req.on('end', function() {
      var mwebres = JSON.parse(body);
      plan = mwebres['plan'];
      var ra = mwebres['logicalRa'];
      var startindex = ra.indexOf('(') + 1;
      var endindex = ra.indexOf(')');
      filename = ra.substring(startindex, endindex);

      fs.writeFile(compilepath + filename + ".cpp", plan,
        function(err) {
	  if (err) {
	    console.log('parse query' + err);
	  } else {
	    runClang(filename, qid);
	  }
        });
    });
    getStatus(req, res, qid, start);
    counter++;
  } else {
    res.writeHead(400, {'Content-Type': 'text/html'});
    res.write("nothing");
    res.end();
  }
}

// compiles and runs the query on server
function runClang(filename, qid) {
  var options = { encoding: 'utf8', timeout: 0, maxBuffer: 200*1024,
                  killSignal: 'SIGTERM', cwd: compilepath, env: null };
  var cmd = 'python runclang.py clang ' + filename;
  cp.exec(cmd, options, function(error, stdout, stderr) {
    console.log('stdout: ' + stdout);
    if (error !== null) {
      console.log('error: ' + error);
    } else {
      console.log('job' + qid + ' ' + filename + ' done');
      insertDataset(filename, qid);
    }
  });
}

