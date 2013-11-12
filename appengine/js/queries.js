$(document).ready(function() {
	$('.query-row[data-status="RUNNING"]').each(function(i, e) {
		var qid = $(this).attr('data-id');
		window.setInterval(function() {
			$.getJSON('/execute', { 'query_id': qid }, function(data) {
				if (data.query_status != 'RUNNING') {
					location.reload();
				}
			});
		}, 10*1000);
	});
});