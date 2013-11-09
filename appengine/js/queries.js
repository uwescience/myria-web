$(document).ready(function() {
	var x = $('.query-status').filter(function (index) {
		return this.innerHTML==='RUNNING';
	});
	if (x.length > 0) {
		setTimeout(function() { location.reload(); }, 30*1000);
	}
});