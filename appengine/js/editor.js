function handleerrors(request, display) {
	request.success(function(result) {
		var formatted = result.split("\n").join("<br>");
		$(display).html(formatted);
		// $(display).text(result);
	});

	request.error(function(jqXHR, textStatus, errorThrown) {
		if (textStatus == 'timeout')
			$(display).text("Server is not responding");

		if (textStatus == 'error')
			var msg = '<div class="error"><a href="';
		msg = msg + this.url;
		msg = msg + '">Error</a></div>';
		$(display).html(msg);
	});
}

function getplan() {
	var query = $("#query").val();
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
	var query = $("#query").val();
	var request = $.get("optimize", {
		query : query,
		target : "MyriaAlgebra"
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
	var query = $("#query").val();
	var url = "compile?" + $.param({
		query : query,
		target : "MyriaAlgebra"
	});
	document.location.href = url;
}

function resetResults() {
	$(".display").empty();
	$("svg").empty();	
}

$(document).ready(function() {
	$("#query").bind('keyup change', resetResults);
	$(".planner").click(optimizeplan);
	$(".compiler").click(compileplan);
	$(".example").click(function() {
		resetResults();
		var example_query = $(this).text();
		$("#query").val(example_query);
		optimizeplan();
	});
	optimizeplan();
});
