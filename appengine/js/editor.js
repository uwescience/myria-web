/* Setup the global language variable. */
var editorLanguage = 'Datalog';

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
  })
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

function displayQueryStatus(data) {
  var query_status = data['queryStatus'];
  var start_time = query_status['startTime'];
  var end_time = query_status['finishTime'];
  var elapsed = query_status['elapsedNanos'] / 1e9;
  var status = query_status['status'];
  var query_id = query_status['queryId'];
  $("#executed").text(
      "#" + query_id + " status:" + status + " start:" + start_time + " end:" + end_time + " elapsed: " + elapsed);
  if (!end_time) {
    setTimeout(function() {
      checkQueryStatus(query_id);
    }, 1000);
  }
}

function checkQueryStatus(query_id) {
  $.ajax("execute", {
    type : 'GET',
    data : {
      queryId : query_id,
      language : editorLanguage
    },
    statusCode : {
      200 : displayQueryStatus,
      201 : displayQueryStatus,
      202 : displayQueryStatus,
      400 : displayQueryStatus
    }
  });
}

function executeplan() {
  $('#executed').text('...');
  optimizeplan(); // make sure the plan matches the query
  var query = editor.getValue();
  var request = $.ajax("execute", {
    type : 'POST',
    data : {
      query : query,
      language : editorLanguage
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
  var languages = [ 'Datalog', 'MyriaL', 'SQL' ];
  var language = $(this).text();
  var i = languages.indexOf(language);
  if (i == -1) {
    return false;
  }

  /* Now let's update the UI around the language selector button. */
  languages.splice(i, 1);
  $('#parse-btn').text("Parse " + language);
  var languageMenu = $('#language-menu');
  languageMenu.empty();
  for (var j = 0; j < languages.length; ++j) {
    languageMenu.append('<li><a class="changer">' + languages[j] + '</a></li>');
  }
  $(".changer").click(changeLanguage);

  /* Now let's update the examples. */
  updateExamples(language);
}

/**
 * This function populates the modal dialog box with the contents of the clicked
 * SVG.
 */
function showSvgModal() {
  $('#svg-modal-output').empty();
  // DOM walking to find the correct SVG for this button press. Sensitive to
  // webpage changes.
  var parentHeader = this.parentNode;
  var svgOutput = parentHeader.nextElementSibling.firstElementChild;
  var svgModalOutput = document.getElementById("svg-modal-output");
  for (var i = 0; i < svgOutput.childElementCount; ++i) {
    svgModalOutput.appendChild(svgOutput.children[i].cloneNode(true));
  }

  var panzoom = $('#zoom-canvas').panzoom({
    maxScale : 10,
    minScale : 1,
    contain : 'invert',
    $zoomRange : $(".modal-header .zoom-range"),
    $reset : $(".modal-header .zoom-reset")
  }).panzoom("reset");
}

$(document).ready(function() {
  editor.on("change", resetResults);
  editor.on("keydown", resetResults);
  editor.on("keypress", resetResults);
  $(".planner").click(optimizeplan);
  $(".compiler").click(compileplan);
  $(".executor").click(executeplan);
  $(".changer").click(changeLanguage);
  $(".example").click(function() {
    resetResults();
    var example_query = $(this).text();
    editor.setValue(example_query);
    optimizeplan();
  });
  $(".show-svg-modal").click(showSvgModal);
  optimizeplan();
});
