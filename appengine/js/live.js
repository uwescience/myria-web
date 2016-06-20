
host = ""

// NOTE : modified version of editor.js


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

editor.getDoc().setValue('T1 = [from scan(lineitem) as l where $0=1 emit *];  \nsink(T1);');

editorLanguage = "MyriaL"
var multiway_join_checked = false;
var push_sql_checked = true;
var latest_plan_sql = null;

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

function compilePlan() {
  getplan(); // make sure the plan matches the query
  var query = editor.getValue();
  
  var request = $.post(host + ":8080/optimize", {
    query: query,
    language: editorLanguage,
    multiway_join: multiway_join_checked,
    push_sql: push_sql_checked,
  });
  handleerrors(request, "#optimized");

  var request = $.post(host + ":8080/compile", {
      query: query,
      language: editorLanguage,
      multiway_join: multiway_join_checked,
      push_sql: push_sql_checked,
  });
  request.success(function (queryStatus) {
    try {
      var fragments = queryStatus.plan.fragments;
      var i = 0;
      _.map(fragments, function (frag) {
        frag.fragmentIndex = i++;
        return frag;
      });
    } catch (err) {
      throw err;
    }
  });
  request.success(function (queryStatus) {
    latest_plan_sql = queryStatus.plan.fragments;
     querySQL = latest_plan_sql[0].operators[0].sql

    // call the initialize POST function
    $.ajax({
                type: 'POST',    
                url: host + ":8753/perfenforce/predict",
                data:'queryString='+ querySQL,
                global: false,
                async: false,
                success: function (data) {
                    return data;
                }
            });

  });

}

function getplan() {
  var query = editor.getValue();
  console.log(query)
  var request = $.post(host + ":8080/plan", {
    query: query,
    language: editorLanguage,
    multiway_join: multiway_join_checked,
    push_sql: push_sql_checked
  });
  
    handleerrors(request, "#runningInfo");
}

function getSLA()
{
    compilePlan()
    //send query to get SLA "SETUP"... with json plan? -- don't run the query
    //assume these are at the scans?
    
	document.getElementById('executeButton').disabled = false;
}

function runQuery()
{
    // intercept it here (replace with the correct size)
    executePlan()
    document.getElementById('executeButton').disabled = true;
}

function executePlan()
{
  console.log(push_sql_checked)
  var query = editor.getValue();
  var request = $.ajax(host + ":8080/execute", {
    type: 'POST',
    data: {
      query: query,
      language: editorLanguage,
      multiway_join: multiway_join_checked,
      push_sql: push_sql_checked
    },
    statusCode: {
      200: displayQueryStatus,
      201: displayQueryStatus,
      202: displayQueryStatus
    }
  });
  request.error(function (jqXHR, textStatus, errorThrown) {
    var pre = document.createElement('pre');
    $('#runningInfo').empty().append(pre);
    //multiline($(pre), jqXHR.responseText);
  });
}

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
  //html += t.row({name: 'Elapsed', val: customFullTimeFormat(query_status['elapsedNanos'], false)});
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
