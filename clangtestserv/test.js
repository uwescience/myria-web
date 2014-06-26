var source;
$(document).ready(function() {
//    var qid = 1;
    var url = //'http://localhost:8080/execute';
'http://localhost:8080/compile?query=A(x)+%3A-+R(x%2C3)&language=datalog&backend=clang' ;
  $.getJSON(url).success(function(json) {
      $('#info').text(json.plan);
      var request = $.ajax('http://localhost:13373', {
          type: "POST",
          datatype:"JSON",
          data: {"qid" : json.qid, "plan": escape(json.plan)},
	  contentType: 'application/json',
          success: function(data, textStatus){
              console.log('success');
          }
      });
      request.error(function(jqXHR, textStatus, errorThrown) {
	  console.log('err');
	  console.log(errorThrown);
      });
.fail(function(jqXHR, textStatus) {
	    $('#info').text(jqXHR.responseText);
});


});
