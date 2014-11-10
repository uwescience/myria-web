$(function() {
  $("#restart-submit").click(function() {
    $("#restart-submit").hide();
    $("#restart-tips").text("Waiting...");
    $("#restart-form").submit();
  });

  $("#restart").click(function() {
     $("#restart-tips").text("");
     $("#restart-form")[0].reset();
     $("#restart-form").show();
     $("#restart-submit").show();
  })
});
