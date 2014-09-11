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
    grappaends = ['grappa', 'clang'],
    myriaCellLimit = 100*1000*1000,
    clangCellLimit = 10*1000;

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
    var t = dataset_templates;
    var jqxhr = $.getJSON(url, function (data) {
      var html = '';
      _.each(data, function (d) {
	var qload = '';
	var dload = d['uri'] + '/data?';
        var time = d['created'];
        if (_.contains(grappaends, backendProcess)) {
	  qload = '/query?qid=' + d['queryId'];
          dload += 'qid=' + d['queryId'] + '&';
          time = new Date(time * 1000).toISOString();
	}
        var relation = d['relationKey'];
        html += t.relName({url: d['uri'] + qload, user: relation['userName'],
                program: relation['programName'],
                name: relation['relationName']});
        html += t.extraInfo({url: d['uri'] + qload, queryId: d['queryId'],
                created: time});

        var limit = myriaCellLimit;
        if (_.contains(grappaends, backendProcess)) {
          limit = clangCellLimit;
        }
	if (is_small_dataset(d, limit)) {
	  html += t.download({url: dload});
	} else {
	  html += t.toolarge;
	}
      });

      $("#datatable").html(html);
    }).fail (function (res, err) {
      console.log(err);
    });

  });
}

/* A dataset is small if we know its size and the size is below the
    specified cell limit. (Number of cells is # cols * # rows.) */
function is_small_dataset(d, cell_limit) {
  var len = 0;
  if (_.contains(grappaends, backendProcess)) {
    len = JSON.parse(d['schema'])['columnNames'].length;
  } else {
    len = d['schema']['columnNames'].length;
  }
  return (d['numTuples'] >= 0 &&
         ((cell_limit == 0) ||
         (len * d['numTuples'] <= cell_limit)));
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
});
