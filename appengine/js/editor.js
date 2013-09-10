function handleerrors(request, display) {
  request.success(function(result) {
    var formatted = result.split("\n").join("<br>");
    $(display).html(formatted);
    //$(display).text(result);
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
  var request = $.get("plan", {query:query});
  handleerrors(request, "#plan");
};

function optimizeplan() {
  getplan(); // make sure the plan matches the query
  var query = $("#query").val();
  var request = $.get("optimize", {query:query, target:"MyriaAlgebra"});
  handleerrors(request, "#optimized");
}

function compileplan() {
  var query = $("#query").val();
  var url = "compile?" + $.param({query:query, target:"MyriaAlgebra"});
  document.location.href=url;
}

$(document).ready(function(){
  $("#query").bind('keyup change', function() {
  $(".display").empty();
});
  $(".planner").click(optimizeplan);
  $(".compiler").click(compileplan);
  $(".example").click(function(){
$(".display").empty();
var example_query = $(this).text();
$("#query").val(example_query);
optimizeplan();
});
  $(".display").css("border-style", "solid");
  $(".error").css("font-color", "red");
  $(".label").css("font-size", "small");
  $(".label").css("font-style", "italic");
  $(".display").css("width", 600);
  $(".display").css("height", 100);
});

