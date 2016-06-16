var margin_rl = {top_rl: 10, right_rl: 200, bottom_rl: 30, left_rl: 50},
    width_rl = 400 - margin_rl.left_rl - margin_rl.right_rl,
    height_rl = 180 - margin_rl.top_rl - margin_rl.bottom_rl;


var x_rl = d3.scale.ordinal().rangeRoundBands([0, width_rl+100], .05);

var y_rl = d3.scale.linear().range([height_rl, 0]);

var xAxis_rl = d3.svg.axis()
    .scale(x_rl)
    .orient("bottom")
    .tickFormat(d3.format('d'));

var yAxis_rl = d3.svg.axis()
    .scale(y_rl)
    .orient("left")
    .ticks(5);


var svg_rl = d3.select("#rl-barchart").append("svg")
    .attr("width", width_rl + margin_rl.left_rl + margin_rl.right_rl)
    .attr("height", height_rl + margin_rl.top_rl + margin_rl.bottom_rl)
  .append("g")
    .attr("transform", 
          "translate(" + margin_rl.left_rl + "," + margin_rl.top_rl + ")");

   userData = []
  for (i = 0; i < configs.length; i++)
  {
      obj = {}
      obj.cluster = configs[i]
      obj.rewardRatio = 0

      if(obj.rewardRatio >= 0)
      {
      userData.push(obj)
      }
  }


  x_rl.domain(userData.map(function(d) { return d.cluster; }));
  y_rl.domain([0, 5.0]);

  svg_rl.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(0," + height_rl + ")")
      .call(xAxis_rl)
    .append("text")
      .attr("y", 30)
      .attr("x", 100)
      .text("Cluster Size")
    .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", "-.55em")
      .attr("transform", "rotate(-90)" );

  svg_rl.append("g")
      .attr("class", "y axis")
      .call(yAxis_rl)
    .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0- 30)
      .attr("x",0 - (height_rl / 2))
      .style("text-anchor", "middle")
      .text("Ratio Reward");

  svg_rl.selectAll("bar")
      .data(userData)
    .enter().append("rect")
      .style("fill", "steelblue")
      .attr("x", function(d) { return x_rl(d.cluster); })
      .attr("width", x_rl.rangeBand())
      .attr("y", function(d) { return y_rl(d.rewardRatio); })
      .attr("height", function(d) { return height_rl - y_rl(d.rewardRatio); });


function updateRLAwardChart() {
    console.log("updating graph bar...");

    $.when(getRequest('/perfenforce/scaling-algorithm-state')).done(function(scalingState){
      console.log("SCALING STATE")
      console.log(scalingState.RLActiveStates)

      userData = []
      for (i = 0; i < scalingState.RLActiveStates.length; i++)
      {
          obj = {}
          obj.cluster = configs[i]
          obj.rewardRatio = scalingState.RLActiveStates[i]

          if(obj.rewardRatio < 0)
          {obj.rewardRatio = 0
          }
          userData.push(obj)
      }
    });

    x_rl.domain(userData.map(function(d) { return d.cluster; }));

    svg_rl.select("g.x.axis") // change the x axis
            .transition(2000)
            .call(xAxis_rl);

    svg_rl.selectAll("rect").data(userData)   // change the bar
            .transition(2000)
      .attr("x", function(d) { return x_rl(d.cluster); })
      .attr("width", x_rl.rangeBand())
      .attr("y", function(d) { return y_rl(d.rewardRatio); })
      .attr("height", function(d) { return height_rl - y_rl(d.rewardRatio); });

}
