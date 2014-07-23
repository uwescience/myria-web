'use strict';

var http = require('http');
var qs = require("querystring");
var fs = require('fs');
var cp = require('child_process');
var url = require('url');
var sqlite = require("sqlite3").verbose();

var compilepath = '../../submodules/raco/c_test_environment/';
var datasetpath = compilepath + 'datasets/';
var hostname = 'localhost';
var port = 1337;
var datasetfile = 'dataset.db';
var counter = 0;
var db = new sqlite.Database(datasetfile, createTable);

http.createServer(function (req, res) {
  var path = url.parse(req.url).pathname;

  switch(path) {
    case '/dataset':
    case '/query':
      processQid(req, res, selectTable);
    break;
    case '/data':
      processData(req, res);
    break;
    case '/status':
      processQid(req, res, getQueryStatus);
    break;
    case '/catalog':
      processRelKey(req, res);
    break;
    default:
      var start = getTime();
      parseQuery(req, res, start);
    break;
  }

}).listen(port, hostname);
console.log('Server running at http://' + hostname + ':' + port + '/');

function processRelKey(req, res) {
  if (req.method == "POST") {
    var body = '';
    req.on('data', function (chunk) {
      body += chunk;
    });

    req.on('end', function () {
      var relkey = JSON.parse(body);
      checkExistence(res, relkey);
    });
  }
}

function checkExistence(res, relkey) {
  var db = new sqlite.Database(datasetfile);
  var query = 'SELECT queryId FROM dataset WHERE userName = ? AND ' +
              'programName = ? AND relationName = ?';
  db.serialize(function () {
    db.each(query, relkey.userName, relkey.programName, relkey.relationName,
	    function (err, row) {
      if (err) {
        console.log('check existence: ' + err);
      } else {
        res.writeHead(400, {'Content-Type': 'plain/text'});
        if (!row.queryId) {
          res.write('False');
        } else {
          res.write('True');
        }
        res.end();
      }
    });
    db.close();
  });
}

function processData(req, res) {
  if (req.method == "GET") {
    var body = '';
    req.on('data', function (chunk) {
      body += chunk;
    });

    req.on('end', function () {
      var url_parts = url.parse(req.url, true);
      var qid = url_parts.query['qid'];
      // TODO handle format json, csv, tsv
      getDbRelKeys(res, qid);
    });
  }
}

function processQid(req, res, callbackfn) {
  if (req.method == "GET") {
    var body = '';
    req.on('data', function (chunk) {
      body += chunk;
    });

    req.on('end', function () {
      var url_parts = url.parse(req.url, true);
      var qid = url_parts.query['qid'];
      callbackfn(res, qid);
    });
  }
}

// Parses the query from posted json
function parseQuery(req, res, start) {
  var plan, filename, qid = counter;
  if (req.method == "POST") {
    console.log(start + ' query recieved');
    var body = '';
    req.on('data', function (chunk) {
      body += chunk;
    });

    req.on('end', function () {
      var mwebres = JSON.parse(body);
      plan = mwebres['plan'];
      var ra = mwebres['logicalRa'];
      var startindex = ra.indexOf('(') + 1;
      var endindex = ra.indexOf(')');
      filename = ra.substring(startindex, endindex);
      insertQuery(res, filename, qid, start);

      fs.writeFile(compilepath + filename + ".cpp", plan,
        function (err) {
	  if (err) {
	    console.log('parse query' + err);
	  } else {
	    runQueryUpdate(filename, qid, start);
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
  cp.exec(cmd, options, function (error, stdout, stderr) {
    console.log('stdout: ' + stdout);
    if (error !== null) {
      console.log(getTime() + ' ' + error);
      errorQueryUpdate(qid, error);
    } else {
      completeQueryUpdate(qid, start);
      console.log(getTime() + ' job ' + qid + ' ' + filename + ' done');
    }
  });
}

function sendResponseJSON(res, jsonarr) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.write(JSON.stringify(jsonarr));
  res.end();
}

function completeQueryUpdate(qid, start) {
  var stop = getTime();
  var db = new sqlite.Database(datasetfile);
  var diff = new Date(stop) - new Date(start);
  db.serialize(function () {
    db.run('UPDATE dataset SET status = "SUCCESS", endTime = ?, elapsed = ?' +
           'WHERE queryId = ?', stop, diff, qid);
    db.close();
  });
}

function errorQueryUpdate(qid) {
  var db = new sqlite.Database(datasetfile);
  db.serialize(function () {
    db.run('UPDATE dataset SET status = "Error"' +
           'WHERE queryId = ?', qid);
    db.close();
  });
}

function runQueryUpdate(filename, qid, start) {
  var db = new sqlite.Database(datasetfile);
  db.serialize(function () {
    console.log(getTime() + ' running');
    db.run('UPDATE dataset SET status = "Running"' +
           'WHERE queryId = ?', qid);
    db.close();
    runClang(filename, qid, start);
  });
}

function getResults(res, filename) {
  var jsonarr = [];
  fs.readFile(datasetpath + filename, {encoding: 'utf8'}, function (err, data) {
    if (err) {
      console.log('get results ' + err);
    } else {
      var arr = data.split('\n');
      for (var i = 0; i < arr.length-1; i++) {
        jsonarr.push({'tuple': arr[i]});
      }
      sendResponseJSON(res, jsonarr);
    }
  });
}

function selectTable(res, qid) {
  var db = new sqlite.Database(datasetfile);
  var jsonarr = [];
  var query = 'SELECT * FROM dataset';
  if (qid) {
      query += ' WHERE queryId=' + qid;
  }

  db.each(query, function (err, row) {
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
  }, function () {
    sendResponseJSON(res, jsonarr);
    db.close();
  });
}

// finds filename of qid
function getDbRelKeys(res, qid) {
  var db = new sqlite.Database(datasetfile);
  var query = 'SELECT userName, programName, relationName FROM dataset ' +
	      'WHERE queryId=' + qid;
  db.each(query, function (err, row) {
    if (err) {
      console.log('relKeys error: ' + err);
    } else {
      var filename = row.userName + ':' + row.programName + ':' +
	    row.relationName + '.txt';
      getResults(res, filename);	
    }
  });
  db.close();
}

// Retrieves the status of the query in json format
function getQueryStatus(res, qid) {
  var db = new sqlite.Database(datasetfile);
  var query = 'SELECT * FROM dataset WHERE queryId=' + qid;

  db.each(query, function (err, row) {
    var json = {status: row.status, queryId: row.queryId, 
                startTime: row.startTime, finishTime: row.endTime,
                elapsedNanos: row.elapsed, url: row.url};
    sendResponseJSON(res, json);
    db.close();
  });
}

function insertQuery(res, filename, qid, start) {
  var db = new sqlite.Database(datasetfile);
  var curTime = getTime();
  var relkey = filename.split(':');
  var url = 'http://' + hostname + ':' + port;
  getQueryStatus(res, qid);

  db.serialize(function () {
    var stmt = db.prepare('INSERT INTO dataset VALUES' +
                          '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    stmt.run(relkey[0], relkey[1], relkey[2], qid, curTime, url, 'ACCEPTED',
             start, null, 0, function (err) {
             if (err) {
               console.log('insert query: ' + err);
             }
    });
    stmt.finalize();
    db.close();
  });
}

function createTable(err) {
  db.serialize(function () {
    db.get('SELECT name FROM sqlite_master WHERE type="table"' +
	   'AND name="dataset"', function (err, row) {
	   if (!row) {
	     console.log('creating table');
	     db.run('CREATE TABLE dataset (userName text, programName text, ' + 
                    'relationName text, queryId int primary key,' +
		    'created datatime, url text, status text,' +
		    'startTime datetime, endTime datetime, elapsed int)');
	   }
    });
  });
}

function getTime() {
  return new Date().toISOString();
}
