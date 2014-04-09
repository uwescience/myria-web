function changePlan() {
  /* Get query plan. */
  var plans = [ 'traditional plan', 'HyperCube plan' ];
  var plan = $(this).text();
  var i = plans.indexOf(plan);
  if (i == -1) {
    return false;
  }
  else if(i == 0){
    showPlan(tradPlan);
  }
  else if(i==1){
    showPlan(hyperCubePlan);
  }

  /* Update the UI around the plan selector button. */
  plans.splice(i, 1);
  $('#plan-btn').text("Compile to " + plan);
  var planMenu = $('#plan-menu');
  planMenu.empty();
  for (var j = 0; j < plans.length; ++j) {
    planMenu.append('<li><a class="changer">' + plans[j] + '</a></li>');
  }
  $(".changer").click(changePlan);

}

function showPlan(plan){
  d3.select('.query-plan').each(function() {
    $('.query-plan').empty();
    queryGraph(d3.select('.query-plan'), plan);
  });
}

$(document).ready(function() {
  $("#plan-btn").on('click', function(){
    if($(this).text()==="Compile to traditional plan"){
      showPlan(tradPlan);
    }
    else{
      showPlan(hyperCubePlan);
    }
  });
  $(".changer").click(changePlan);
});

