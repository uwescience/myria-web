// dataset templates go here:
var dataset_templates = {
  relName: _.template('<tr><td><a href="<%- url %>" target="_blank" data-toggle="tooltip" title="<%- user %>:<%- program %>:<%- name %>"><%- name %></a></td>'),
  extraInfo: _.template('<td><a href="<%- url %>" target=_blank><%- queryId %></a></td><td class="query-finish"><abbr class="timeago" title="<%- created %>"><%- created %></abbr></td>'),
  download: _.template('<td><a href="<%- url %>format=json" rel="nofollow" class="label label-default">JSON</a>' +
    '<a href="<%- url %>format=csv" rel="nofollow" class="label label-default">CSV</a>' + 
    '<a href="<%- url %>format=tsv" rel="nofollow" class="label label-default">TSV</a></td></tr>')
};

var editorBackendKey = 'myria';
var backendProcess = 'myria';
var myriaconn = 'http://vega.cs.washington.edu:1776/dataset';
var clangconn = 'http://localhost:1337/dataset';

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
  var url = myriaconn;
  var grappaserv = ['grappa', 'clang'];
  if (_.contains(grappaserv, backendProcess)) {
    url = clangconn;
  }
  var t = dataset_templates;
  var jqxhr = $.getJSON(url,
    function(data) {
      var html = '';

      _.each(data, function(d) {
	var qload = '';
	if (url == clangconn) {
	    qload = '/query?qid=' + d['queryId'];
	}
        var relation = d['relationKey'];
        html += t.relName({url: d['uri'] + qload, user: relation['userName'],
                program: relation['programName'], 
                name: relation['relationName'] });
        html += t.extraInfo({url: d['uri'] + qload, queryId: d['queryId'],
                created: d['created']});
	var dload = d['uri'];
	if (url == myriaconn) {
	    dload += '/data?';
	} else {
	    dload += '/data?qid=' + d['queryId'] + '&';
	}
	html += t.download({url: dload});
      });
      $("#datatable").html(html);
    }).fail (function(res, err) { 
      console.log(err);
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
