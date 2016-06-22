
host = ""


var editor_templates = {
  //*/
  urls: {
    profiling: _.template("http://<%- myria %>/logs/profiling?queryId=<%- query_id %>")
  },
  query: {
    table: _.template('<table class="table table-condensed table-striped"><thead><tr><th colspan="2">Query <a href="<%- myriaConnection %>/query/query-<%- query_id %>" target="_blank">#<%- query_id %></a></th></tr></thead><trbody><%= content %></trbody></table>'),
    row: _.template('<tr><td><%- name %></td><td><%- val %></td></tr>'),
    time_row: _.template('<tr><td><%- name %></td><td><abbr class="timeago" title="<%- val %>"><%- val %></abbr></td></tr>'),
    prof_link: _.template('<p>Profiling results: <a href="/profile?queryId=<%- query_id %>" class="glyphicon glyphicon-dashboard" title="Visualization of query profiling" data-toggle="tooltip"></a>'),
    err_msg: _.template('<p>Error message:</p><pre><%- message %></pre>'),
    dataset_table: _.template('<table class="table table-condensed table-striped"><thead><tr><th colspan="2">Datasets Created</th></tr></thead><trbody><%= content %></trbody></table>'),
    dataset_row: _.template('<tr><td><%- relationKey.userName %>:<%- relationKey.programName %>:<%- relationKey.relationName %></td><td><%- numTuples %> tuples <% if (numTuples < max_dataset_size) { %> <a href="<%- uri %>/data?format=json" target="_blank" rel="nofollow" class="label label-default">JSON</a> <a href="<%- uri %>/data?format=csv" target="_blank" rel="nofollow" class="label label-default">CSV</a> <a href="<%- uri %>/data?format=tsv" target="_blank" rel="nofollow" class="label label-default">TSV</a><% } %></td></tr>')
  },
  dataset: {
    table: _.template('<table class="table table-condensed table-striped"><thead><tr><th>Name</th><th>Type</th></tr></thead><trbody><%= content %></trbody></table>'),
    row: _.template('<tr><td><%- name %></td><td><%- type %></td></tr>'),
    dslink: _.template('<p>More details: <a href="<%- url %>"><%- user %>:<%- program %>:<%- name %></a></p>')
  },
  trim_example: _.template('\n... <%- remaining %> more line<% print(remaining > 1 ? "s": ""); %>')
};

var editor = CodeMirror.fromTextArea(document.getElementById('queryEditor'), {
            mode: 'application/js',
            lineNumbers: true,
            lineWrapping: true,
            viewportMargin: Infinity,
        });

editor.getDoc().setValue('SELECT *' + '\n' +'FROM "public:adhoc:lineitem" AS L' + '\n' + 'WHERE l_linenumber = 7;');

editorLanguage = "MyriaL"
var multiway_join_checked = false;
var push_sql_checked = true;
var query = null;

initialize();

function initialize()
{
    ithQuery = 0
    initializeObject = {}
    initializeObject.tier = getTier()
    initializeObject.path = "/mnt/myria/perfenforce_files/ScalingAlgorithms/Live/"
    scalingAlgorithmObj = {}
    scalingAlgorithmObj.name = "OML"
    scalingAlgorithmObj.lr = .04
    initializeObject.scalingAlgorithm = scalingAlgorithmObj

    console.log("Initialize")
    console.log(initializeObject)
    
    // call the initialize POST function
    $.ajax({
                type: 'POST',
                url: host + ":8753/perfenforce/initializeScaling",
                dataType: 'json',
                headers: { 'Accept': 'application/json','Content-Type': 'application/json' },
                data: JSON.stringify(initializeObject),
                global: false,
                async: false,
                success: function (data) {
                    return data;
                }
            });
}

function getRequest(command)
{
  return $.ajax({
                type: 'GET',
                url: host + ":8753" + command,
                dataType: 'json',
                global: false,
                async: false,
                success: function(data) {
                return data;
            }
            });
}


function handleerrors(request, display) {
  request.done(function (result) {
    var formatted = result.split("\n").join("<br>");
    $(display).html(formatted);
  });

  request.fail(function (jqXHR, textStatus, errorThrown) {
    if (textStatus == 'timeout') {
      $(display).text("Server is not responding");
      return;
    }

    $(display).text(jqXHR.responseText);
  });
}


function getSLA()
{
    // cases for live or mock version
    var executeButton = document.getElementById('executeButton')
    if (executeButton !== null)
    {
      document.getElementById('slaInfo').innerHTML = ""
      document.getElementById('runningInfo').innerHTML = ""
      document.getElementById('picture').innerHTML = ""

       querySQL = editor.getValue();
       var request = new FormData();                     
        request.append('querySQL', querySQL);
        request.append('path', '/mnt/myria/perfenforce_files/ScalingAlgorithms/Live/');

       //send predict with query value
       $.ajax({
                type: 'POST',    
                url: host + ":8753/perfenforce/predict",
                data:request,
                contentType : false,
                global: false,
                async: false,
                processData: false,
                success: function (data) {
                           //get the current query and update the label
                    $.when(getRequest('/perfenforce/get-current-query')).done(function(currentQuery){
                      console.log(currentQuery)
                      document.getElementById("slaInfo").innerHTML = "Expected Runtime (from SLA): " + currentQuery.slaRuntime;
                    });
                }
            });

      document.getElementById('executeButton').disabled = false;
    }

    var questionElem = document.getElementById('scalingQuestion');
    if (questionElem !== null)
    {
      document.getElementById('slaInfo').innerHTML = "Expected Runtime (from SLA): 10 seconds"
      document.getElementById('executeButtonMock').disabled = false;
      
    }
}

function runQuery()
{
  
    // intercept it here and recompile
    var executeButton = document.getElementById('executeButton')
    if (executeButton !== null)
    {

    $.when(getRequest('/perfenforce/cluster-size')).done(function(clusterSize){
      console.log("Cluster size " + clusterSize)
      console.log("Tier " + getTier())

     
      document.getElementById('picture').innerHTML = "Cluster is running on " + clusterSize + " workers"
      executePlan()
    });    

    document.getElementById('executeButton').disabled = true;
  }
  else
  {
    document.getElementById('scalingQuestion').style.visibility='visible'
  }
}

function executePlan()
{
  //need to create plan
  var clusterSize = 0
  var workerArray = [];
  $.when(getRequest('/perfenforce/cluster-size')).done(function(clusterSize){
      for (i = 1; i<= clusterSize; i++)
      {
         workerArray.push(i)
      }
  

  querySQL = editor.getValue();
  querySQL = querySQL.replace("lineitem", "lineitem" + clusterSize)
  json_plan = {}
  json_plan.rawQuery = querySQL
  json_plan.logicalRa = ""
  json_plan.plan = {}
  json_plan.plan.type = "SubQuery"
  json_plan.plan.fragments = []
  fragmentsObj = {}
  fragmentsObj.overrideWorkers = workerArray
  fragmentsObj.operators = []
  dbQueryScan = {}
  dbQueryScan.opType = "DbQueryScan"
  dbQueryScan.opId = 0
  dbQueryScan.opName = "scan"
  dbQueryScan.schema = {}
  dbQueryScan.schema.columnTypes = []
  dbQueryScan.schema.columnNames = []
  dbQueryScan.sql = querySQL
  sinkRoot = {}
  sinkRoot.opType = "SinkRoot"
  sinkRoot.opId = 1
  sinkRoot.opName= "MyriaSink"
  sinkRoot.argChild = 0
  fragmentsObj.operators.push(dbQueryScan)
  fragmentsObj.operators.push(sinkRoot)
  json_plan.plan.fragments.push(fragmentsObj)
  
  console.log(JSON.stringify(json_plan))

  var request = $.post("http://localhost:27080/executejson", {
                  query: query,
                    language: "MyriaL",
                    jsonQuery: JSON.stringify(json_plan)
  }).success(function(newStatus) {
                        documentQueryStatus(newStatus);
                    });
});
}

documentQueryStatus = function (result) {
            var start_time = result['startTime'];
            var end_time = result['finishTime'];
            var elapsed = result['elapsedNanos'] / 1e9;
            var status = result['status'];
            var query_id = result['queryId'];

            document.getElementById('runningInfo').innerHTML = (" status:" + status + " seconds elapsed: " + (elapsed));

            if (status === 'ACCEPTED' || status === 'RUNNING' || status === 'PAUSED') {
                setTimeout(function () {
                    $.get("http://localhost:27080/executejson", {
                      queryId: query_id,
                      language: 'MyriaL'
                      }).success(function(newStatus) {
                        documentQueryStatus(newStatus);
                    })
                }, 1000);
            }
            else if (status == "SUCCESS")
            {
              var request = new FormData();                     
              request.append('dataPointRuntime', elapsed);
               // Make it block :( 
              $.ajax({
                type: 'POST',    
                url: host + ":8753/perfenforce/add-data-point",
                data:request,
                contentType : false,
                global: false,
                async: false,
                processData: false,
                success: function (data) {
                    return data;
                }
              });
            }
        };

function displayQueryError(error, query_id) {
  var pre = document.createElement('pre');
  multiline($('#runningInfo').empty().append(pre),
      "Error checking query status; it's probably done. Attempting to refresh\n" + error.responseText);
  setTimeout(function () {
    checkQueryStatus(query_id);
  }, 1000);
}

function checkQueryStatus(query_id) {
  var errFunc = function (error) {
    displayQueryError(error, query_id);
  };
  $.ajax(host + ":8080/execute", {
    type: 'GET',
    data: {
      queryId: query_id,
      language: editorLanguage
    },
    success: displayQueryStatus,
    error: errFunc
  });
}

function displayQueryStatus(query_status) {
  var t = editor_templates.query;
  var query_id = query_status['queryId'];
  var status = query_status['status'];
  var html = '';

  html += t.row({name: 'Status', val: status});
  html += t.time_row({name: 'Start', val: query_status['startTime']});
  html += t.time_row({name: 'End', val: query_status['finishTime']});
  html += t.row({name: 'Elapsed', val: query_status['elapsedNanos']/1000000000});
  html = t.table({myriaConnection: myriaConnection, query_id: query_id, content: html});

  if (status === 'SUCCESS' && query_status['profilingMode'].indexOf('QUERY') > -1) {
      html += t.prof_link({query_id: query_id});
  } else if (status === 'ERROR') {
    html += t.err_msg({message: query_status['message'] || '(missing)'});
  }
  $("#runningInfo").html(html);

  if (status === 'ACCEPTED' || status === 'RUNNING' || status === 'PAUSED' || status === 'KILLING') {
    setTimeout(function () {
      checkQueryStatus(query_id);
    }, 1000);
  }
}

/* Based on: http://stackoverflow.com/a/6455874/1715495 */
function multiline(elt, text) {
  var htmls = [];
  var lines = text.split(/\n/);
  // The temporary <div/> is to perform HTML entity encoding reliably.
  //
  // document.createElement() is *much* faster than jQuery('<div/>')
  // http://stackoverflow.com/questions/268490/
  //
  // You don't need jQuery but then you need to struggle with browser
  // differences in innerText/textContent yourself
  var tmpDiv = jQuery(document.createElement('div'));
  for (var i = 0; i < lines.length; i++) {
    htmls.push(tmpDiv.text(lines[i]).html());
  }
  elt.html(htmls.join("<br>"));
}
