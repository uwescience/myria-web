// put all the underscore templates here
var dataset_templates = {
  dataset_columns: {
    table: _.template('<table class="table table-condensed table-striped"><thead><tr><th>IV</th><th>DV</th><th>Name</th><th>Type</th></tr></thead><trbody><%= content %></trbody></table>'),
    row: _.template('<tr><td><input type=checkbox name="IV" value="<%- name %>"></td><td><input type=checkbox name="DV" value="<%- name %>"></td><td><%- name %></td><td><%- type %></td></tr>'),
    dslink: _.template('<p>More details: <a href="<%- url %>"><%- user %>:<%- program %>:<%- name %></a></p>')
  },
  urls: {
    download: _.template('<%= myriaConnection %>/dataset/user-<%- userName %>/program-<%- programName %>/relation-<%- relationName %>/data')
  },
  trim_example: _.template('\n... <%- remaining %> more line<% print(remaining > 1 ? "s": ""); %>')
};

var downloaded_data = undefined;
var dataset_metadata = {};

function registerCheckboxListeners() {
  var uncheck = function(type, value) {
    $('input[type="checkbox"][name="' + type + '"][value="' + value + '"]').prop('checked', false);
  };
  var updatePlotBtn = function() {
    if ($('input[type="checkbox"][name="DV"]:checked').length > 0) {
      // If there is at least one dependent variable checked, we can make a plot
      $('#plot-btn').prop('disabled', false);
    } else {
      $('#plot-btn').prop('disabled', true);
    }
  };
  $('input[type="checkbox"][name="DV"]').change(function() {
    if (this.checked) {
      uncheck('IV', this.value);
    }
    updatePlotBtn();
  });
  $('input[type="checkbox"][name="IV"]').change(function() {
    if (this.checked) {
      uncheck('DV', this.value);
    }
    updatePlotBtn();
  });
}

function typeMap(checked) {
  var ret = {};
  var jsMap = {
    INT_TYPE: 'NUMBER',
    FLOAT_TYPE: 'NUMBER',
    LONG_TYPE: 'NUMBER',
    DOUBLE_TYPE: 'NUMBER',
    STRING_TYPE: 'STRING',
    DATETIME_TYPE: 'DATE',
    BOOLEAN_TYPE: 'BOOLEAN'
  };
  var types = dataset_metadata.types;
  _.each(checked, function(value) {
    ret[jsMap[types[value]]] = (ret[jsMap[types[value]]] || 0) + 1;
  });
  return ret;
}

function makeDVOnlyPlot(dv, series, dvtypes) {
  if (dv.length === 1) {
    renderCDF('plot-area', dv, series);
  } else if (dv.length === 2) {
    renderScatterPlot('plot-area', dv, series);
  }
}

function makePlot() {
  var iv = $('input[type="checkbox"][name="IV"]:checked').map(function() { return this.value; });
  var dv = $('input[type="checkbox"][name="DV"]:checked').map(function() { return this.value; });
  var ivtypes = typeMap(iv);
  var dvtypes = typeMap(dv);

  if (((dvtypes['NUMBER'] || 0) != dv.length) || ((ivtypes['NUMBER'] || 0) != iv.length)) {
    console.log("found non-numeric type, bailing");
    return;
  }

  /* Plot type. */
  if (iv.length === 0 && dv.length > 2) {
    console.log("found more than 2 DVs, bailing");
    return;
  } else if (iv.length > 0) {
    console.log("found nonzero IVs, bailing");
    return;
  }

  if (downloaded_data === undefined) {
    // download the data
    var relation = dataset_metadata.relationKey;
    relation.myriaConnection = myriaConnection;
    console.log("downloading");
    $.ajax({
      dataType: "json",
      url: dataset_templates.urls.download(relation),
      data: {format: 'json'},
      async: false})
      .done(function (data) {
        downloaded_data = data;
      });
    console.log("downloaded");
  }

  var ivseries = [];
  iv.each(function () {
    var label = this;
    var series = _.map(downloaded_data, function (x) { return x[label]; });
    ivseries.push(series);
  });

  var dvseries = [];
  dv.each(function () {
    var label = this;
    var series = _.map(downloaded_data, function (x) { return x[label]; });
    dvseries.push(series);
  });

  if (iv.length === 0) {
    makeDVOnlyPlot(dv, dvseries, dvtypes);
  }
}

function initializeDatasetSearch() {
  var dataToRelKeyString = function (d) {
    return d.userName + ':' + d.programName + ':' + d.relationName;
  };

  $(".dataset-search").select2({
    placeholder: "Search for a dataset...",
    minimumInputLength: 3,
    ajax: {
      url: myriaConnection + "/dataset/search/",
      dataType: 'json',
      quietMillis: 100,
      cache: true,
      data: function (term) {
        return {
          q: term
        };
      },
      results: function (data) {
        return {
          results: data,
          more: false
        };
      }
    },
    formatResult: function (d, container, query) {
      var stringParts = dataToRelKeyString(d).split('');
      var queryParts = query.term.toLowerCase().split('');
      var i = 0, j = 0,
        result = '',
        bold = false;
      while (i < stringParts.length) {
        if (stringParts[i].toLowerCase() == queryParts[j]) {
          if (!bold) {
            result += '<strong>';
            bold = true;
          }
          j++;
        } else {
          if (bold) {
            result += '</strong>';
            bold = false;
          }
        }
        result += stringParts[i];
        i++;
      }
      return result;
    },
    id: dataToRelKeyString,
    formatSelection: dataToRelKeyString,
    dropdownCssClass: "bigdrop",
    escapeMarkup: function (m) {
      return m;
    }
  }).on("change", function (e) {
    var rel = $(".dataset-search").select2("data"),
      url = myriaConnection + "/dataset/user-" + rel.userName + "/program-" + rel.programName + "/relation-" + rel.relationName;
    $.getJSON(url, function (data) {
      if (data.numTuples <= 0) {
        $("#dataset-columns").html('<p>Sorry, this dataset is empty.</p>');
      } else if (data.numTuples > 100000) {
        $("#dataset-columns").html('<p>Sorry, this dataset is too large (' + data.numTuples + ' rows) to plot</p>');
      } else {
        var t = dataset_templates.dataset_columns;
        var html = '';
        data.types = {};
        _.each(_.zip(data.schema.columnNames, data.schema.columnTypes), function (d) {
          html += t.row({name: d[0], type: d[1]});
          data.types[d[0]] = d[1];
        });
        html = t.table({content: html});
        $("#dataset-columns").html(html);
        registerCheckboxListeners();
      }
      var columnSelect = $("#columns-choose");
      columnSelect.show();
      $(document).scrollTop(columnSelect.offset().top);
      $('#plot-btn').prop("disabled", true);
      downloaded_data = undefined;
      dataset_metadata = data;
      console.log("done");
    });
  });
}

function renderCDF(container, dv, series) {
  var data = series[0];
  data.sort(function (a, b) {
    return a - b;
  });

  var values = _.map(data, function (x, i) {return [(i+1)/data.length, x];});
  var chart = $('#' + container).highcharts({
    chart: {
      type: 'line',
      animation: false
    },
    title: {text: 'Distribution of ' + dv[0]},
    xAxis: {
      title: {
        text: "Cumulative fraction of rows"
      }
    },
    yAxis: {
      title: {
        text: dv[0]
      }
    },
    legend: {enabled: false},
    series: [{
      'data': values,
      'animation': false
    }]
  });
}

function renderScatterPlot(container, dv, series) {
  $('#' + container).highcharts({
    chart: {
      type: 'scatter',
      animation: false
    },
    title: {text: dv[0] + ' vs ' + dv[1]},
    xAxis: {
      title: {
        text: dv[0]
      }
    },
    yAxis: {
      title: {
        text: dv[1]
      }
    },
    legend: {enabled: false},
    series: [{
      'data': _.zip(series[0], series[1]),
      'animation': false
    }]
  });
}

updateExamplesHeight = function () {
  // the height of the footer and header + nav is estimated, so is the height of the tabbar and the description
  $('#examples-list').height(_.max([$(window).height() - 250, $('#editor-column').height() - 100]));
};

$(function () {
  initializeDatasetSearch();
  $('#plot-btn').click(makePlot);
});
