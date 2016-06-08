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

d3.csv("../perfenforce_data/actual-ideal.csv", function(error, data) {
  if (error) throw error;

  data.forEach(function(d) {
        d.queryID = +d.queryID;
        d.actual = +d.actual;
        d.ideal = +d.ideal;
    });

  x.domain(d3.extent(data, function(d) { return d.queryID; }));
  y.domain(d3.extent([0,12]));

  svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis)
      .append("text")
        .attr("y", 28)
        .attr("x", 115)
        .text("Query ID");

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
      .attr("d", idealLine(data));

  actualLinePath =  svg.append("path")
      .attr("class", "lineActual")
      .attr("d", actualLine(data));

});

var xmlHttp = null
function getClusterSize()
{      
    xmlHttp = new XMLHttpRequest();
    //xmlHttp.onreadystatechange = ProcessRequest;
    xmlHttp.open("GET", "http://ec2-52-41-7-106.us-west-2.compute.amazonaws.com:8753/perfenforce/cluster-size", false); // true for asynchronous 
    xmlHttp.send( null );
}

function updateData() {
  //Get the data again
  d3.csv("../perfenforce_data/actual-ideal.csv", function(error, data) {
      console.log(data)
      var newDataPoint = {}
      newDataPoint.queryID = "8"
      newDataPoint.actual = "6"
      newDataPoint.ideal = "4"

      data.push(newDataPoint)

      getClusterSize()
      console.log(xmlHttp.responseText)

      console.log(data[0])
      console.log(newDataPoint)
      console.log(data)

      x.domain(d3.extent(data, function(d) { return d.queryID; }));
      svg.select("g.x.axis") // change the x axis
            .transition(1500)
            .call(xAxis);

      svg.select(".lineActual")   // change the line
            .transition(1500)
            .attr("d", actualLine(data));

      svg.select(".lineIdeal")   // change the line
            .transition(1500)
            .attr("d", idealLine(data));

  });
}
