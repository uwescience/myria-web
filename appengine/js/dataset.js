// dataset templates go here:
var dataset_templates = {
  relName: _.template('<tr><td><a href="<%- url %>" target="_blank" data-toggle="tooltip" title="<%- user %>:<%- program %>:<%- name %>"><%- name %></a></td>'),
  extraInfo: _.template('<td><a href="<%- url %>" target=_blank><%- queryId %></a></td><td class="query-finish"><abbr class="timeago" title="<%- created %>"><%- created %></abbr></td>'),
  download: _.template('<td><a href="<%- url %>format=json" rel="nofollow" class="label label-default">JSON</a>' +
    '<a href="<%- url %>format=csv" rel="nofollow" class="label label-default">CSV</a>' +
    '<a href="<%- url %>format=tsv" rel="nofollow" class="label label-default">TSV</a></td></tr>'),
  toolarge: _.template('<td><abbr title="Too large or size unknown">not available</abbr></td></tr>')
};

var grappaends = ['grappa', 'clang'],
    myriaCellLimit = 100*1000*1000,
    clangCellLimit = 10*1000;

function backendDatasetUrl(conn){
  var url;
  if (backendProcess == 'clang') {
    url = conn + '/dataset?backend=clang';
  }
  else if (backendProcess == 'grappa') {
    url = conn + '/dataset?backend=grappa';
  } else {
    url = conn + '/dataset';
  }
  return url;
}

function loadTable() {
  $("#datatable").empty();
  // default to host from myria
  var request = $.post("page", {
    backend: backendProcess
  });
  request.success(function (info) {
    // Populates the dataset table with data from back end
    var conn = JSON.parse(info).connection;
    var url = backendDatasetUrl(conn);
    var t = dataset_templates;
    var jqxhr = $.getJSON(url, function (data) {
      var html = '';
      _.each(data, function (d) {
	    var dload = d.uri + '/data?';
        var limit = myriaCellLimit;
        if (_.contains(grappaends, backendProcess)) {
	      d.uri = d.uri +'/query?qid=' + d['queryId'];
          dload += 'qid=' + d['queryId'] + '&';
          d.created = new Date(d.created * 1000).toISOString();
	}
        var relation = d['relationKey'];
        html += t.relName({url: d['uri'], user: relation['userName'],
                program: relation['programName'],
                name: relation['relationName']});
        html += t.extraInfo({url: d['uri'], queryId: d['queryId'],
                created: d.created});

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
      // Allow the table to become sortable
      sortTable();

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

// Updates the entries to become sortable
function sortTable() {
  // Needed to update the existing table after data from the new backend is loaded
  $(".table").trigger("update");
  $(".table").tablesorter({
    textExtraction: {
      2: function (node, table, cellIndex) {
        return new Date($(node).find("abbr").attr("title"));
      }
        },
    headers: {
      2: {sorter: "isoDate"}
    },
    headerTemplate: '{content} <small><span></span>'
    });

  // Originally from dataset.html 
  var resetSortIcons = function() {
    $("th[aria-sort=ascending][aria-disabled=false] span").attr('class', "glyphicon glyphicon-sort-by-attributes");
    $("th[aria-sort=descending][aria-disabled=false] span").attr('class', "glyphicon glyphicon-sort-by-attributes-alt");
    $("th[aria-sort=none][aria-disabled=false] span").attr('class', "glyphicon glyphicon-sort");
  };
  $(".table").bind("sortEnd", resetSortIcons);
  resetSortIcons();
}

$(function() {
  $(".backend-menu").change(loadTable);
  loadTable();
});
