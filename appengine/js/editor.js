/* Setup the global language variable. */
var editorLanguage = 'Datalog';

function handleerrors(request, display) {
	request.success(function(result) {
		var formatted = result.split("\n").join("<br>");
		$(display).html(formatted);
	});

	request.error(function(jqXHR, textStatus, errorThrown) {
		if (textStatus == 'timeout') {
			$(display).text("Server is not responding");
			return;
		}

		var msg = '<div class="error"><a href="';
		msg = msg + this.url;
		msg = msg + '" target="_blank">Error</a></div>';
		$(display).html(msg);
	});
}

function getplan() {
	var query = editor.getValue();
	var request = $.get("plan", {
		query : query,
		language : editorLanguage
	});
	handleerrors(request, "#plan");
	var request = $.get("dot", {
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
	var request = $.get("optimize", {
		query : query,
		language : editorLanguage
	});
	handleerrors(request, "#optimized");
	var request = $.get("dot", {
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
	});
	window.open(url, '_blank');
}

function displayQueryStatus(data) {
	var queryStatus = data['query_status'];
	var start_time = queryStatus['start_time'];
	var end_time = queryStatus['finish_time'];
	var elapsed = queryStatus['elapsed_nanos'] / 1e9;
	var status = queryStatus['status'];
	var query_id = queryStatus['query_id'];
	$("#executed").text(
			"#" + query_id + " status:" + status + " start:" + start_time +
					" end:" + end_time + " elapsed: " + elapsed);
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
			query_id : query_id,
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
			for ( var i = 0; i < data.length; ++i) {
				examplesList.append('<div class="label">' + data[i][0] +
						'</div>');
				examplesList.append('<div class="example">' + data[i][1] +
						'</div>');
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
		 * Finally, set the global variable editorLanguage to the new language.
		 * This makes all the API calls back use this query parameter.
		 */
		editorLanguage = language;
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
	var languages = [ 'Datalog', 'Myria' ];
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
	for ( var j = 0; j < languages.length; ++j) {
		languageMenu.append('<li><a class="changer">' + languages[j] +
			'</a></li>');
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
	for ( var i = 0; i < svgOutput.childElementCount; ++i) {
		svgModalOutput.appendChild(svgOutput.children[i].cloneNode(true));
	}

	var panzoom = $('#zoom-canvas').panzoom({
		maxScale: 5,
		minScale: 1,
		$zoomRange: $(".modal-header .zoom-range"),
		$reset: $(".modal-header .zoom-reset")
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
