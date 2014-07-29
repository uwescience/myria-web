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
    case '/tuples':
      processQid(req, res, getTuples);
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
      isInCatalog(res, relkey);
    });
  }
}

function isInCatalog(res, relkey) {
  var db = new sqlite.Database(datasetfile);
  var query = 'SELECT * FROM dataset WHERE userName = ? AND ' +
              'programName = ? AND relationName = ?';
  db.serialize(function () {
    db.get(query, relkey.userName, relkey.programName, relkey.relationName,
	    function (err, row) {
      if (err) {
        console.log('check existence: ' + err);
      } else {
        if (!row) {
          var json = {};
	  sendJSONResponse(res, json);
        } else {
	  json = {relationKey: {relationName: row.relationName,
             programName: row.programName, userName: row.userName},
             queryId: row.queryId, created: row.created, uri: row.url,
             numTuples: row.numTuples,
             colNames: JSON.parse(row.schema)["columnNames"],
             colTypes: JSON.parse(row.schema)["columnTypes"]};
	  sendJSONResponse(res, json);
        }
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
      insertDataQuery(res, filename, qid, start);

      fs.writeFile(compilepath + filename + ".cpp", plan,
        function (err) {
	  if (err) {
	    console.log('parse query' + err);
	  } else {
	    runQueryUpdate(filename, qid);
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

function insertDataQuery(res, filename, qid, start) {
  var db = new sqlite.Database(datasetfile);
  var curTime = getTime();
  var relkey = filename.split(':');
  var url = 'http://' + hostname + ':' + port;
  getQueryStatus(res, qid);

  var fakeschema = {"columnTypes": ["LONG_TYPE", "LONG_TYPE"],
                    "columnNames": ["x", "y"]};
   db.serialize(function () {
    var stmt = db.prepare('INSERT INTO dataset VALUES' +
                          '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    stmt.run(relkey[0], relkey[1], relkey[2], qid, curTime, url, 'ACCEPTED',
             start, null, 0, 0, JSON.stringify(fakeschema), function (err) {
             if (err) { console.log('insert query: ' + err); }
    });
    stmt.finalize();
    db.close();
  });
}

function runQueryUpdate(filename, qid) {
  var db = new sqlite.Database(datasetfile);
  db.serialize(function () {
    console.log(getTime() + ' running');
    db.run('UPDATE dataset SET status = "RUNNING" WHERE queryId = ?', qid);
    runClang(filename, qid);
    db.close();
  });
}

// compiles and runs the query on server
function runClang(filename, qid) {
  var cmd = 'python runclang.py clang ' + filename;
  cp.exec(cmd, {cwd: compilepath}, function (error, stdout, stderr) {
    console.log('stdout: ' + stdout);
    if (error !== null) {
      console.log(getTime() + ' ' + error);
      updateQueryError(qid, error);
    } else {
      updateCatalog(filename, qid);
      updateScheme(filename, qid);
      console.log(getTime() + ' job ' + qid + ' ' + filename + ' done');
    }
  });
}

function updateQueryError(qid) {
  var db = new sqlite.Database(datasetfile);
  db.serialize(function () {
    db.run('UPDATE dataset SET status = "Error" WHERE queryId = ?', qid);
    db.close();
  });
}

function updateCatalog(filename, qid) {
  filename += '.txt';
  var cmd = 'wc -l < ' + filename;
  cp.exec(cmd, {cwd: datasetpath}, function (error, stdout, stderr) {
    if (error) {
      console.log('problem with file ' + error);
    } else {
      var num = parseInt(stdout);
      updateNumTuples(qid, num);
    }
  });
}

function updateNumTuples(qid, num) {
  var db = new sqlite.Database(datasetfile);
  db.serialize(function () {
    db.run('UPDATE dataset SET numTuples = ? WHERE queryId = ?', num, qid);
    updateQueryComplete(qid);
  db.close();
  });
}

/* Query related functions */
function updateQueryComplete(qid) {
  var db = new sqlite.Database(datasetfile);
  var stop = getTime();
  var diff = stop;
  db.serialize(function () {
    // sqlite function to convert isostring back to seconds
    db.get('SELECT startTime FROM dataset WHERE queryId = ?', qid,
           function (err,row){
      diff -= row.startTime;
      db.run('UPDATE dataset SET status = "SUCCESS", endTime = ?, elapsed = ?' +
             'WHERE queryId = ?', stop, diff, qid);
      db.close();
    });
  });
}

function updateScheme(filename, qid) {
  fs.readFile(schemepath + filename, {encoding: 'utf8'}, function (err, data) {
    if (err) {
      console.log('update scheme ' + err);
    } else {
      var td = data.split("\n");
      var schema = {"columnNames": td[0], "columnTypes": td[1]};
      var db = new sqlite.Database(datasetfile);
      db.serialize(function () {
        db.run('UPDATE dataset SET schema = ? WHERE queryId = ?',
               JSON.stringify(schema), qid);
        db.close();
      });
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
  db.serialize(function () {
    db.each(query, function (err, row) {
      if (err) {
        console.log('select table: ' + err);
      } else {
        var jsonob = {relationKey: {relationName: row.relationName,
             programName: row.programName, userName: row.userName},
             queryId: row.queryId, created: row.created, schema: row.schema,
             status: row.status, startTime: row.startTime, endTime: row.endTime,
             elapsed: row.elapsed, numTuples: row.numTuples, uri: row.url};
        jsonarr.push(jsonob);
      }
   }, function () {
      sendJSONResponse(res, jsonarr);
      db.close();
    });
  });
}

// finds filename of qid
function getDbRelKeys(res, qid) {
  var db = new sqlite.Database(datasetfile);
  var query = 'SELECT userName, programName, relationName FROM dataset ' +
	      'WHERE queryId=' + qid;
  db.serialize(function () {
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
  });
}

// Retrieves the status of the query in json format
function getQueryStatus(res, qid) {
  var db = new sqlite.Database(datasetfile);
  var query = 'SELECT * FROM dataset WHERE queryId=' + qid;
  db.serialize(function () {
    db.get(query, function (err, row) {
      var fin = row.endTime;
      if (!fin) {
        fin = 'None';
      } else {
        fin = new Date(fin).toISOString();
      }
      var json = {status: row.status, queryId: row.queryId, url: row.url,
                  startTime: new Date(row.startTime).toISOString(),
                  finishTime: fin, elapsedNanos: row.elapsed };
      sendJSONResponse(res, json);
      db.close();
    });
  });
}

function getTuples(res, qid) {
  var db = new sqlite.Database(datasetfile);
  var query = 'SELECT numTuples FROM dataset WHERE queryId=' + qid;
  db.serialize(function () {
    db.get(query, function (err, row) {
      var json = {numTuples: row.numTuples};
      sendJSONResponse(res, json);
      db.close();
    });
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
      sendJSONResponse(res, jsonarr);
    }
  });
}

function getTime() {
  return new Date().getTime();
}

function createTable(err) {
  db.serialize(function () {
    db.get('SELECT name FROM sqlite_master WHERE type="table"' +
	   'AND name="dataset"', function (err, row) {
           if (err) { console.log('createTable: ' + err);}
	   if (!row) {
	     console.log('creating table');
	     db.run('CREATE TABLE dataset (userName text, programName text, ' +
                    'relationName text, queryId int primary key,' +
		    'created datatime, url text, status text,' +
		    'startTime datetime, endTime datetime, elapsed datetime,' +
                    'numTuples int, schema text)');
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
