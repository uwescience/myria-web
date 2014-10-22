//query templates go here
var query_templates = {
  queryInfo: _.template('<tr class="<%- bootstrapStatus %> query-row" data-status="<%- status %>" data-id="<%- queryId %>"> <td class="query-url"><a href="<%- url%>" target="_blank"><%- queryId %></a></td><td class="query-raw"><%- rawQuery %></td><td class="query-status"><%- status %></td>'),
  profileInfo: _.template('<td><%- if (profilingMode) {%><% if (status == "SUCCESS") { %><a href="/profile?queryId=<%- queryId %>" class="glyphicon glyphicon-dashboard" title="Visualization of query profiling" data-toggle="tooltip"></a><% } else if (status == "RUNNING" || status == "ACCEPTED") {%><span class="glyphicon glyphicon-dashboard" title="Visualization will be available when the query has finished" data-toggle="tooltip"></span><% } else {%><span class="glyphicon glyphicon-dashboard" title="Visualization not available for failed queries" data-toggle="tooltip"></span><% } %><%- } else { %><span title="Profiling not enabled for this query" data-toggle="tooltip">-</span><%- } %></td>'),
  finishInfo: _.template('<td class="query-elapsed"><%- elapsedStr %></td><td class="query-finish"><abbr class="timeago" title="<%- finishTime %>"><%- finishTime%></abbr></td></tr>')
};

//  {%- for page in pagination.iter_pages() %}
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
	var url = d.url;
        var profile = d.profilingMode;
        if (!profile) {
          profile = false;
        }
        if (_.contains(grappaends, backendProcess)) {
	  url = d.uri + '/query?qid=' + d.queryId;
	}

        d.elapsedStr = nano_to_str(d.elapsedNanos);
        var bootstrapStatus = getBootstrapStatus(d.status);

        html += t.queryInfo({bootstrapStatus: bootstrapStatus,
                             status: d.status, queryId: d.queryId,
                             rawQuery: d.rawQuery, url: url});
        html += t.profileInfo({profilingMode: profile,
                                 status: d.status, queryId: d.queryId});
        html += t.finishInfo({elapsedStr: nano_to_str(d.elapsedNanos),
                              finishTime: d.finishTime});
        });

      $("#querytable").html(html);
      runningHighlight();
      myriaHighlight();
    }).fail (function (res, err) {
      console.log(err);
    });
  });
}

function getBootstrapStatus(status) {
  if (status == 'ERROR' || status == 'KILLED') {
    return 'danger';
  } else if (status == 'SUCCESS') {
    return 'success';
  } else if (status == 'RUNNING') {
    return 'warning';
  } else {
    return '';
  }
}

function nano_to_str(elapsed) {
  if (!elapsed) {
    return null;
  }
  var s = elapsed / 1000000000.0;
  var m, h, d;
  m = parseInt(s / 60);
  s = s % 60;
  h = parseInt(m / 60);
  m = m % 60;
  d = parseInt(h / 24);
  h = h % 24;
  var elapsed_str = s.toFixed(6) + 's';
  if (m) {
    elapsed_str = m + 'm ' + elapsed_str;
  }
  if (h) {
    elapsed_str = h + 'h ' + elapsed_str;
  }
  if (d) {
    elapsed_str = d + 'd ' + elapsed_str;
  }
  return elapsed_str;
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

function runningHighlight() {
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
}

function myriaHighlight() {
  $("td.query-raw").each(function (index, elt) {
    elt = $(elt);
    var text = elt.text();
    /*
     * TODO: This is a hack to detect MyriaL programs, both to distinguish
     * them from other languages and to distinguish them from manually
     * written "raw" queries. We should really include the query language
     * in the Myria catalog and use it instead.
         */
    if (text.toLowerCase().indexOf("store") === -1) {
      return;
    }
    var pre = document.createElement('pre');
    pre.className += "CodeMirror";
    elt.empty().append(pre);
    CodeMirror.runMode(text, {name: 'myrial', singleLineStringErrors: false}, pre);
  });}

$(function() {
 $(".backend-menu").change(changeBackend);

  restoreState();
  // save state every 2 seconds or when page is unloaded
  window.onbeforeunload = saveState;
  setInterval(saveState, 2000);

  loadTable();


});
