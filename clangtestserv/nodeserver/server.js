'use strict';

var http = require('http');
var qs = require("querystring");
var fs = require('fs');
var cp = require('child_process');
var url = require('url');
var sqlite = require("sqlite3").verbose();

var compilepath = '../../submodules/raco/c_test_environment/';
var datasetpath = compilepath + 'datasets/';
var schemepath = compilepath + 'schema/';
var hostname = 'localhost';
var port = 1337;
var datasetfile = 'dataset.db';
var counter = 1;
var db = new sqlite.Database(datasetfile, createTable);

http.createServer(function (req, res) {
  var path = url.parse(req.url).pathname;

  switch(path) {
    case '/dataset':
    case '/query':
      processQid(req, res, selectTable);
    break;
    case '/status':
      processQid(req, res, getQueryStatus);
    break;
    case '/tuples':
      processQid(req, res, getTuples);
    break;
    case '/data':
      processData(req, res);
    break;
    case '/catalog':
      processRelKey(req, res);
    break;
    default:
    processQuery(req, res);
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
      isInCatalog(res, relkey);
    });
  }
}

function isInCatalog(res, relkey) {
  var query = 'SELECT * FROM dataset WHERE userName = ? AND ' +
              'programName = ? AND relationName = ?';
  db.serialize(function () {
    db.get(query, relkey.userName, relkey.programName, relkey.relationName,
	    function (err, row) {
      if (err) { console.log('check existence: ' + err); } else {
        if (!row) {
          var json = {};
	  sendJSONResponse(res, json);
        } else {
	  json = {relationKey: {relationName: row.relationName,
             programName: row.programName, userName: row.userName},
             queryId: row.queryId, created: row.created, uri: row.url,
             numTuples: row.numTuples,
             colNames: JSON.parse(row.schema).columnNames,
             colTypes: JSON.parse(row.schema).columnTypes};
	  sendJSONResponse(res, json);
        }
      }
    });
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
      var qid = url_parts.query.qid;
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
      var qid = url_parts.query.qid;
      callbackfn(res, qid);
    });
  }
}

// Parses the query from posted json
function processQuery(req, res) {
  var qid = counter;
  if (req.method == "POST") {
    var body = '';
    req.on('data', function (chunk) {
      body += chunk;
    });

    req.on('end', function () {
      var myriares = JSON.parse(body);
      var backend = myriares.backend;
      var plan = myriares.plan;
      var filename = parseFilename(myriares.logicalRa);
      var url = 'http://' + hostname + ':' + port;
      var params = '-p ' + filename + ' ' + url + ' ' + qid;

      cp.exec('python metastore.py process_query ' + params,
              function (error, stdout, stderr) {
                if (error) { console.log(error); }
                console.log(stdout);
                getQueryStatus(res, qid);
              });

      fs.writeFile(compilepath + filename + ".cpp", plan,
        function (err) {
	  if (err) { console.log('writing query source' + err); } else {
	    runQueryUpdate(filename, qid, backend);
	  }
	});
      counter++;
    });
  } else {
    res.writeHead(400, {'Content-Type': 'text/html'});
    res.write("nothing");
    res.end();
  }
}

function parseFilename(logicalplan) {
  var startindex = logicalplan.indexOf('(') + 1;
  var endindex = logicalplan.indexOf(')');
  return logicalplan.substring(startindex, endindex);
}

function insertDataQuery(res, filename, qid) {
/*  var curTime = getTime();
  var relkey = filename.split(':');
  var url = 'http://' + hostname + ':' + port;
  getQueryStatus(res, qid);
  var query = 'INSERT INTO dataset VALUES' +
        '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
  console.log(curTime + ' query recieved');
  db.serialize(function () {
    var stmt = db.prepare(query);
    stmt.run(relkey[0], relkey[1], relkey[2], qid, curTime, url, 'ACCEPTED',
             curTime, null, 0, 0, "", function (err) {
               if (err) { console.log('insertDQ' + err); }
             });
    stmt.finalize();
  });*/
}

function runQueryUpdate(filename, qid, backend) {
  cp.exec('python metastore.py update_query_run -p ' + qid,
          function (error, stdout, stderr) {
            if (error) { console.log(error); }
            console.log(stdout);
          });
  console.log('running');
  runQuery(filename, qid, backend);
}

// compiles and runs the query on server
function runQuery(filename, qid, backend) {
  var cmd = 'python run_query.py ' + backend + ' ';
  if (backend == 'grappa') {
    cmd += 'grappa_';
  }
  cmd += filename;
  cp.exec(cmd, {cwd: compilepath}, function (error, stdout, stderr) {
    console.log('stdout: ' + stdout);
    if (error) {
      console.log(getTime() + ' ' + error);
      updateQueryError(qid, error);
    } else {
      updateCatalog(filename, qid);
      updateScheme(filename, qid);
      console.log(getTime() + ' ' +  qid + ' ' + filename + ' done on '
                  + backend);
    }
  });
}

function updateQueryError(qid) {
  var query = 'UPDATE dataset SET status = "Error" WHERE queryId = ?';
  db.run(query, qid, function (err) {
    if (err) { console.log('updateQE' + err); }
  });
}

function updateCatalog(filename, qid) {
  var cmd = 'wc -l < ' + filename;
  cp.exec(cmd, {cwd: datasetpath}, function (error, stdout, stderr) {
    if (error) { console.log('problem with file ' + error); } else {
      var num = parseInt(stdout);
      updateNumTuples(qid, num);
    }
  });
}

function updateNumTuples(qid, num) {
  var query = 'UPDATE dataset SET numTuples = ? WHERE queryId = ?';
  db.run(query, num, qid, function (err) {
    if (err) { console.log('updateNum' + err); }
  });
  updateQueryComplete(qid);
}

/* Query related functions */
function updateQueryComplete(qid) {
  cp.exec('python metastore.py update_query_success -p ' + qid,
          function (error, stdout, stderr) {
            if (error) { console.log(error); }
          });
}

function updateScheme(filename, qid) {
  fs.readFile(schemepath + filename, {encoding: 'utf8'}, function (err, data) {
    if (err) { console.log('error reading ' + filename + err); } else {
      var td = data.split("\n");
      var schema = {"columnNames": td[0], "columnTypes": td[1]};
      var query = 'UPDATE dataset SET schema = ? WHERE queryId = ?';
      db.run(query, JSON.stringify(schema), qid, function (err) {
        if (err) { console.log('updateScheme' + err);}
      });
    }
  });
}

function selectTable(res, qid) {
  var jsonarr = [];
  var query = 'SELECT * FROM dataset';
  if (qid) {
      query += ' WHERE queryId=' + qid;
  }
  db.each(query, function (err, row) {
    if (err) { console.log('selTable' + err); } else {
      var jsonob = {relationKey: {relationName: row.relationName,
             programName: row.programName, userName: row.userName},
             queryId: row.queryId, created: row.created, schema: row.schema,
             status: row.status, startTime: row.startTime, endTime: row.endTime,
             elapsedNanos: row.elapsed, numTuples: row.numTuples, uri: row.url};
      jsonarr.push(jsonob);
    }
  }, function () {
    sendJSONResponse(res, jsonarr);
  });
}

// finds filename of qid
function getDbRelKeys(res, qid) {
  var query = 'SELECT userName, programName, relationName FROM dataset ' +
	      'WHERE queryId=' + qid;
  db.each(query, function (err, row) {
    if (err) { console.log('getDBRelKeys' + err); } else {
      var filename = row.userName + ':' + row.programName + ':' +
	    row.relationName;
      getResults(res, filename);
    }
  });
}

// Retrieves the status of the query in json format
function getQueryStatus(res, qid) {
  cp.exec('python metastore.py get_query_status -p ' + qid,
          function (error, stdout, stderr) {
            if (error) { console.log(error); } else {
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.writeHead(200, {'Content-Type': 'application/json'});
              res.write(stdout);
              res.end();
            }
          });
}

function getTuples(res, qid) {
  var query = 'SELECT numTuples FROM dataset WHERE queryId=' + qid;
  db.get(query, function (err, row) {
    if (err) { console.log('getTuples' + err); } else {
      var json = {numTuples: row.numTuples};
      sendJSONResponse(res, json);
    }
  });
}

function getResults(res, filename) {
  var jsonarr = [];
  fs.readFile(datasetpath + filename, {encoding: 'utf8'}, function (err, data) {
    if (err) { console.log('get results ' + err); } else {
      var arr = data.split('\n');
      for (var i = 0; i < arr.length-1; i++) {
        jsonarr.push({'tuple': arr[i]});
      }
      sendJSONResponse(res, jsonarr);
    }
  });
}

function getTime() {
  return new Date().getTime();
}

function createTable() {
  db.serialize(function () {
    db.get('SELECT name FROM sqlite_master WHERE type="table"' +
	   'AND name="dataset"', function (err, row) {
           if (err) { console.log('createTable: ' + err); } else {
	   if (!row) {
	     console.log('creating table');
             db.serialize(function () {
	     db.run('CREATE TABLE dataset (userName text, programName text, ' +
                    'relationName text, queryId int primary key,' +
		    'created datatime, url text, status text,' +
		    'startTime datetime, endTime datetime, elapsed datetime,' +
                    'numTuples int, schema text)');
             var fakeschema = {"columnTypes": ["LONG_TYPE", "LONG_TYPE"],
                               "columnNames": ["x", "y"]};
             var stmt = db.prepare('INSERT INTO dataset VALUES' +
                                   '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
             stmt.run("public", "adhoc", "R", 0, 0, "http://localhost:1337",
                      'SUCCESS', 0, 1, 1, 30, JSON.stringify(fakeschema));
             });
           }
         }
    });
  });
}

function sendJSONResponse(res, jsonarr) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.write(JSON.stringify(jsonarr));
  res.end();
}
