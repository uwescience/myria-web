/* Setup the global language variable. */
var editorLanguage = 'MyriaL';

function handleerrors(request, display) {
  request.done(function(result) {
    var formatted = result.split("\n").join("<br>");
    $(display).html(formatted);
  });

  request.fail(function(jqXHR, textStatus, errorThrown) {
    if (textStatus == 'timeout') {
      $(display).text("Server is not responding");
      return;
    }

    $(display).text(jqXHR.responseText);
  });
}

function getplan() {
  var query = editor.getValue();
  var request = $.post("plan", {
    query : query,
    language : editorLanguage
  });
  handleerrors(request, "#plan");
  var request = $.post("dot", {
    query : query,
    type : 'logical',
    language : editorLanguage
  });
  request.success(function(dot) {
    var result = Viz(dot, "svg");
    $('#relational_svg').html(result);
    $('svg').width('100%');
    $('svg').height('100%');
  });
}

function optimizeplan() {
  getplan(); // make sure the plan matches the query
  var query = editor.getValue();
  var request = $.post("optimize", {
    query : query,
    language : editorLanguage
  });
  handleerrors(request, "#optimized");
  var request = $.post("dot", {
    query : query,
    type : 'physical',
    language : editorLanguage
  });
  request.success(function(dot) {
    var result = Viz(dot, "svg");
    $('#myria_svg').html(result);
    $('svg').width('100%');
    $('svg').height('100%');
  });
}

function compileplan() {
  var query = editor.getValue();
  var url = "compile?" + $.param({
    query : query,
    language : editorLanguage,
  });
  window.open(url, '_blank');
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

function displayQueryStatus(query_status) {
  var start_time = query_status['startTime'];
  var end_time = query_status['finishTime'];
  var elapsed = query_status['elapsedNanos'] / 1e9;
  var status = query_status['status'];
  var query_id = query_status['queryId'];
  $("#executed").text(
      "#" + query_id + " status:" + status + " start:" + start_time + " end:" + end_time + " elapsed: " + elapsed);
  if (status==='ACCEPTED' || status==='RUNNING' || status==='PAUSED') {
    setTimeout(function() {
      checkQueryStatus(query_id);
    }, 1000);
  }
}

function displayQueryError(error, query_id) {
  multiline($("#executed"), "Error checking query status; it's probably done. Attempting to refresh\n" + error.responseText);
  setTimeout(function() {
    checkQueryStatus(query_id);
  }, 1000);
}

function checkQueryStatus(query_id) {
  var errFunc = function(error) {
    displayQueryError(error, query_id);
  };
  $.ajax("execute", {
    type : 'GET',
    data : {
      queryId : query_id,
      language : editorLanguage
    },
    success : displayQueryStatus,
    error : errFunc
  });
}

function executeplan() {
  $('#editor-tabs a[href="#result"]').tab('show');

  $('#executed').text('...');
  optimizeplan(); // make sure the plan matches the query
  var query = editor.getValue();
  var request = $.ajax("execute", {
    type : 'POST',
    data : {
      query : query,
      language : editorLanguage,
      profile: $("#profile-enabled").is(':checked')
    },
    statusCode : {
      200 : displayQueryStatus,
      201 : displayQueryStatus,
      202 : displayQueryStatus,
    }
  });
  request.error(function(jqXHR, textStatus, errorThrown) {
    $('#executed').text(jqXHR.responseText);
  });
}

function resetResults() {
  $(".display").empty();
  $("#executed").text("Run query to see results here...");
  $("svg").empty();
}

function updateExamples(language) {
  var doUpdateExamples = function(data) {
    var examplesList = $('#examples-list');
    examplesList.empty();
    if (data.length === 0) {
      examplesList.append('No ' + language + ' examples found');
    } else {
      /* Populate the list of examples. */
      for (var i = 0; i < data.length; ++i) {
        examplesList.append('<div class="example-label">' + data[i][0] + '</div>');
        examplesList.append('<div class="example">' + data[i][1] + '</div>');
      }
      /* Restore the click functionality on the examples. */
      $(".example").click(function() {
        resetResults();
        var example_query = $(this).text();
        editor.setValue(example_query);
        optimizeplan();
      });
    }
    /*
     * Finally, set the global variable editorLanguage to the new language. This
     * makes all the API calls back use this query parameter.
     *
     * Then trigger the first example.
     */
    editorLanguage = language;
    $(".example").first().click();
  }
  $.ajax("examples", {
    type : 'GET',
    data : {
      language : language
    },
    success : doUpdateExamples
  });
}

function changeLanguage() {
  /* First make sure it's a valid language. */
  var languages = [ 'datalog', 'myrial', 'sql' ];
  var language = $(".language-menu option:selected").val();
  var i = languages.indexOf(language);
  if (i == -1) {
    return false;
  }

  $('#editor-tabs a[href="#examples"]').tab('show');

  if (language === 'myrial') {
    editor.setOption('mode', {name: 'myrial',
               singleLineStringErrors: false});
  } else if (language === 'sql') {
    editor.setOption('mode', 'text/x-sql');
  } else {
    editor.setOption('mode', {name: 'prolog'});
  }

  /* Now let's update the examples. */
  updateExamples(language);
}

/**
 * This function populates the modal dialog box with the contents of the clicked
 * SVG.
 */
function showSvgModal() {
  $('#svg-modal-output').empty();
  var svgOutput = document.getElementById(this.getAttribute('data-output'));
  var svgModalOutput = document.getElementById("svg-modal-output");
  for (var i = 0; i < svgOutput.childElementCount; ++i) {
    svgModalOutput.appendChild(svgOutput.children[i].cloneNode(true));
  }

  var panzoom = $('.zoom-canvas').panzoom({
    maxScale : 10,
    minScale : 1,
    contain : 'invert',
    $zoomRange : $(".modal-header .zoom-range"),
    $reset : $(".modal-header .zoom-reset")
  }).panzoom("reset");
}

function resizeEditor() {
  if ($('.editor-row').hasClass("expanded")) {
    $('.editor-row').removeClass("expanded")
    $('.editor-row>div:first').attr("class", "col-md-7");
    $('.editor-row>div:nth-child(2)').attr("class", "col-md-5");
  } else {
    $('.editor-row').addClass("expanded")
    $('.editor-row>div:first').attr("class", "col-md-12");
    $('.editor-row>div:nth-child(2)').attr("class", "col-md-12");
  }
}

function initializeDatasetSearch() {
  var dataToRelKeyString = function(d) {
    return d.userName + ':' + d.programName + ':' + d.relationName;
  };

  $(".dataset-search").select2({
    placeholder: "Search for a dataset...",
    minimumInputLength: 3,
    ajax: {
      url: "http://" + myriaConnection + "/dataset/search/",
      dataType: 'json',
      quietMillis: 100,
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
    formatResult: function(d, container, query) {
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
    escapeMarkup: function (m) { return m; }
  }).on("change", function(e) {
    var rel = $(".dataset-search").select2("data")
    url = "http://" + myriaConnection + "/dataset/user-" + rel.userName + "/program-" + rel.programName + "/relation-" + rel.relationName;
    $.getJSON(url, function(data) {
      var html = JSON.stringify(data.schema, null, 4);
      $("#dataset-information").text(html);
    });
  });
}

$(function() {
  resetResults();

  editor.on("change", resetResults);
  editor.on("keydown", resetResults);
  editor.on("keypress", resetResults);
  $(".planner").click(function() {
    $('#editor-tabs a[href="#queryplan"]').tab('show');
    optimizeplan();
  });
  $(".compiler").click(compileplan);
  $(".executor").click(executeplan);
  $(".language-menu").change(changeLanguage);
  $(".example").click(function() {
    resetResults();
    var example_query = $(this).text();
    editor.setValue(example_query);
    optimizeplan();
  });
  $(".show-svg-modal").click(showSvgModal);
  $(".resize-editor").click(resizeEditor);
  initializeDatasetSearch();
  optimizeplan();
});
