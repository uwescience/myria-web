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

http.createServer(function (req, res) {
  var path = url.parse(req.url).pathname;
    
  switch(path) {
    case '/dataset':
      accessDataset(req, res, qid=-1, selectTable);
    break;
    case '/query':
      processQid(req, res, 'query');
    break;
    case '/data':
      displayData(req, res);
    break;
    case '/status':
      processQid(req, res, 'status');
    break;
    default:
      var start = new Date().toISOString();
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

function processQid(req, res, path) {
  var qid = -1;
  if (req.method == "GET") {
    var body = '';
    req.on('data', function(chunk) {
      body += chunk;
    });

    req.on('end', function() {
      var url_parts = url.parse(req.url, true);
      qid = url_parts.query['qid'];

      // hack to get qid assigned before next function
      if (path == 'query') {
        accessDataset(req, res, qid, selectTable);
      } else if (path == 'status') {
        getQueryStatus(res, qid);
      } else {
      }
    });
  }
}

// Examines dataset.db 
function accessDataset(req, res, qid, callbackfn) {
  var exists = fs.existsSync(datasetfile);
  if (exists) {
    var db = new sqlite.Database(datasetfile);
    callbackfn(res, qid, db);
   } else {
    res.writeHead(404, {'Content-Type': 'text/html'});
    res.write("database file not found");
    res.end();
  }
}

// finds filename of qid
function getRelKeys(res, qid, db) {
  var query = 'SELECT userName, programName, relationName FROM dataset ' +
	      'WHERE queryId=' + qid;
  db.each(query, function(err, row) {
    if (err) {
      console.log('relKeys: ' + err);
    } else {
      var filename = row.userName + ':' + row.programName + ':' +
	    row.relationName + '.txt';
      displayResults(res, filename);	
    }
  }, function() {
    db.close();
  });
}

// displays query results
function displayResults(res, filename) {
  var jsonarr = [];
  fs.readFile(datasetpath + filename, {encoding: 'utf8'}, function(err, data) {
    if (err) {
      console.log('display results' + err);
    } else {
      var arr = data.split('\n');
      for (var i = 0; i < arr.length-1; i++) {
        jsonarr.push({'tuple': arr[i]});
      }
      writeJSON(res, jsonarr);
    }
  });
}

// Retrieves data to populate dataset table
function selectTable(res, qid, db) {
  var jsonarr = [];
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
         uri: row.url, status: row.status, startTime: row.startTime,
         endTime: row.endTime, elapsed: row.elapsed};
      jsonarr.push(jsonob);
    }
  }, function() {
    writeJSON(res, jsonarr);
    db.close();
  });
}

// Writes the json array 
function writeJSON (res, jsonarr) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.write(JSON.stringify(jsonarr));
  res.end();
}

// Retrieves the status of the query in json format
function getQueryStatus(res, qid) {
  var exists = fs.existsSync(datasetfile);
  if (exists) {
    var db = new sqlite.Database(datasetfile);
    var query = 'SELECT * FROM dataset WHERE queryId=' + qid;
    db.each(query, function(err, row) {
      var json = {status: row.status, queryId: row.queryId, 
                  startTime: row.startTime, finishTime: row.endTime,
                  elapsedNanos: row.elapsed, url: row.url}
      writeJSON(res, json);
      db.close();
    });
  }
}

// Inserts query information into database	
function insertDataset(res, filename, qid, start) {
  var exists = fs.existsSync(datasetfile);
  if (exists) {
    var db = new sqlite.Database(datasetfile);
    var curTime = new Date().toISOString();
    var relkey = filename.split(':');
    var url = 'http://' + hostname + ':' + port;
    getQueryStatus(res, qid);

    db.serialize(function() {
      var stmt = db.prepare('INSERT INTO dataset VALUES' +
                            '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      stmt.run(relkey[0], relkey[1], relkey[2], qid, curTime, url, 'ACCEPTED',
	       start, null, 0, function(err) {
               if (err) {
                 console.log('insert dataset: ' + err);
               }
      });

      stmt.finalize();
      db.close();
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
      filename = ra.substring(startindex, endindex)

      insertDataset(res, filename, qid, start);

      fs.writeFile(compilepath + filename + ".cpp", plan,
        function(err) {
	  if (err) {
	    console.log('parse query' + err);
	  } else {
	    runQueryUpdate(qid);
	    runClang(filename, qid, start);
	  }
        });
    });
    counter++;
  } else {
    res.writeHead(400, {'Content-Type': 'text/html'});
    res.write("nothing");
    res.end();
  }
}

// compiles and runs the query on server
function runClang(filename, qid, start) {
  var options = { encoding: 'utf8', timeout: 0, maxBuffer: 200*1024,
                  killSignal: 'SIGTERM', cwd: compilepath, env: null };
  var cmd = 'python runclang.py clang ' + filename;
  cp.exec(cmd, options, function(error, stdout, stderr) {
    console.log('stdout: ' + stdout);
    if (error !== null) {
      console.log('error: ' + error);
    } else {
      completeQueryUpdate(qid, start);
      console.log('job ' + qid + ' ' + filename + ' done');
    }
  });
}

function completeQueryUpdate(qid, start) {
  var stop = new Date().toISOString();
  var exists = fs.existsSync(datasetfile);
  if (exists) {
    var db = new sqlite.Database(datasetfile);
    db.serialize(function() {
      var diff = new Date(stop) - new Date(start);
      db.run('UPDATE dataset SET status = "SUCCESS", endTime = ?, elapsed = ?' +
             'WHERE queryId = ?', stop, diff, qid);
      db.close();
    });
  }
}

function runQueryUpdate(qid) {
  var exists = fs.existsSync(datasetfile);
  if (exists) {
    var db = new sqlite.Database(datasetfile);
    db.serialize(function() {
      var update = false;
      db.each('SELECT status FROM dataset WHERE queryId = ?', qid, 
              function(err, row) {
                if (row.status != 'SUCCESS') {
                  update = true;
		}
	      });
       if (update) {
	   db.run('UPDATE dataset SET status = "Running"' +
		  'WHERE queryId = ?', qid);
       }
      db.close();
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
