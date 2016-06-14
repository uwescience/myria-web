var margin_oml = {top_oml: 10, right_oml: 200, bottom_oml: 30, left_oml: 50},
    width_oml = 400 - margin_oml.left_oml - margin_oml.right_oml,
    height_oml = 180 - margin_oml.top_oml - margin_oml.bottom_oml;

var x_oml = d3.scale.linear()
        .domain([0,50])
        .range([0,250])
        .clamp(true);

var y_oml = d3.scale.linear()
    .range([height_oml, 0]);

var xAxis_oml = d3.svg.axis()
    .scale(x_oml)
    .orient("bottom")
    .tickFormat(d3.format('d'));

var yAxis_oml = d3.svg.axis()
    .scale(y_oml)
    .orient("left").ticks(5);

var workers_4_function = d3.svg.line()
    .x(function(d) { return x_oml(d.queryID); })
    .y(function(d) { return y_oml(d.OMLPredictions[0]<0?0:d.OMLPredictions[0]); });

var workers_6_function = d3.svg.line()
    .x(function(d) { return x_oml(d.queryID); })
    .y(function(d) { return y_oml(d.OMLPredictions[1]<0?0:d.OMLPredictions[1]); });

var workers_8_function = d3.svg.line()
    .x(function(d) { return x_oml(d.queryID); })
    .y(function(d) { return y_oml(d.OMLPredictions[2]<0?0:d.OMLPredictions[2]); });

var workers_10_function = d3.svg.line()
    .x(function(d) { return x_oml(d.queryID); })
    .y(function(d) { return y_oml(d.OMLPredictions[3]<0?0:d.OMLPredictions[3]); });

var workers_12_function = d3.svg.line()
    .x(function(d) { return x_oml(d.queryID); })
    .y(function(d) { return y_oml(d.OMLPredictions[4]<0?0:d.OMLPredictions[4]); });

var svg_oml = d3.select("#omlPredictions").append("svg")
    .attr("width", width_oml + margin_oml.left_oml + margin_oml.right_oml)
    .attr("height", height_oml + margin_oml.top_oml + margin_oml.bottom_oml)
  .append("g")
    .attr("transform", "translate(" + margin_oml.left_oml + "," + margin_oml.top_oml + ")");

var workers_4_path = null;
var workers_6_path = null;
var workers_8_path = null;
var workers_10_path = null;
var workers_12_path = null;

var userPoints_oml  = []

var firstObj_oml = {}
firstObj_oml.queryID = "0"
firstObj_oml.OMLPredictions = [0,0,0,0,0]
userPoints_oml.push(firstObj_oml)

x_oml.domain(d3.extent(userPoints_oml, function(d) { return d.queryID; }));

svg_oml.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(0," + height_oml + ")")
      .call(xAxis_oml)
    .append("text")
      .attr("y", 28)
      .attr("x", 115)
      .text("Query ID");

maxArray = []
for (i = 0; i< 5; i++)
{
    maxArray.push(Math.max.apply(Math,userPoints_oml.map(function(o){return o.OMLPredictions[i];})))
}

finalMax = Math.max.apply(Math,maxArray.map(function(o){return o;}))

y_oml.domain(d3.extent([0,finalMax]));

svg_oml.append("g")
    .attr("class", "y axis")
    .call(yAxis_oml)
  .append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", 0- 30)
    .attr("x",0 - (height_oml / 2) )
    .style("text-anchor", "middle")
    .text("Predicted Runtime");

workers_4_path = svg_oml.append("path")
    .attr("class", "line4")
    .attr("d", workers_4_function(userPoints_oml));

workers_6_path = svg_oml.append("path")
    .attr("class", "line6")
    .attr("d", workers_6_function(userPoints_oml));

workers_8_path = svg_oml.append("path")
    .attr("class", "line8")
    .attr("d", workers_8_function(userPoints_oml));

workers_10_path = svg_oml.append("path")
    .attr("class", "line10")
    .attr("d", workers_10_function(userPoints_oml));

workers_12_path = svg_oml.append("path")
    .attr("class", "line12")
    .attr("d", workers_12_function(userPoints_oml));

function updateOMLPredictionLines() {

      var newDataPoint_oml = {}
      newDataPoint_oml.queryID = ithQuery

      $.when(getRequest('/perfenforce/scaling-algorithm-state')).done(function(scalingState){

        console.log("STATE " + scalingState)
        console.log("STATE PRED " + scalingState.OMLPredictions)

        newDataPoint_oml.OMLPredictions = scalingState.OMLPredictions;

        console.log(newDataPoint_oml)

        userPoints_oml.push(newDataPoint_oml)

        x_oml.domain(d3.extent(userPoints_oml, function(d) { return d.queryID; }))
        svg_oml.select("g.x.axis") // change the x axis
            .transition(2000)
            .call(xAxis_oml);

        console.log(userPoints_oml);

        maxArray = []
        for (i = 0; i< 5; i++)
        {
            maxArray.push(Math.max.apply(Math,userPoints_oml.map(function(o){return o.OMLPredictions[i];})))
        }

        finalMax = Math.max.apply(Math,maxArray.map(function(o){return o;}))

        y_oml.domain(d3.extent([0,finalMax]));

        svg_oml.select("g.y.axis") // change the x axis
            .transition(2000)
            .call(yAxis_oml);

        svg_oml.select(".line4")   // change the line
            .transition(2000)
            .attr("d", workers_4_function(userPoints_oml));

        svg_oml.select(".line6")   // change the line
            .transition(2000)
            .attr("d", workers_6_function(userPoints_oml));

        svg_oml.select(".line8")   // change the line
            .transition(2000)
            .attr("d", workers_8_function(userPoints_oml));

        svg_oml.select(".line10")   // change the line
            .transition(2000)
            .attr("d", workers_10_function(userPoints_oml));

        svg_oml.select(".line12")   // change the line
            .transition(2000)
            .attr("d", workers_12_function(userPoints_oml));

      });
}
