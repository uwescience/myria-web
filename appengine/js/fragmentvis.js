var fragmentVisualization = function (element, fragmentId, queryPlan) {
    $('#title-right-vis').html(templates.titleFragmentsVis({fragment: fragmentId}))

    element.selectAll("svg").remove();
    drawCharts(element, fragmentId, queryPlan);

    // return variables that are needed outside this scope
    return {};
}

function drawCharts(element, fragmentId, queryPlan) {
    var lanesChart = drawLanes(element, fragmentId, queryPlan.queryId);
    drawArea(element, fragmentId, queryPlan.queryId, lanesChart);
}

// Draw the area plot and the mini-brush and big-brush for it
function drawArea(element, fragmentId, queryId, lanesChart) {

    var margin = {top: 50, right: 10, bottom: 20, left:20 },
        margin2 = {top: 10, right:10, bottom: 170, left:20},
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
 
    var brush2 = d3.svg.brush()
                      .x(x)
                      .on("brushend", brushend_workers);

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

    // Svg element to draw the fragment utilization plot
    //var svg = element.append("svg")
    var svg = element.insert("svg", ":first-child")
                     .attr("width", width + margin.left + margin.right)
                     .attr("height", height + margin.top + margin.bottom)
                     .attr("class", "line-plot")
                     .attr("id", "fragment_utilization");

    svg.append("defs").append("clipPath")
       .attr("id", "clip")
      .append("rect")
       .attr("width", width)
       .attr("height", height);

    // Place the mini-brush
    var mini_brush = svg.append("g")
        .attr("class", "context")
        .attr("transform", "translate(" + margin2.left + "," + margin2.top + ")");

    // Place the plot/big_brush
    var plot = svg.append("g")
        .attr("class", "plot")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    
    // Add ruler
    var tooltip = plot.append("g")
        .attr({"class": "rulerInfo"})
        .attr("transform", "translate(" + [0, height] + ")");

    tooltip.append("svg:rect");

    var tttext = tooltip.append("svg:text")
        .attr("text-anchor", "left");

    plot.on("mousemove", function (e) {
        ruler
            .style("display", "block")
            .style("left", d3.event.pageX - 1 + "px");

        plot
            .select(".rulerInfo")
            .style("opacity", 1)
            .attr("transform", "translate(" + [d3.mouse(this)[0] + 6, height + 14] + ")");

        var xValue = Math.round(x.invert(d3.mouse(this)[0]));
        tttext.text(templates.ruler.ganttTooltipTemplate({ time: customFullTimeFormat(xValue) }));

        var bbox = tttext.node().getBBox();
        tooltip.select("rect")
            .attr("width", bbox.width + 10)
            .attr("height", bbox.height + 6)
            .attr("x", bbox.x - 5)
            .attr("y", bbox.y - 3);
    });

    plot.on("mouseleave", function (e) {
        ruler.style("display", "none");
        plot
            .select(".rulerInfo")
            .style("opacity", 0);
    });

    var url = templates.urls.histogram({
        query: queryId,
        fragment: fragmentId
    });

    d3.csv(url, type, function(error, data) {
        x.domain(d3.extent(data.map(function(d) { return d.time; })));
        y.domain([0, d3.max(data.map(function(d) { return d.value.length; }))]);
        x2.domain(x.domain());
        y2.domain(y.domain());

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

        plot.append("path")
             .attr("clip-path", "url(#clip)")
             .datum(data)
             .attr("class", "area")
             .attr("d", area);

        plot.append("path")
             .attr("clip-path", "url(#clip)")
             .datum(data)
             .attr("class", "line")
             .attr("d", line);

        plot.append("g")
             .attr("class", "x axis")
             .attr("transform", "translate(0," + height + ")")
             .call(xAxis);

        plot.append("g")
             .attr("class", "y axis")
             .call(yAxis);

        plot.append("g")
               .attr("class", "x brush")
               .call(brush2)
               .selectAll("rect")
               .attr("y", -6)
               .attr("height", height + 7);
    });

    function brushed() {
        x.domain(brush.empty() ? x2.domain() : brush.extent());
        plot.select(".area").attr("d", area);
        plot.select(".plot path.line").attr("d", line);
        plot.select(".x.axis").call(xAxis);
    }

    function brushend_workers() {
        //called brush; modify the lanes Chart ...
        //compute the visible workers

        lanesChart.redrawLanes(element,
                               lanesChart.workers_data,
                               lanesChart.x,
                               lanesChart.y,
                               lanesChart.xAxis,
                               lanesChart.yAxis,
                               brush2.extent());

        x.domain(brush2.empty() ? x2.domain() : brush2.extent());
        plot.select(".area").attr("d", area);
        plot.select(".plot path.line").attr("d", line);
        plot.select(".x.axis").call(xAxis);

        brush.extent(brush2.extent());
        d3.select(".context .x.brush").call(brush);
        d3.select(".plot .x.brush").call(brush2.clear());
    }

    function type(d) {
        d.time = parseFloat(d.time, 10);
        d.value = JSON.parse( d.value);
        return d;
    }
}

function drawLanes(element, fragmentId, queryId) {

    //var fullHeight =  _.keys(workers_data).length * 50;
    var fullHeight = 400;

    var margin = {top: 10, right: 10, bottom: 20, left: 20},
        width = parseInt(element.style('width'), 10) - margin.left - margin.right,
        height = fullHeight - margin.top - margin.bottom;
    var x = d3.scale.linear().clamp(true).range([0, width]),
        y = d3.scale.ordinal().rangeRoundBands([height, 0], 0.2, 0.1);

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
    
    var chart = svg.append("g")
        .attr("class", "plot")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Place the lanes plot
    var lanes = chart.append("g")
        .attr("class", "lanes")
        //.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Place the xAxis
    lanes.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis);


    /* Collect data for states at each worker */
    var url = templates.urls.profiling({
        myria: myriaConnection,
        query: queryId,
        fragment: fragmentId
    });

    var workers_data={};

    d3.csv(url, type2, function(error, data) {
        // copy the results into the workers_data
        // don't allocate another object as we return the
        // reference to this one
        var t_workers_data = get_workers_states(data);
        for (k in t_workers_data) {
             workers_data[k] = t_workers_data[k];
        }
        //redrawLanes(element, workers_data, x, y, xAxis, yAxis, [0,0]);
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
            } else if (d.eventType === "return") {
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
               } //TODO: eos??
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

    var redrawLanes = function (element, workers_data, x, y, xAxis, yAxis, x_domain) {

        // Remove what was previously drawn
        // d3.select("#fragment_workers").remove();
        y.domain(_.keys(workers_data));
        x.domain(x_domain);

        var lanes = d3.select("#fragment_workers .plot .lanes");

        for (worker in workers_data) {
            drawBoxes(lanes, workers_data[worker], worker, x, y);
        }

        lanes.select("g.x.axis").call(xAxis);
    }

    return {
                "workers_data" : workers_data,
                "redrawLanes" : redrawLanes,
                "x" : x,
                "y" : y,
                "xAxis" : xAxis,
                "yAxis" : yAxis
           }
}

function colorForOperator(opname) {
    return opToColor[opname];
}

function drawBoxes(lanes, worker_data, lane, x, y) {

    var box = lanes.selectAll("rect")
                   //TODO: is the key map function lane + d.begin  unique??
                   .data(worker_data, function(d) {return lane + d.begin;});

    box.enter().append("rect")
        .popover(function(d) {
            //if (d.end === null)
            //d.end = data.end;
            var duration = d.end - d.begin;
            var content = templates.ruler
                             .boxTemplate({duration: customFullTimeFormat(duration),
                                           begin: customFullTimeFormat(d.begin),
                                           end: customFullTimeFormat(d.end)})
                //if ('tp_num' in d) {
                //    content += numTuplesTemplate({number: d.tp_num});
                //}
                return {
                    title: d.name,
                    content: content
                };
            })
        //.attr("clip-path", "url(#clip)")
        .style("fill", function(d) { return colorForOperator(d.name); })
        .style("stroke", function(d) { return d3.rgb(colorForOperator(d.name)).darker(0.5); })
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

