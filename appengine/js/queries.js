//query templates go here
var query_templates = {
  queryInfo: _.template('<tr class="<%- bootstrapStatus %> query-row" data-status="<%- status %>" data-id="<%- queryId %>"> <td class="query-url"><a href="<%- url%>" target="_blank"><%- queryId %></a></td><td class="query-raw"><%- rawQuery %></td><td class="query-status"><%- status %></td>'),
  profileInfo: _.template('<td><% if (profilingMode) {%><% if (status == "SUCCESS") { %><a href="/profile?queryId=<%- queryId %>" class="glyphicon glyphicon-dashboard" title="Visualization of query profiling" data-toggle="tooltip"></a><% } else if (status == "RUNNING" || status == "ACCEPTED") {%><span class="glyphicon glyphicon-dashboard" title="Visualization will be available when the query has finished" data-toggle="tooltip"></span><% } else {%><span class="glyphicon glyphicon-dashboard" title="Visualization not available for failed queries" data-toggle="tooltip"></span><% } %><% } else { %><span title="Profiling not enabled for this query" data-toggle="tooltip">-</span><% } %></td>'),
  finishInfo: _.template('<td class="query-elapsed"><%- elapsedStr %></td><td class="query-finish"><abbr class="timeago" title="<%- finishTime %>"><%- finishTime%></abbr></td></tr>')
};

var editorBackendKey = 'myria',
    backendProcess = 'myria',
    grappaends = ['grappa', 'clang'];

function changeBackend() {
  var backend = $(".backend-menu option:selected").val();
  setBackend(backend);
}

function setBackend(backend) {
  var backends = [ 'myria', 'grappa', 'clang'];
  if (!_.contains(backends, backend)) {
    console.log('Backend not supported: ' + backend);
    return;
  }
  backendProcess = backend;
  var request = $.get("datasets", {
    backend : backendProcess
  });
  loadTable();
}

function loadTable() {
 // default to host from myria
  var url;
  var request = $.post("page", {
    backend: backendProcess
  });
  request.success(function (info) {
    var conn = JSON.parse(info).connection;
    if (backendProcess == 'clang') {
      url = conn + '/queries?backend=clang';
    }
    else if (backendProcess == 'grappa') {
      url = conn + '/queries?backend=grappa';
    } else {
      url = conn + '/query';
    }
    var t = query_templates;
    var jqxhr = $.getJSON(url, function (data) {
      var html = '';
      _.each(data, function (d) {
	var qload = '';
        if (_.contains(grappaends, backendProcess)) {
	  qload = '/query?qid=' + d['queryId'];
	}
        html += t.queryInfo({bootstrapStatus: d.bootstrapStatus,
                             status: d.status, queryId: d.queryId,
                             rawQuery: d.rawQuery, url: d.url + qload});
        html += t.profileInfo({profilingMode: d.profilingMode,
                                 status: d.status, queryId: d.queryId});
        html += t.finishInfo({elapsedStr: d.elaspedStr,
                              finishTime: d.finishTime});
        });
      $("#querytable").html(html);
    }).fail (function (res, err) {
      console.log(err);
    });
  });
}

function saveState() {
  localStorage.setItem(editorBackendKey,
		       $(".backend-menu").find(":selected").val());
}

function restoreState() {
  var backend = localStorage.getItem(editorBackendKey);
  if (backend === "myriamultijoin") {
    $(".backend-menu").val("myria");
  } else {
    $(".backend-menu").val(backend);
  }
  setBackend(backend);
}

$(function() {
 $(".backend-menu").change(changeBackend);

  restoreState();
  // save state every 2 seconds or when page is unloaded
  window.onbeforeunload = saveState;
  setInterval(saveState, 2000);

  loadTable();

  $('.query-row[data-status="RUNNING"]').each(function(i, e) {
    var qid = $(this).attr('data-id');
    window.setInterval(function() {
      $.getJSON('/execute', { 'queryId': qid }, function(data) {
	if (data.status != 'RUNNING') {
	  location.reload();
	}
      });
    }, 10*1000);
  });
});
