// Used to handle http request and parsing fields, actual work done in python
'use strict';

var http = require('http');
var qs = require("querystring");
var fs = require('fs');
var cp = require('child_process');
var url = require('url');

var compilepath = 'raco/c_test_environment/';
var hostname = 'n03';
var port = 1337;

var py = './datastore.py';
var counter;
getQid();

http.createServer(function (req, res) {
  var path = url.parse(req.url).pathname;
  getQid();
  switch(path) {
    case '/dataset':
      processBackend(req, res, selectTable);
    break;
    case '/query':
      processQid(req, res, selectRow);
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
    case 'queries':
      processBackend(req, res, selectTable);
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

function processData(req, res) {
  if (req.method == "GET") {
    var body = '';
    req.on('data', function (chunk) {
      body += chunk;
    });

    req.on('end', function () {
      var url_parts = url.parse(req.url, true);
      var qid = url_parts.query.qid;
      // var format = url_parts.query.format;
      // TODO handle format csv, tsv
      getResults(res, qid);
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

function processBackend(req, res, callbackfn) {
  if (req.method == "GET") {
    var body = '';
    req.on('data', function (chunk) {
      body += chunk;
    });

    req.on('end', function () {
      var url_parts = url.parse(req.url, true);
      var backend = url_parts.query.backend;
      callbackfn(res, backend);
    });
  }

}

// Parses the query from posted json
function processQuery(req, res) {
  var qid = counter++;
  if (req.method == "POST") {
    var body = '';
    req.on('data', function (chunk) {
      body += chunk;
    });

    req.on('end', function () {
      var myriares = JSON.parse(body);
      var backend = myriares.backend;
      var plan = myriares.plan;
      var relkey = myriares.relkey;
      var url = 'http://' + hostname + ':' + port;
      var filename = relkey.split('_')[2];
      var params = relkey + ' ' + url + ' ' + ' ' + qid + ' ' + backend;
      cp.exec(py + ' process_query -p ' + params, function (err, stdout) {
        if (err) { console.log('process' + err.stack); } else {
          console.log(stdout);
	  getQueryStatus(res, qid);
        }
      });
      fs.writeFile(compilepath + filename + ".cpp", plan, function (err) {
        if (err) { console.log('writing query source' + err.stack); } else {
	  runQueryUpdate(filename, qid, backend);
	}
      });
    });
  } else {
    res.writeHead(400, {'Content-Type': 'text/html'});
    res.write("nothing");
    res.end();
  }
}

function runQueryUpdate(filename, qid, backend) {
  var params = qid + ' ' + filename + ' ' + backend;
  cp.exec(py + ' update_query_run -p ' + params, function (err, stdout) {
    if (err) { console.log('runupdate' + err.stack); }
    console.log(stdout);
  });
}

function isInCatalog(res, rkey) {
  var params = rkey.userName + ' ' + rkey.programName + ' '
        + rkey.relationName;
  cp.exec(py + ' check_catalog -p ' + params, function (err, stdout) {
    if (err) { console.log('check cat' + err.stack); } else {
      sendJSONResponse(res, JSON.stringify(JSON.parse(stdout)));
    }
  });
}

function selectTable(res, backend) {
  cp.exec(py + ' select_table -p' + backend, function (err, stdout) {
    if (err) { console.log('seltab ' + err.stack); } else {
      sendJSONResponse(res, JSON.stringify(JSON.parse(stdout)));
    }
  });
}

function selectRow(res, qid) {
  cp.exec(py + ' select_row -p ' + qid, function (err, stdout) {
    if (err) { console.log('selrow' + err.stack); } else {
      sendJSONResponse(res, JSON.stringify(JSON.parse(stdout)));
    }
  });
}

function getResults(res, qid) {
  cp.exec(py + ' get_filename -p ' + qid, function (err, stdout) {
    if (err) { console.log(' relkeys ' + err.stack); } else {
      sendJSONResponse(res, stdout);
    }
  });
}

function getQueryStatus(res, qid) {
  cp.exec(py + ' get_query_status -p ' + qid, function (err, stdout) {
    if (err) { console.log('qs' + err.stack); } else {
      sendJSONResponse(res, stdout);
    }
  });
}

function getTuples(res, qid) {
  cp.exec(py + ' get_num_tuples -p ' + qid, function (err, stdout) {
    if (err) { console.log( 'numtuples ' + err.stack); } else {
      sendJSONResponse(res, stdout);
    }
  });
}

function getQid() {
  cp.exec(py + ' get_latest_qid', function (err, stdout) {
    if (err) {
      console.log( 'getQid ' + err.stack);
      counter = 0;
    } else {
      counter = parseInt(stdout) + 1;
    }
  });
}

function sendJSONResponse(res, json) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.write(json);
  res.end();
}
