function changePlan() {
  /* First make sure it's a valid language. */
  var plans = [ 'traditional plan', 'HyperCube plan' ];
  var plan = $(this).text();
  var i = plans.indexOf(plan);
  if (i == -1) {
    return false;
  }

  /* Now let's update the UI around the language selector button. */
  plans.splice(i, 1);
  $('#plan-btn').text("Comple to " + plan);
  var planMenu = $('#plan-menu');
  planMenu.empty();
  for (var j = 0; j < plans.length; ++j) {
    planMenu.append('<li><a class="changer">' + plans[j] + '</a></li>');
  }
  $(".changer").click(changePlan);

}

$(document).ready(function() {
  $(".changer").click(changePlan);
});