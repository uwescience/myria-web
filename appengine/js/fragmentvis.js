var fragmentVisualization = function (element, fragmentId, graph) {
    $('.title-current').html(templates.titleFragmentsVis({fragment: fragmentId}));

    $(element.node()).empty();
    $(element.node()).append(templates.fragmentVisFrames);

    var idNameMapping = nameMappingFromFragments(graph.fragments);

    var hierarchy = graph.nested["f"+fragmentId],
        levels = {};
    function addLevels(node, level) {
        levels[node.id] = level++;
        _.map(node.children, function(n) {
            addLevels(n, level);
        });
    }
    addLevels(hierarchy, 0);

    var workers = graph.fragments[fragmentId].workers;
    var numWorkers = workers.length;

    var opVis = operatorVisualization(element.select(".contrib"), fragmentId, graph);

    var lanesChart = drawLanes(element.select(".details"), fragmentId, graph, numWorkers, idNameMapping, levels);
    drawLineChart(element.select(".details"), fragmentId, graph, numWorkers, lanesChart);

    // return variables that are needed outside this scope
    return {};
};

// Draw the area plot and the mini-brush and big-brush for it
function drawLineChart(element, fragmentId, graph, numWorkers, lanesChart) {

    var margin = {top: 50, right: 10, bottom: 20, left:20 },
        labels_width = 20,
        margin2 = {top: 10, right:10, bottom: 170, left:20},
        width = parseInt(element.style('width'), 10) - margin.left - margin.right,
        height = 200 - margin.top - margin.bottom,
        height2 = 200 - margin2.top - margin2.bottom;

    var bisectTime = d3.bisector(function(d) { return d.nanoTime; }).right;

    width = width - labels_width;

    var x = d3.scale.linear().range([0, width]),
        x2 = d3.scale.linear().range([0, width]),
        y = d3.scale.linear().range([height, 0]),
        y2 = d3.scale.linear().range([height2, 0]);

    var xAxis = d3.svg.axis()
        .scale(x)
        .tickFormat(customFullTimeFormat)
        .tickSize(-height)
        .orient("bottom");

    var xAxis2 = d3.svg.axis()
        .scale(x2)
        .tickFormat(customFullTimeFormat)
        .tickSize(-height2)
        .orient("bottom");

    var yAxis = d3.svg.axis()
        .scale(y)
        .ticks(_.min([numWorkers, 10]))
        .tickFormat(d3.format("d"))
        .tickSubdivide(0)
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
        .interpolate("montone")
        .x(function(d) { return x(d.nanoTime); })
        .y0(height)
        .y1(function(d) { return y(d.numWorkers); });

    // Area 2 generator
    var area2 = d3.svg.area()
        .interpolate("montone")
        .x(function(d) { return x2(d.nanoTime); })
        .y0(height2)
    .y1(function(d) { return y2(d.numWorkers); });

    // Svg element to draw the fragment utilization plot
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
        .text("# of workers");

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
                rangepart = range/5;
            extent = [_.max([lower - rangepart, wholeRange[0]]), _.min([upper + rangepart, wholeRange[1]])];
            if (extent[0] == wholeRange[0] && extent[1] == wholeRange[1]) {
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

    // fetch histogram data and show it
    function fetchData(range, callback) {
        var start = range[0],
            end = range[1];
        var step = Math.floor((end - start)/width);

        var url = templates.urls.histogram({
            myria: myriaConnection,
            query: graph.queryStatus.queryId,
            subquery: graph.queryStatus.subqueryId,
            fragment: fragmentId,
            start: start,
            end: end,
            step: step,
            onlyRootOp: true
        });

        d3.csv(url, function(d) {
            d.nanoTime = +d.nanoTime;
            d.numWorkers = +d.numWorkers;
            return d;
        }, function(error, incompleteData) {
            var data = reconstructFullData(incompleteData, start, end, step, false);
            x.domain(range);
            y.domain([0, numWorkers]);

            plot.select(".x.axis").call(xAxis);
            plot.select(".area")
                .datum(data)
                .attr("d", area);

            plot.on("mousemove", function (e) {
                ruler
                    .style("display", "block")
                    .style("left", d3.event.pageX + "px");

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

            callback(data);
        });
    }

    var wholeRange;

    // initially fetch data and load minimap
    var url = templates.urls.range({
            myria: myriaConnection,
            query: graph.queryStatus.queryId,
            subquery: graph.queryStatus.subqueryId,
            fragment: fragmentId
        });
    d3.csv(url, function(d) {
        wholeRange = [+d[0].min_startTime, +d[0].max_endTime];
        fetchData(wholeRange, function(data) {
            x2.domain(wholeRange);
            y2.domain([0, numWorkers]);

            plot.select(".y.axis").call(yAxis);

            mini_brush.select(".x.axis").call(xAxis2);
            mini_brush.select(".area")
                .datum(data)
                .attr("d", area2);
        });
    });

    function brushed() {
        x.domain(brush.empty() ? wholeRange : brush.extent());
        plot.select(".area").attr("d", area);
        plot.select(".x.axis").call(xAxis);
    }

    function brushEnd() {
        var brush_extent = brush.empty() ? wholeRange : brush.extent();
        var range = [Math.floor(brush_extent[0]), Math.ceil(brush_extent[1])];

        fetchData(range, function() {});

        if (brush.empty()) {
            lanesChart.redrawLanes([], [0, 1]);
            lanesChart.toggleHelp(true);
        } else {
            lanesChart.fetchData(range);
            lanesChart.toggleHelp(false);
        }
    }

    function brushendWorkers() {
        var brush_extent = brush2.empty() ? wholeRange : brush2.extent();
        var range = [Math.floor(brush_extent[0]), Math.ceil(brush_extent[1])];

        if (brush2.empty()) {
            lanesChart.redrawLanes([], [0, 1]);
            lanesChart.toggleHelp(true);
        } else {
            lanesChart.fetchData(range);
            lanesChart.toggleHelp(false);
        }

        x.domain(brush_extent);

        // animate before loading new data
        plot.select(".area")
            .transition()
            .duration(animationDuration)
            .attr("d", area);
        plot.select(".x.axis")
            .transition()
            .duration(animationDuration)
            .call(xAxis)
            .each("end", function() {
                fetchData(range, function() {});
            });

        brush.extent(brush2.extent());
        d3.select(".context .x.brush")
            .transition()
            .duration(animationDuration)
            .call(brush);
        d3.select(".plot .x.brush")
            .call(brush2.clear());
    }
}

function drawLanes(element, fragmentId, graph, numWorkers, idNameMapping, levels) {
    var margin = {top: 10, right: 10, bottom: 20, left: 20},
        labels_width = 20,
        fullWidth = parseInt(element.style('width'), 10) - margin.left - margin.right,
        width = fullWidth - labels_width;

    var height =  numWorkers * 50;

    var x = d3.scale.linear().clamp(true).range([0, width]),
        y = d3.scale.ordinal().rangeRoundBands([height, 0], 0.2, 0.1);

    y.domain(_.range(1, numWorkers+1));

    var xAxis = d3.svg.axis()
        .scale(x)
        .tickFormat(customFullTimeFormat)
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

    var toDelete;

    function toggleHelp(show) {
        if (show) {
            toDelete = chart.append("text")
                .text("Select a small range in the chart above to see the operators.")
                .attr("x", width/2)
                .attr("y", _.min([100, height/2]))
                .attr("text-anchor", "middle")
                .attr("class", "help-text");
        } else {
            toDelete.remove();
        }
    }

    toggleHelp(true);

    function fetchData(range) {
        var tooLarge = range[1] - range[0] > maxTimeForDetails;
         var url = templates.urls.profiling({
            myria: myriaConnection,
            query: graph.queryStatus.queryId,
            subquery: graph.queryStatus.subqueryId,
            fragment: fragmentId,
            start: range[0],
            end: range[1],
            onlyRootOp: tooLarge,
            // don't request anything that is less than a pixel wide
            minLength: Math.floor(0.5*(range[1] - range[0])/width)
        });

         if (tooLarge) {
            alert("We are only showing events for the root operators because the selected range is too long.");
         }

        d3.csv(url, function(d) {
            d.workerId = +d.workerId;
            d.startTime = +d.startTime;
            d.endTime = +d.endTime;
            d.numTuples = +d.numTuples;
            return d;
        }, function(error, data) {
            var aggregatedData = [],
                grouped = _.groupBy(data, 'workerId'),
                numOps = graph.fragments[fragmentId].operators.length;
            aggregatedData = _.map(grouped, function(val, key){
                return { workerId: +key, states: val };
            });
            redrawLanes(aggregatedData, range);
        });
    }

    var maxLevel = _.max(_.values(levels));

    function redrawLanes(data, range) {
        x.domain(range);

        y.domain(_.sortBy(_.uniq(_.pluck(data, "workerId"))));
        y.rangeRoundBands([50 * y.domain().length, 0], 0.2, 0.1);

        var lane = lanes
            .selectAll(".worker")
            .data(data, function(d) { return d.workerId; });
        lane.enter().append("g").attr("class", "worker");

        lane
            .transition().duration(animationDuration)
            .attr("transform", function(d) { return "translate(0," +  y(d.workerId) + ")"; });

        lane.exit().remove();

        var box = lane.selectAll("rect")
            .data(function(d) {
                return d.states;
            }, function(d) { return d.startTime; });

        function getHeight(d) {
            return y.rangeBand() * (0.5 + (maxLevel - levels[d.opId])/(2*maxLevel));
        }

        box.enter().append("rect")
            //.attr("clip-path", "url(#clip)")
            .style("fill", function(d) { return opToColor[d.opId]; })
            .attr("class", "box");

        box.on('mouseover', function(d) {
            d3.select(this)
                .transition().duration(shortDuration)
                .attr("height", function(d) {
                    return getHeight(d) + 4;
                })
                .style("fill", function(d) { return d3.rgb(opToColor[d.opId]).brighter(0.4); });
        });

        box.on('mouseenter', function(d) {
            d3.select(this).tooltip(function(d) {
                var content = templates.strong({ text: idNameMapping[d.opId] });
                if (_.has(d, 'numTuples')) {
                    if (d.numTuples >= 0) {
                        content += templates.numTuplesTemplate({ numTuples: d.numTuples });
                    } else {
                        content += templates.nullReturned();
                    }
                    content += ', ';
                }
                content += templates.duration({ duration: customFullTimeFormat(d.endTime - d.startTime, false) });
                return content;
            });
        });

        box.on('mouseleave', function(d) {
            d3.select(this)
                .transition().duration(shortDuration)
                .attr("height", getHeight)
                .style("fill", function(d) { return opToColor[d.opId]; });
        });

        box
            .transition()
            .duration(animationDuration)
            .attr("x", function(d) { return x(d.startTime); })
            .style("opacity", 1)
            .attr("width", function(d) {
                return x(d.endTime) - x(d.startTime);
            })
            .attr("height", getHeight)
            .attr("y", function(d) {
                return y.rangeBand() - getHeight(d);
            });

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
            .style("text-anchor", "begin")
            .attr("class", "title");

        titleEnter.append("text")
            .attr("class", "title");

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
            });

        title.exit()
            .transition()
            .duration(animationDuration).style("opacity", 0)
            .remove();

        svg.select(".axis-label").style("visibility", "visible");
    }

    return {
        redrawLanes: redrawLanes,
        toggleHelp: toggleHelp,
        fetchData: fetchData
    };
}

function xAxisLabel(selection) {
    selection.attr("class", "axis-label")
        .attr({"x": - 6, "y": -12, "text-anchor": "middle"})
        .attr("dy", ".71em")
        .style("text-anchor", "end")
        .text("Time");
}
