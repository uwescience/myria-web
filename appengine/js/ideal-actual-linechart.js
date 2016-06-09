var margin = {top: 20, right: 200, bottom: 30, left: 30},
    width = 300 - margin.left - margin.right,
    height = 180 - margin.top - margin.bottom;

var x = d3.scale.linear()
        .domain([0,50])
        .range([0,250])
        .clamp(true);

var y = d3.scale.linear()
    .range([height, 0]);

var xAxis = d3.svg.axis()
    .scale(x)
    .orient("bottom")
    .tickFormat(d3.format('d'));

var yAxis = d3.svg.axis()
    .scale(y)
    .orient("left").ticks(5);

var idealLine = d3.svg.line()
    .x(function(d) { return x(d.queryID); })
    .y(function(d) { return y(d.ideal); });

var actualLine = d3.svg.line()
    .x(function(d) { return x(d.queryID); }) 
    .y(function(d) { return y(d.actual); });

var svg = d3.select("#idealactual").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

var idealLinePath = null;
var actualLinePath = null;

var userPoints  = []

var firstObj = {}
firstObj.queryID = "0"
firstObj.actual = "0"
firstObj.ideal = "0"
userPoints.push(firstObj)

x.domain(d3.extent(userPoints, function(d) { return d.queryID; }));

svg.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(0," + height + ")")
      .call(xAxis)
    .append("text")
      .attr("y", 28)
      .attr("x", 115)
      .text("Query ID");


y.domain(d3.extent([0,12]));

svg.append("g")
    .attr("class", "y axis")
    .call(yAxis)
  .append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", 0- 20)
    .attr("x",0 - (height / 2))
    .style("text-anchor", "middle")
    .text("Cluster Size");

idealLinePath = svg.append("path")
    .attr("class", "lineIdeal")
    .attr("d", idealLine(userPoints));

actualLinePath =  svg.append("path")
    .attr("class", "lineActual")
    .attr("d", actualLine(userPoints))

// this won't be necessary if running on coordinator
host = ''

function updateActualIdealLineGraph() {

      var newDataPoint = {}
      newDataPoint.queryID = ithQuery

      $.when(getRequest('/perfenforce/cluster-size'), getRequest('/perfenforce/current-query-ideal')).done(function(clusterSize, idealSize){

        newDataPoint.actual = clusterSize[0]
        newDataPoint.ideal = idealSize[0]

        userPoints.push(newDataPoint)

        x.domain(d3.extent(userPoints, function(d) { return d.queryID; }))
        svg.select("g.x.axis") // change the x axis
            .transition(2000)
            .call(xAxis);

        svg.select(".lineActual")   // change the line
            .transition(2000)
            .attr("d", actualLine(userPoints));

        svg.select(".lineIdeal")   // change the line
            .transition(2000)
            .attr("d", idealLine(userPoints));

      });
      

}
