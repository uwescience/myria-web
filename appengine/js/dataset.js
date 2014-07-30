// dataset templates go here:
var dataset_templates = {
  relName: _.template('<tr><td><a href="<%- url %>" target="_blank" data-toggle="tooltip" title="<%- user %>:<%- program %>:<%- name %>"><%- name %></a></td>'),
  extraInfo: _.template('<td><a href="<%- url %>" target=_blank><%- queryId %></a></td><td class="query-finish"><abbr class="timeago" title="<%- created %>"><%- created %></abbr></td>'),
  download: _.template('<td><a href="<%- url %>format=json" rel="nofollow" class="label label-default">JSON</a>' +
    '<a href="<%- url %>format=csv" rel="nofollow" class="label label-default">CSV</a>' +
    '<a href="<%- url %>format=tsv" rel="nofollow" class="label label-default">TSV</a></td></tr>'),
  toolarge: _.template('<td><abbr title="Too large or size unknown">not available</abbr></td></tr>')
};

var editorBackendKey = 'myria',
    backendProcess = 'myria',
    grappackends = ['grappa', 'clang'];

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
  var url = 'http://' + myriaConnection + '/dataset';
  if (_.contains(grappackends, backendProcess)) {
    url = 'http://' + clangConnection + '/dataset';
  }
  var t = dataset_templates;
  var jqxhr = $.getJSON(url,
    function (data) {
      var html = '';

      _.each(data, function (d) {
	var qload = '';
        if (_.contains(grappackends, backendProcess)) {
	    qload = '/query?qid=' + d['queryId'];
	}
        var relation = d['relationKey'];
        html += t.relName({url: d['uri'] + qload, user: relation['userName'],
                program: relation['programName'],
                name: relation['relationName']});
        html += t.extraInfo({url: d['uri'] + qload, queryId: d['queryId'],
                created: d['created']});

	var dload = d['uri'] + '/data?';
        if (_.contains(grappackends, backendProcess)) {
	    dload += 'qid=' + d['queryId'] + '&';
	}
	if (is_small_dataset(d, 100*1000*1000)) {
	  html += t.download({url: dload});
	} else {
	  html += t.toolarge;
	}
      });

      $("#datatable").html(html);
    }).fail (function (res, err) {
      console.log(err);
  });
}

/* A dataset is small if we know its size and the size is below the
    specified cell limit. (Number of cells is # cols * # rows.) */
function is_small_dataset(d, cell_limit) {
  var col;
  if (backendProcess === 'myria') {
    col = d['schema']['columnNames'].length;
  }
  else if (_.contains(grappackends, backendProcess)) {
    col = JSON.parse(d['schema'])['columnNames'].length;
  }
  return (d['numTuples'] >= 0 &&
         ((cell_limit == 0) || (col * d['numTuples'] <= cell_limit)));
  }

function saveState() {
  localStorage.setItem(editorBackendKey,
		       $(".backend-menu").find(":selected").val());
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
