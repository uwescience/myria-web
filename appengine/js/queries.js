//query templates go here
var query_templates = {};
/*  {% for q in queries %}
			<tr class="{{q.bootstrapStatus}} query-row" data-status="{{q.status}}" data-id="{{q.queryId}}">
				<td class="query-url"><a href="{{q.url}}" target="_blank">{{q.queryId}}</a></td>
				<td class="query-raw">{{q.rawQuery}}</td>
				<td class="query-status">{{q.status}}</td>
				<td>
					{% if q.profilingMode %}
						{% if q.status == 'SUCCESS' %}
							<a href="/profile?queryId={{q.queryId}}" class="glyphicon glyphicon-dashboard" title="Visualization of query profiling" data-toggle="tooltip"></a>
						{% elif q.status in ['RUNNING', 'ACCEPTED'] %}
							<span class="glyphicon glyphicon-dashboard" title="Visualization will be available when the query has finished" data-toggle="tooltip"></span>
						{% else %}
							<span class="glyphicon glyphicon-dashboard" title="Visualization not available for failed queries" data-toggle="tooltip"></span>
						{% endif %}
					{% else %}
						<span title="Profiling not enabled for this query" data-toggle="tooltip">-</span>
					{% endif %}
				</td>
				<td class="query-elapsed">{{q.elapsedStr}}</td>
				<td class="query-finish">
					<abbr class="timeago" title="{{q.finishTime}}">{{q.finishTime}}</abbr>
				</td>
			</tr>
			{% endfor %}
*/

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
      url = conn + '/dataset?backend=clang';
    }
    else if (backendProcess == 'grappa') {
      url = conn + '/dataset?backend=grappa';
    } else {
      url = conn + '/dataset';
    }
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
