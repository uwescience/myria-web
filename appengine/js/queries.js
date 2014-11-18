$(document).ready(function() {
	$('.query-row[data-status="RUNNING"]').each(function(i, e) {
		var qid = $(this).attr('data-id');
		window.setInterval(function() {
			$.getJSON('/execute', { 'queryId': qid }, function(data) {
				if (data.status != 'RUNNING') {
					location.reload();
				}
			});
		}, 10*1000);
	});

	$('.kill-query').click(function() {
		$.ajax({
		    url: $(this).attr('href'),
		    type: 'DELETE',
		    success: function(result) {
		        location.reload();
		    }
		});
		return false;
	});
});