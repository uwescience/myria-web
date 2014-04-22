var fragmentVisualization = function (element, fragmentId, queryPlan) {
    $('.title-current').html(templates.titleFragmentsVis({fragment: fragmentId}));

    $(element.node()).empty();

    var idNameMapping = {};

    _.each(queryPlan.physicalPlan.fragments, function(frag) {
        _.each(frag.operators, function(op) {
            var hasName = _.has(op, 'opName') && op.opName;
            idNameMapping[op.opId] = hasName ? op.opName.replace("Myria", "") : op.opId;
        });
    });

    var workers = queryPlan.physicalPlan.fragments[fragmentId].workers;
    var numWorkers = _.max(workers);

    var lanesChart = drawLanes(element, fragmentId, queryPlan.queryId, numWorkers, idNameMapping);
    drawLineChart(element, fragmentId, queryPlan.queryId, lanesChart);

    // return variables that are needed outside this scope
    return {};
};

// Draw the area plot and the mini-brush and big-brush for it
function drawLineChart(element, fragmentId, queryId, lanesChart) {

    var margin = {top: 50, right: 10, bottom: 20, left:20 },
        labels_width = 20,
        margin2 = {top: 10, right:10, bottom: 170, left:20},
        width = parseInt(element.style('width'), 10) - margin.left - margin.right,
        height = 200 - margin.top - margin.bottom,
        height2 = 200 - margin2.top - margin2.bottom;

    var bisectTime = d3.bisector(function(d) { return d.time; }).right;

    width = width - labels_width;

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
        .on("brush", brushed)
        .on("brushend", brushEnd);

    var brush2 = d3.svg.brush()
        .x(x)
        .on("brushend", brushendWorkers);

    // Area 1 generator
    var area = d3.svg.area()
        .interpolate("step-after")
        .x(function(d) { return x(d.time); })
        .y0(height)
        .y1(function(d) { return y(d.value); });

    // Area 2 generator
    var area2 = d3.svg.area()
        .interpolate("step-after")
        .x(function(d) { return x2(d.time); })
        .y0(height2)
    .y1(function(d) { return y2(d.value); });

    // Svg element to draw the fragment utilization plot
    //var svg = element.append("svg")
    var svg = element.insert("svg", ":first-child")
                     .attr("width", width + labels_width + margin.left + margin.right)
                     .attr("height", height + margin.top + margin.bottom)
                     .attr("class", "line-plot")
                     .attr("id", "fragment_utilization");

    //Add the Workers y axis label
    svg.append("text")
        .attr("class", "axis-label")
        .attr("dy", ".71em")
        .attr("transform", "translate(" + [0, height/2] + ") rotate(-90)")
        .style("text-anchor", "end")
        .text("Number of workers");

    svg.append("defs").append("clipPath")
        .attr("id", "clip")
        .append("rect")
        .attr("width", width)
        .attr("height", height);

    // Place the mini-brush
    var mini_brush = svg.append("g")
        .attr("class", "context")
        .attr("transform", "translate(" + (labels_width + margin2.left) + "," + margin2.top + ")");

    mini_brush.append("g")
        .attr("class", "x axis")
    .attr("transform", "translate(0," + height2 + ")");

    mini_brush.append("path")
        .attr("clip-path", "url(#clip)")
        .attr("class", "area");

    mini_brush.append("g")
        .attr("class", "x brush")
        .call(brush)
        .selectAll("rect")
        .attr("y", -6)
        .attr("height", height2 + 7);

    // Place the plot/big_brush
    var plot = svg.append("g")
        .attr("class", "plot")
        .attr("transform", "translate(" + (labels_width + margin.left) + "," + margin.top + ")");

    plot.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")");

    plot.append("g")
        .attr("class", "y axis");

    plot.append("path")
        .attr("clip-path", "url(#clip)")
        .attr("class", "area");

    // put time label on xAxis
    plot.append("g")
        .attr("transform", "translate(" + [width, height] + ")")
        .append("text")
        .call(xAxisLabel, width);

    plot.append("g")
        .attr("class", "x brush")
        .call(brush2)
        .selectAll("rect")
        .attr("y", -6)
        .attr("height", height + 7);

    // Add zoom buttons
    var zoomOut = plot.append("g")
        .attr("transform", "translate(" + [10, 5] + ")")
        .attr("class", "zoom-button")
        .tooltip("zoom out")
        .on("click", function() {
            d3.event.stopPropagation();
            var extent = x.domain();
            if (!brush.empty()) {
                extent = brush.extent();
            }
            var lower = extent[0],
                upper = extent[1],
                range = upper - lower,
                dom = x2.domain(),
                rangepart = range/5;
            extent = [_.max([lower - rangepart, dom[0]]), _.min([upper + rangepart, dom[1]])];
            if (extent[0] == dom[0] && extent[1] == dom[1]) {
                brush2.clear();
                brushendWorkers();
            } else {
                brush2.extent(extent);
                brushendWorkers();
            }
        });

    zoomOut.append("rect")
        .attr("width", 16)
        .attr("height", 16);
    zoomOut.append("text")
        .attr("fill", "white")
        .attr("x", 16/2)
        .attr("y", 16/2)
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "middle")
        .text("-");

    // Add ruler
    var tooltip = plot.append("g")
        .attr({"class": "rulerInfo"})
        .attr("transform", "translate(0,"+ height + ")");

    tooltip.append("svg:rect");

    var tttext = tooltip.append("svg:text")
        .attr("text-anchor", "left");

    plot.on("mouseleave", function (e) {
        ruler.style("display", "none");
        plot
            .select(".rulerInfo")
            .style("opacity", 0);
    });

    var url = templates.urls.histogram({
        myria: myriaConnection,
        query: queryId,
        fragment: fragmentId
    });

    d3.csv(url, function(d) {
        d.time = +d.time;
        d.value = +d.numWorkers;
        delete d.numWorkers;
        return d;
    }, function(error, data) {
        x.domain(d3.extent(data, function(d) { return d.time; }));
        y.domain([0, d3.max(data, function(d) { return d.value; })]);

        x2.domain(x.domain());
        y2.domain(y.domain());

        plot.on("mousemove", function (e) {
            ruler
                .style("display", "block")
                .style("left", d3.event.pageX - 1 + "px");

            var xPixels = d3.mouse(this)[0],
                xValue = Math.round(x.invert(xPixels));

            var i = bisectTime(data, xValue),
                d0 = data[i - 1];

            if (d0 === undefined) {
                return;
            }

            plot
                .select(".rulerInfo")
                .style("opacity", 1)
                .attr("transform", "translate(" + [d3.mouse(this)[0] + 6, height + 14] + ")");

            tttext.text(templates.chartTooltipTemplate({time: customFullTimeFormat(xValue), number: d0.numWorkers}));

            var bbox = tttext.node().getBBox();
            tooltip.select("rect")
                .attr("width", bbox.width + 10)
                .attr("height", bbox.height + 6)
                .attr("x", bbox.x - 5)
                .attr("y", bbox.y - 3);
        });

        // TODO: do before we have the data
        mini_brush.select(".x.axis").call(xAxis2);
        mini_brush.select(".area")
            .datum(data)
            .attr("d", area2);

        plot.select(".x.axis").call(xAxis);
        plot.select(".y.axis").call(yAxis);
        plot.select(".area")
            .datum(data)
            .attr("d", area);
    });

    function brushed() {
        x.domain(brush.empty() ? x2.domain() : brush.extent());
        plot.select(".area").attr("d", area);
        plot.select(".x.axis").call(xAxis);
    }

    function brushEnd() {
        lanesChart.redrawLanes(brush.extent());
    }

    function brushendWorkers() {
        //called brush; modify the lanes Chart ...
        //compute the visible workers
        var brush_extent = brush2.extent();

        lanesChart.redrawLanes(brush2.extent());

        x.domain(brush2.empty() ? x2.domain() : brush_extent);
        plot.select(".area")
            .transition()
            .duration(animationDuration)
            .attr("d", area);
        plot.select(".x.axis")
            .transition()
            .duration(animationDuration)
            .call(xAxis);

        brush.extent(brush_extent);
        d3.select(".context .x.brush")
            .transition()
            .duration(animationDuration)
            .call(brush);
        d3.select(".plot .x.brush")
            .call(brush2.clear());
    }
}

function drawLanes(element, fragmentId, queryId, numWorkers, idNameMapping) {
    var margin = {top: 10, right: 10, bottom: 20, left: 20},
        labels_width = 20,
        fullWidth = parseInt(element.style('width'), 10) - margin.left - margin.right,
        width = fullWidth - labels_width;

    var height =  numWorkers * 30;

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
        .attr("width", width + labels_width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .attr("id", "fragment_workers");

    var lanes_titles = svg.append("g")
        .attr("class", "titles")
        .attr("transform", "translate(" + labels_width + "," + margin.top + ")");

     //Add the Workers y axis label
     svg.append("text")
         .attr("class", "axis-label")
         .attr("transform", "translate(" + [0, height/2] + ") rotate(-90)")
         .attr("class", "axis-label")
         .attr("dy", ".71em")
         .style("text-anchor", "end")
         .style("visibility", "hidden")
         .text("Worker");

    var chart = svg.append("g")
        .attr("class", "plot")
        .attr("transform", "translate(" + (labels_width + margin.left) + "," + margin.top + ")");

    chart.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("class", "background");

    // Place the xAxis
    chart.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis);

    // Place the lanes plot
    var lanes = chart.append("g")
        .attr("class", "lanes");
        //.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Place the Time label
    chart.append("g")
        .attr("transform", "translate(" + [width, height] + ")")
        .append("text")
        .call(xAxisLabel);

    /* Collect data for states at each worker */
    var url = templates.urls.profiling({
        myria: myriaConnection,
        query: queryId,
        fragment: fragmentId
    });

    var workersData = {};

    d3.csv(url, function(d) {
        d.workerId = +d.workerId;
        d.nanoTime = parseFloat(d.nanoTime);
        d.numTuples = +d.numTuples;
        return d;
    }, function(error, data) {
        workersData = getWorkersStates(data);
    });

    // Add ruler
    var tooltip = chart.append("g")
        .attr({"class": "rulerInfo"})
        .attr("transform", "translate(0,"+ height + ")");

    tooltip.append("svg:rect");

    var tttext = tooltip.append("svg:text")
        .attr("text-anchor", "left");

    chart.on("mouseleave", function (e) {
        ruler.style("display", "none");
        chart
            .select(".rulerInfo")
            .style("opacity", 0);
    });

    chart.on("mousemove", function (e) {
        ruler
            .style("display", "block")
            .style("left", d3.event.pageX - 1 + "px");

        chart
            .select(".rulerInfo")
            .style("opacity", 1)
            .attr("transform", "translate(" + [d3.mouse(this)[0] + 6, height + 14] + ")");

        var xValue = Math.round(x.invert(d3.mouse(this)[0]));
        tttext.text(templates.ganttTooltipTemplate({time: customFullTimeFormat(xValue)}));

        var bbox = tttext.node().getBBox();
        tooltip.select("rect")
            .attr("width", bbox.width + 10)
            .attr("height", bbox.height + 6)
            .attr("x", bbox.x - 5)
            .attr("y", bbox.y - 3);
    });

    var toDelete = chart.append("text")
            .text("Select a small range in the chart above to see the operators.")
            .attr("x", width/2)
            .attr("y", _.min([100, height/2]))
            .attr("text-anchor", "middle")
            .attr("class", "help-text");

    function redrawLanes(xDomain) {
        var data = _.values(workersData);

        toDelete.remove();

        y.domain(_.pluck(data, 'workerId'));
        x.domain(xDomain);

        var lane = lanes.selectAll(".worker").data(data, function(d) { return d.workerId; });
        lane.enter().append("g").attr("class", "worker");
        lane.attr("transform", function(d) { return "translate(0," +  y(d.workerId) + ")"; });
        lane.exit().remove();

        var box = lane.selectAll("rect")
            .data(function(d) {
                return _.filter(d.states, function(s) {
                    // overlap
                    return xDomain[0] < s.end && xDomain[1] > s.begin;
                });
            }, function(d) { return d.begin; });

        box.enter().append("rect")
            //.attr("clip-path", "url(#clip)")
            .style("fill", function(d) { return opToColor[d.name]; })
            .attr("class", "box");

        box.on('mouseenter', function(d){
            d3.select(this).tooltip(function(d) {
                var content = templates.opname({ name: idNameMapping[d.name] });
                if (_.has(d, 'numTuples')) {
                    if (d.numTuples >= 0) {
                        content += templates.numTuplesTemplate({ numTuples: d.numTuples });
                    } else {
                        content += templates.nullReturned();
                    }
                    content += ', ';
                }
                content += templates.duration({ duration: customFullTimeFormat(d.end - d.begin) });
                return content;
            });
        });

        box
            .transition()
            .duration(animationDuration)
            .attr("x", function(d) { return x(d.begin); })
            .style("opacity", 1)
            .attr("width", function(d) {
                return x(d.end) - x(d.begin);
            })
            .attr("height", function(d) { return y.rangeBand(); });

        box.exit().remove();

        chart.select(".x.axis")
            .transition()
            .duration(animationDuration)
            .call(xAxis);

        // Add lanes titles
        var title = lanes_titles.selectAll("g.title")
            .data(data, function(d) { return d.workerId; });

        var titleEnter = title.enter()
            .append("g")
            .style("opacity", 0)
            .attr("transform", function(d) {
                return "translate(0," + (y(d.workerId) + y.rangeBand()/2) + ")";
            })
            .style("text-anchor", "begin")
            .attr("class", "title");

        titleEnter.append("text")
            .attr("dx", -18)
            .attr("font-family", "Glyphicons Halflings")
            .attr("font-size", "16px")
            .attr("width", 20)
            .attr("height", 20)
            .attr("dy", 8)
            .attr("class", "icon")
            .style("cursor", "pointer");

        var titleTextEnter = title.append("g")
           .attr("class", "title-text");

        titleTextEnter.append("text")
            .attr("class", "title");

        titleTextEnter.append("text")
            .attr("dy", "1.2em")
            .attr("class", "subtitle");

        title
            .transition()
            .duration(animationDuration)
            .style("opacity", 1)
            .attr("transform", function(d) {
                 return "translate(0," + (y(d.workerId) + y.rangeBand()/2) + ")";
            });

        title.select("text.title")
            .text(function(d) {
                return d.workerId;
            })
            .attr("class", "title");

        //title.select("text.subtitle")
        //    .text(function(d) { return  d.states[0].name; })
        //    .attr("class", "subtitle");

        title.exit()
            .transition()
            .duration(animationDuration).style("opacity", 0)
            .remove();

        svg.select(".axis-label").style("visibility", "visible");
    }

    return {
        redrawLanes: redrawLanes
    };
}

function xAxisLabel(selection) {
    selection.attr("class", "axis-label")
        .attr({"x": - 6, "y": -12, "text-anchor": "middle"})
        .attr("dy", ".71em")
        .style("text-anchor", "end")
        .text("Time");
}

function getWorkersStates(data) {
    // TODO: this parsing function assumes the following about the data
    // received:
    //   - events are sorted at each worker

    // Create a structure:
    //  workers = [{ workerId : [{opName : [{}]}] }]
    //
    // TODO: use queryPlan to put the right lane numbers?

    var workersStates = {};
    var tmpStacks = {}; // a stack per worker keeps unfinished operator calls


    data.forEach(function(d) {
        stack = tmpStacks[d.workerId];
        if (stack === undefined || stack.length === 0) {
            tmpStacks[d.workerId] = [get_state(d)];
            return;
        }

        // event on top of stack completed (we now know its endTime), add
        // to states

        if (!_.has(workersStates, d.workerId)) {
            workersStates[d.workerId] = {
                workerId: d.workerId,
                states: []
            };
        }

        top_stack = _.last(stack);
        top_stack.end = d.nanoTime;
        if (d.eventType === "return") {
            top_stack.numTuples = d.numTuples;
        }
        workersStates[d.workerId].states.push(top_stack);

        // check the event type and push unfinished event on the stack
        if (d.eventType === "call") {
            stack.push(get_state(d));
        } else if (d.eventType === "return") {
            // it's a return, update the link and replace top of stack
            // with a new, same opName event that starts from d.nanoTime
            stack.pop();
            if (stack.length > 0) {
                top_stack = _.last(stack);
                state = get_state(d);
                state.name = top_stack.name; // the same call
                //TODO: use links
                //top_stack.link = state; // belong together (still in the same call thread)
                stack[stack.length - 1] = state;
           } //TODO: eos??
        }
    });

    function get_state(d) {
        return {
            name: d.opName,
            begin: d.nanoTime,
            end: null           // we don't know this yet ...
        };
    }

    return workersStates;
}
