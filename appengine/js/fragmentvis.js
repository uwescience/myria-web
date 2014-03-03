var fragmentVisualization = function (element, fragmentId, queryPlan) {
    // do all the chart stuff
    debug("I should build the gantt chart now");
    
    drawCharts(element, fragmentId, queryPlan);

    // return variables that are needed outside this scope
    return {};
}

function drawCharts(element, fragmentId, queryPlan) {
    drawArea(element, fragmentId, queryPlan.queryId);
    drawLanes(element, fragmentId, queryPlan.queryId);
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

}

function drawLanes(element, fragmentId, queryId) {

    /* Collect data for states at each worker */ 
    var hostname = "vega.cs.washington.edu";
    var port = "8777";

    url = "http://" + hostname + ":" + port +
          "/logs/profiling?fragmentId=" + fragmentId +
          "&queryId=" + queryId;

    d3.csv(url, type2, function(error, data) {
        var workers_data = get_workers_states(data);
        redrawLanes(element, workers_data); 
    });

    function type2(d) {
        d.workerId = +d.workerId;
        d.nanoTime = parseFloat(d.nanoTime); 
        d.numTuples = +d.numTuples;
        return d;
    }
    
    function get_workers_states(data) {
	// TODO: this parsing function assumes the following about the data
	// received:
        //   - events are sorted at each worker

        // Create a structure:
        //  workers = [{ workerId : [{opName : [{}]}] }]
        //
        // TODO: use queryPlan to put the right lane numbers?

        var workers_states = {};
        var tmp_stacks = {}; // a stack per worker keeps unfinished operator calls

        data.forEach(function(d) {
            stack = tmp_stacks[d.workerId];
            if (stack == null || stack.length === 0) {
                tmp_stacks[d.workerId] = [];
                tmp_stacks[d.workerId].push(get_state(d));
                return;
            }

	    // event on top of stack completed (we now know its endTime), add
	    // to states
	    states = workers_states[d.workerId];
            if (states == null) {
                states = [];
                workers_states[d.workerId] = states; 
            }

            top_stack = stack[stack.length - 1];
            top_stack.end = d.nanoTime; 
            states.push(top_stack);
            
            // check the event type and push unfinished event on the stack
            if (d.eventType === "call") {
                stack.push(get_state(d));
            } else {
                // it's a return, update the link and replace top of stack
                // with a new, same opName event that starts from d.nanoTime
                stack.pop();
                if (stack.length > 0) {
                    top_stack = stack[stack.length - 1];
                    state = get_state(d);
                    state.name = top_stack.name; // the same call 
                    top_stack.link = state; // belong together (still in the same call thread)
                    stack.pop();
                    stack.push(state);
               }
            }
        });

        function get_state(d) {
            return {
                      "link" : null,           // if it belongs together with some previous event
                      "name" : d.opName,
                      "begin": d.nanoTime,
                      "end"  : null,           // we don't know this yet ...
                      "lane" : 0
                   };
        }

        return workers_states;
    }
}

function redrawLanes(element, workers_data) {
    // Remove what was previously drawn
    d3.select("#fragment_workers").remove();   

    var fullHeight =  Object.keys(workers_data).length * 50;
 
    var margin = {top: 10, right: 10, bottom: 10, left: 20},
        width = parseInt(element.style('width'), 10) - margin.left - margin.right,
        height = fullHeight - margin.top - margin.bottom;

    var x = d3.scale.linear().range([0, width]),
        y = d3.scale.ordinal().rangeRoundBands([height, 0], 0.2, 0.1);
   
    y.domain(_.keys(workers_data));
   
    // TODO: fix this!
    x.domain([769116, 5615629916]); 

    var xAxis = d3.svg.axis()
                  .scale(x)
                  .tickFormat(customTimeFormat)
                  .tickSize(-height)
                  .orient("bottom");

    var yAxis = d3.svg.axis()
                  .scale(y)
                  .orient("left");

    // Add lanes chart
    var svg = element.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .attr("id", "fragment_workers");
      //.append("g")
      //  .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Place the lanes graph
    var lanes = svg.append("g")
           .attr("class", "graph")
           .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
   
    // Place the xAxis 
    lanes.append("g")
             .attr("class", "x axis")
             .attr("transform", "translate(0," + height + ")")
             .call(xAxis);

    for (worker in workers_data) {
        drawBoxes(lanes, workers_data[worker], worker, x, y);
    }
}

function drawBoxes(lanes, worker_data, lane, x, y) {
    var color = d3.scale.category20();

    var box = lanes.selectAll("rect")
                   //TODO: is the key map function lane + d.begin  unique??        
                   .data(worker_data, function(d) {return lane + d.begin;});

    box.enter().append("rect")
            //.attr("clip-path", "url(#clip)")
            .style("fill", function(d) { return color(Math.abs(hashCode(d.name)%20)); })
            .style("stroke", function(d) { return d3.rgb(color(Math.abs(hashCode(d.name)))).darker(0.5); })
            .attr("class", "box");

    box.attr("x", function(d) { return x(d.begin);})
       .attr("width", function(d, i) {
               return x(d.end) - x(d.begin);
           })
       .transition()
       //.duration(animationDuration)
       .attr("y", function(d) { return y(lane);})
       .attr("height", function(d) {
                return y.rangeBand();
          });


    // TODO: replace this function
    function hashCode(str) {
        var hash = 0;
        if (str.length == 0) return hash;
        for (i = 0; i < str.length; i++) {
            char = str.charCodeAt(i);
            hash = ((hash<<5)-hash)+char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
    }
}

