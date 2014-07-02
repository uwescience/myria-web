editorBackendKey = 'myria';
backendProcess = 'myria';

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
  var relName = _.template('<tr><td><a href="<%- url %>" target="_blank" data-toggle="tooltip" title="<%- user %>:<%- program %><%- name %>"><%- name %></a></td>');
  var extraInfo = _.template('<td><a href="<%- url %>" target=_blank><%- queryId %></a></td><td class="query-finish"><abbr class="timeago" title="<%- created %>"><%- created %></abbr></td>');
  var download = _.template('<td><a href="<%- url %>/data?format=json" rel="nofollow" class="label label-default">JSON</a> <a href="<%- url %>/data?format=csv" rel="nofollow" class="label label-default">CSV</a> <a href="<%- url %>/data?format=tsv" rel="nofollow" class="label label-default">TSV</a></td></tr>');
  var url = 'http://vega.cs.washington.edu:1776/dataset';
  var grappaserv = ['grappa', 'clang'];
  if (_.contains(grappaserv, backendProcess)) {
      url = 'http://localhost:1337/dataset';
  }
      
  var jqxhr = $.getJSON(url,
	    function(data) {
	      var html = '';
		console.log(data[0]);
		_.each(data, function(d) {
		    var relation = d['relationKey'];
		    html += relName({url: d['uri'], user: relation['userName'],
				 program: relation['programName'], 
				 name: relation['relationName'] });
		    html += extraInfo({url: d['uri'], queryId: d['queryId'], 
				       created: d['created']});
		    html += download({url: d['uri']});
		});
	       $("#datatable").html(html);
	   }).fail (function(err, n, a) { 
	       console.log(err);
	       console.log(n);
	       console.log(a);
	   });
}
function saveState() {
  localStorage.setItem(editorBackendKey, $(".backend-menu").find(":selected").val());
}

function restoreState() {
  var backend = localStorage.getItem(editorBackendKey);
  $(".backend-menu").val(backend);
  setBackend(backend);
  return true;
}

$(function() {
  $(".backend-menu").change(changeBackend);

  restoreState();
  // save state every 2 seconds or when page is unloaded
  window.onbeforeunload = saveState;
  setInterval(saveState, 2000);

  loadTable();
});
