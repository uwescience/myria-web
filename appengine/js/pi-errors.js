var margin_pi = {top_pi: 50, right_pi: 200, bottom_pi: 30, left_pi: 40},
    width_pi = 300 - margin_pi.left_pi - margin_pi.right_pi,
    height_pi = 160 - margin_pi.top_pi - margin_pi.bottom_pi;

var x_pi = d3.scale.linear()
        .domain([0,50])
        .range([0,250])
        .clamp(true);

var y_pi = d3.scale.linear()
    .range([height_pi, 0]);

var xAxis_pi = d3.svg.axis()
    .scale(x_pi)
    .orient("bottom")
    .tickFormat(d3.format('d'));

var yAxis_pi = d3.svg.axis()
    .scale(y_pi)
    .orient("left").ticks(5);

var currentError_pi = d3.svg.line()
    .x(function(d) { return x_pi(d.queryID); })
    .y(function(d) { return y_pi(d.PIControlProportionalErrorValue); });

var errorSum_pi = d3.svg.line()
    .x(function(d) { return x_pi(d.queryID); }) 
    .y(function(d) { return y_pi(d.PIControlIntegralErrorSum); });

var svg_pi = d3.select("#piError").append("svg")
    .attr("width", width_pi + margin_pi.left_pi + margin_pi.right_pi)
    .attr("height", height_pi + margin_pi.top_pi + margin_pi.bottom_pi)
  .append("g")
    .attr("transform", "translate(" + margin_pi.left_pi + "," + margin_pi.top_pi + ")");

var currentErrorPath = null;
var errorSumPath = null;

var userPoints_pi  = []

x_pi.domain(d3.extent(userPoints_pi, function(d) { return d.queryID; }));

svg_pi.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(0," + height_pi + ")")
      .call(xAxis_pi)
    .append("text")
      .attr("y", 28)
      .attr("x", 115)
      .text("Query ID");

maxProportion = Math.max.apply(Math,userPoints_pi.map(function(o){return o.PIControlProportionalErrorValue;}))
        maxSum = Math.max.apply(Math,userPoints_pi.map(function(o){return o.PIControlIntegralErrorSum;}))

        var maxNum = maxProportion >  maxSum ? maxProportion : maxSum;

        minProportion = Math.min.apply(Math,userPoints_pi.map(function(o){return o.PIControlProportionalErrorValue;}))
        minSum = Math.min.apply(Math,userPoints_pi.map(function(o){return o.PIControlIntegralErrorSum;}))

        var maxNum = maxProportion >  maxSum ? maxProportion : maxSum
         var minNum = minProportion <  minSum ? minProportion : minSum

        y_pi.domain(d3.extent([minNum,maxNum]));

svg_pi.append("g")
    .attr("class", "y axis")
    .call(yAxis_pi)
  .append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", 0- 30)
    .attr("x",0 - (height_pi / 2) )
    .style("text-anchor", "middle")
    .text("Error");

currentErrorPath = svg_pi.append("path")
    .attr("class", "lineCurrentError")
    .attr("d", currentError_pi(userPoints_pi))
    .attr("data-legend",function(d) { return "Proportional Error"});

errorSumPath =  svg_pi.append("path")
    .attr("class", "lineErrorSum")
    .attr("d", errorSum_pi(userPoints_pi))
    .attr("data-legend",function(d) { return "Integral Sum Error"})

legend_pi = svg_pi.append("g")
    .attr("class","legend")
    .attr("transform","translate(150,-25)")
    .style("font-size","10px")
    .call(d3.legend)

function updatePIErrorLines() {

      var newDataPoint_pi = {}
      newDataPoint_pi.queryID = ithQuery

      $.when(getRequest('/perfenforce/scaling-algorithm-state')).done(function(scalingState){

        newDataPoint_pi.PIControlProportionalErrorValue = scalingState.PIControlProportionalErrorValue
        newDataPoint_pi.PIControlIntegralErrorSum = scalingState.PIControlIntegralErrorSum

        userPoints_pi.push(newDataPoint_pi)

        console.log("pi new point")
        console.log(newDataPoint_pi)

        x_pi.domain(d3.extent(userPoints_pi, function(d) { return d.queryID; }))
        svg_pi.select("g.x.axis") // change the x axis
            .transition(2000)
            .call(xAxis_pi);

        console.log(userPoints_pi);

        maxProportion = Math.max.apply(Math,userPoints_pi.map(function(o){return o.PIControlProportionalErrorValue;}))
        maxSum = Math.max.apply(Math,userPoints_pi.map(function(o){return o.PIControlIntegralErrorSum;}))

        var maxNum = maxProportion >  maxSum ? maxProportion : maxSum;

        minProportion = Math.min.apply(Math,userPoints_pi.map(function(o){return o.PIControlProportionalErrorValue;}))
        minSum = Math.min.apply(Math,userPoints_pi.map(function(o){return o.PIControlIntegralErrorSum;}))

        var maxNum = maxProportion >  maxSum ? maxProportion : maxSum
         var minNum = minProportion <  minSum ? minProportion : minSum

        y_pi.domain(d3.extent([minNum,maxNum]));

        svg_pi.select("g.y.axis") // change the x axis
            .transition(2000)
            .call(yAxis_pi);

        svg_pi.select(".lineCurrentError")   // change the line
            .transition(2000)
            .attr("d", currentError_pi(userPoints_pi));

        svg_pi.select(".lineErrorSum")   // change the line
            .transition(2000)
            .attr("d", errorSum_pi(userPoints_pi));

      });
}
