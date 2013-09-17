function handleerrors(request, display) {
	request.success(function(result) {
		var formatted = result.split("\n").join("<br>");
		$(display).html(formatted);
		// $(display).text(result);
	});

	request.error(function(jqXHR, textStatus, errorThrown) {
		if (textStatus == 'timeout') {
			$(display).text("Server is not responding");
			return;
		}

		var msg = '<div class="error"><a href="';
		msg = msg + this.url;
		msg = msg + '">Error</a></div>';
		$(display).html(msg);
	});
}

function getplan() {
	var query = editor.getValue();
	var request = $.get("plan", {
		query : query
	});
	handleerrors(request, "#plan");
	var request = $.get("dot", {
		query : query,
		type : 'ra'
	});
	request.success(function(dot) {
		var result = Viz(dot, "svg");
		$('#relational_svg').html(result);
	})
};

function optimizeplan() {
	getplan(); // make sure the plan matches the query
	var query = editor.getValue();
	var request = $.get("optimize", {
		query : query,
	});
	handleerrors(request, "#optimized");
	var request = $.get("dot", {
		query : query,
		type : 'myria'
	});
	request.success(function(dot) {
		var result = Viz(dot, "svg");
		$('#myria_svg').html(result);
	})
}

function compileplan() {
	var query = editor.getValue();
	var url = "compile?" + $.param({
		query : query,
	});
	document.location.href = url;
}

function displayQueryStatus(data) {
	var queryStatus = data['query_status'];
	var start_time = queryStatus['start_time'];
	var end_time = queryStatus['finish_time'];
	var elapsed = queryStatus['elapsed_nanos'] / 1e9;
	var status = queryStatus['status'];
	var query_id = queryStatus['query_id'];
	$("#executed").text(
			"#" + query_id + " status:" + status + " start:" + start_time
					+ " end:" + end_time + " elapsed: " + elapsed);
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
			query_id : query_id
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
	optimizeplan(); // make sure the plan matches the query
	var query = editor.getValue();
	var request = $.ajax("execute", {
		type : 'POST',
		data : {
			query : query,
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

$(document).ready(function() {
	editor.on("change", resetResults);
	editor.on("keydown", resetResults);
	editor.on("keypress", resetResults);
	$(".planner").click(optimizeplan);
	$(".compiler").click(compileplan);
	$(".executor").click(executeplan);
	$(".example").click(function() {
		resetResults();
		var example_query = $(this).text();
		editor.setValue(example_query);
		optimizeplan();
	});
	optimizeplan();
});
