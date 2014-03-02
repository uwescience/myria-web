var fragmentVisualization = function (element, fragmentId, queryPlan) {
    // do all the chart stuff
    debug("I should build the gantt chart now");
    
    drawCharts(element, fragmentId, queryPlan);

    // return variables that are needed outside this scope
    return {};
};

function drawCharts(element, fragmentId, queryPlan) {
    drawArea(element, fragmentId, queryPlan.queryId);
    //drawLanes(element, []);
}

// Draw the area graph and the mini-brush for it
function drawArea(element, fragmentId, queryId) {

    var workers_data = [];

    var margin = {top: 10, right: 10, bottom: 60, left:20 },
        margin2 = {top: 160, right:10, bottom: 20, left:20},
        width = parseInt(element.style('width'), 10) - margin.left - margin.right,
        height = 200 - margin.top - margin.bottom,
        height2 = 200 - margin2.top - margin2.bottom;

    var x = d3.scale.linear().range([0, width]),
        x2 = d3.scale.linear().range([0, width]),
        y = d3.scale.linear().range([height, 0]),
        y2 = d3.scale.linear().range([height2, 0]);

    var xAxis = d3.svg.axis()
        .scale(x)
        .tickFormat(customTimeFormat)
        .tickSize(-height)
        .orient("bottom");
    
    var xAxis2 = d3.svg.axis()
        .scale(x2)
        .tickFormat(customTimeFormat)
        .tickSize(-height2)
        .orient("bottom");

    var yAxis = d3.svg.axis()
        .scale(y)
        .tickFormat(d3.format("d"))
        .orient("left");

    var brush = d3.svg.brush()
                  .x(x2)
                  .on("brush", brushed);

    // Area 1 generator
    var area = d3.svg.area()
        .interpolate("step-after")
        .x(function(d) { return x(d.time); })
        .y0(height)
        .y1(function(d) { return y(d.value.length); });
    
    // Area 2 generator
    var area2 = d3.svg.area()
        .interpolate("step-after")
        .x(function(d) { return x2(d.time); })
        .y0(height2)
        .y1(function(d) { return y2(d.value.length); });

    // Contour line generator
    var line = d3.svg.line()
        .interpolate("step-after")
        .x(function(d) { return x(d.time); })
        .y(function(d) { return y(d.value.length); });

    // Svg element to draw the fragment utilization graph 
    var svg = element.append("svg")
                     .attr("width", width + margin.left + margin.right)
                     .attr("height", height + margin.top + margin.bottom)
                     .attr("id", "fragment_utilization");   
    
    svg.append("defs").append("clipPath")
       .attr("id", "clip")
      .append("rect")
       .attr("width", width)
       .attr("height", height);

    // Place the graph
    var graph = svg.append("g")
        .attr("class", "graph")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Place the mini-brush
    var mini_brush = svg.append("g")
        .attr("class", "context")
        .attr("transform", "translate(" + margin2.left + "," + margin2.top + ")");

    var url = "/histogram?fragmentId=" + fragmentId + "&queryId=" + queryId;

    d3.csv(url, type, function(error, data) {
        x.domain(d3.extent(data.map(function(d) { return d.time; })));
        y.domain([0, d3.max(data.map(function(d) { return d.value.length; }))]);
        x2.domain(x.domain());
        y2.domain(y.domain());

        graph.append("path")
             .attr("clip-path", "url(#clip)")
             .datum(data)
             .attr("class", "area")
             .attr("d", area);

        graph.append("path")
             .attr("clip-path", "url(#clip)")
             .datum(data)
             .attr("class", "line")
             .attr("d", line);

        graph.append("g")
             .attr("class", "x axis")
             .attr("transform", "translate(0," + height + ")")
             .call(xAxis);

        graph.append("g")
             .attr("class", "y axis")
             .call(yAxis);

        mini_brush.append("path")
               .attr("clip-path", "url(#clip)")
               .datum(data)
               .attr("class", "area")
               .attr("d", area2);

        mini_brush.append("g")
               .attr("class", "x axis")
               .attr("transform", "translate(0," + height2 + ")")
               .call(xAxis2);

        mini_brush.append("g")
               .attr("class", "x brush")
               .call(brush)
               .selectAll("rect")
               .attr("y", -6)
               .attr("height", height2 + 7);
    });

    function brushed() {
        x.domain(brush.empty() ? x2.domain() : brush.extent());
        graph.select(".area").attr("d", area);
        graph.select(".graph path.line").attr("d", line);
        graph.select(".x.axis").call(xAxis);
    }

    function type(d) {
        d.time = parseFloat(d.time, 10);
        d.value = JSON.parse( d.value);
        return d;
    }

    
  
    var hostname = "vega.cs.washington.edu";
    var port = "8777";

    url = "http://" + hostname + ":" + port +
          "/logs/profiling?fragmentId=" + fragmentId +
          "&queryId=" + queryId;

    d3.csv(url, type2, function(error, data) {
        get_states_per_worker(data);
 
    });

    function type2(d) {
        d.workerId = +d.workerId;
        d.nanoTime = parseFloat(d.nanoTime); 
        d.numTuples = +d.numTuples;
        return d;
    }

    function get_states_per_worker(data) {
	// TODO: this parsing function assumes the following about the data
	// received:
        //   - beginning times are sorted at each worker

        // Create a structure:
        //  workers = [{ workerId : [{opName : [{}]}] }]
        //
        //

        var worker_states = {};

      

        data.forEach(function(d) {
            console.debug(d);
        });
    }
};

/*
function drawLanes(element, workers) {

    var fullHeight = element.attr('data-height') || workers.length*50;

    var margin = {top: 10, right: 10, bottom: 10, left: 10},
        width = parseInt(element.style('width'), 10) - margin.left - margin.right,
        height = fullHeight - margin.top - margin.bottom;

    var x = d3.scale.linear().range([0, width]),
        y = d3.scale.ordinal().rangeRoundBounds([height, 0], 0.2, 0.1);

    var xAxis = d3.svg.axis()
                  .scale(x)
                  .tickFormat(customTimeFormat)
                  .tickSize(-height)
                  .orient("bottom");

    var yAxis = d3.svg.axis()
                  .scale(y)
                  .orient("left");

    // Remove what was previously drawn
    d3.select("#fragment_workers").remove();   

    // Add lanes chart
    var svg = element.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .attr("id", "fragment_workers");
      //.append("g")
      //  .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Place the lanes graph
    var lanes_graph = svg.append("g")
           .attr("class", "graph")
           .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var lanes = chart.append("g")
        .attr("class", "lanes");
 
    

    drawBoxes(lanes, []);
};


function drawBoxes(lanes) {

    var box = lanes.selectAll("rect")
            .data(visibleStates, function(d) { return d.id; });

        box.enter().append("rect")
            .popover(function(d) {
                if (d.end === null)
                    d.end = data.end;
                var duration = d.end - d.begin;
                var content = boxTemplate({duration: customFullTimeFormat(duration), begin: customFullTimeFormat(d.begin), end: customFullTimeFormat(d.end)})
                if ('tp_num' in d) {
                    content += numTuplesTemplate({number: d.tp_num});
                }
                return {
                    title: stateNames[d.name],
                    content: content
                };
            })
            .attr("clip-path", "url(#clip)")
            .style("fill", function(d) { return stateColors[d.name]; })
            .style("stroke", function(d) { return d3.rgb(stateColors[d.name]).darker(0.5); })
            .attr("class", "box");

        box
            .attr("x", function(d) {
                return x(d.begin);
            })
            .attr("width", function(d, i) {
                if (d.end) {
                   return x(d.end) - x(d.begin);
                } else {
                    return x(data.end) - x(d.begin);
                }
            })
            .transition()
            .duration(animationDuration)
            .attr("y", function(d) {
                return y(d.lane);
            })
            .attr("height", function(d) {
                return y.rangeBand();
            });

}
*/

