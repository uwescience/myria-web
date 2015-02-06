var manyLineCharts = function(element, fragmentIds, graph) {
    $('.title-current').html('');

    $(element.node()).empty();

    var stats = element.append("div").attr("class", "stats");
    updateQueryStats(stats, graph.queryStatus);

    var charts = [];

    function changeRange(range) {
        _.each(charts, function (c) {
            c.changeDomain(range);
        });
    }

    charts = _.map(fragmentIds, function(fragmentId) {
        var div = element.append("div")
            .attr("class", "overview-fragment");
        var h = div.append("h4")

        h.append("a").attr("href", "#")
            .text(templates.fragmentTitle({fragment: fragmentId}))
            .tooltip("Open detailed execution view")
            .on("click", function(a) {
                d3.event.stopPropagation();
                graph.openFragment("f"+fragmentId, true);
            })

        h.append("span").text(" ");

        var small = h.append('a').append('small')
            .attr('class', 'muted')
            .text('expand/collapse')
            .on("click", function(a) {
                d3.event.stopPropagation();
                if (_.contains(graph.state.opened, "f"+fragmentId)) {
                    graph.closeFragment("f"+fragmentId);
                } else {
                    graph.openFragment("f"+fragmentId, false);
                }
            })

        var workers = graph.fragments[fragmentId].workers;
        var numWorkers = workers.length;

        var hierarchy = graph.nested["f"+fragmentId],
            levels = {},
            children = {};
        function addLevels(node, level) {
            levels[node.id] = level++;
            children[node.id] = _.pluck(node.children, 'id');
            _.map(node.children, function(n) {
                addLevels(n, level);
            });
        }
        addLevels(hierarchy, 0);

        var operators = _.map(graph.nodes["f"+fragmentId].opNodes, function(d, opId) {
            d.level = levels[opId];
            d.children = children[opId];
            d.opId = opId;
            return d;
        });

        operators = _.sortBy(operators, function(d) {
            return -d.level;
        });

        return lineChart(div, fragmentId, numWorkers, operators, changeRange, graph, _.contains(graph.state.opened, "f"+fragmentId));
    });

    // return variables that are needed outside this scope
    return {};
};

var lineChart = function(element, fragmentId, numWorkers, operators, callback, graph, expanded) {
    var margin = {top: 10, right: 10, bottom: 20, left: 180 },
        width = parseInt(element.style('width'), 10) - margin.left - margin.right;

    if (expanded) {
        var height = operators.length * 70 - margin.top - margin.bottom;
    } else {
        var height = 80 - margin.top - margin.bottom;
    }

    margin.left = _.max([margin.left, width / 6]);

    var bisectTime = d3.bisector(function(d) { return d.nanoTime; }).right;

    var o = d3.scale.ordinal()
        .domain(_.pluck(operators, "opId"))
        .rangeRoundBands([height, 0], 0.18, 0);

    var x = d3.scale.linear()
        .range([0, width]);

    var y = d3.scale.linear()
        .range([o.rangeBand(), 0])
        .domain([0, numWorkers]);

    var xAxis = d3.svg.axis()
        .scale(x)
        .tickFormat(customFullTimeFormat)
        .tickSize(-height)
        .orient("bottom");

    var yAxis = d3.svg.axis()
        .scale(y)
        .ticks(_.min([numWorkers, 5]))
        .tickFormat(d3.format("d"))
        .tickSubdivide(0)
        .orient("left");

    var area = d3.svg.area()
        .interpolate("montone")
        .x(function(d) { return x(d.nanoTime); })
        .y0(o.rangeBand())
        .y1(function(d) { return y(d.numWorkers); });

    var svg = element.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      .append("g")
        .attr("transform", "translate(" + (margin.left) + "," + margin.top + ")")
        .attr("class", "chart");

    var defs = svg.append("defs")

    defs.append("clipPath")
        .attr("id", "chartclip")
      .append("rect")
        .attr("width", width)
        .attr("height", height + 10)
        .attr("y", -10);

    defs.append("clipPath")
        .attr("id", "textclip")
      .append("rect")
        .attr("width", margin.left - 34)
        .attr("height", height)
        .attr("y", -10);

    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis);

    var wholeDomain = [0, graph.queryStatus.elapsedNanos];

    fetchData(wholeDomain);

    var plot = svg.append("g")
        .attr("class", "plot");

    plot.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("opacity", 0);

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 5)
        .attr("dy", -30)
        .style("font-size", 9)
        .attr("x", -height)
        .style("text-anchor", "start")
        .text("# of workers");

    // put Time label on xAxis
    svg.append("g")
        .attr("transform", "translate(" + [width, height] + ")")
        .append("text")
        .attr("class", "axis-label")
        .attr({"x": - 6, "y": -12, "text-anchor": "middle"})
        .attr("dy", ".71em")
        .style("text-anchor", "end")
        .text("Time");

    /* Ruler */
    var tooltip = svg
        .append("g")
        .attr({"class": "rulerInfo"})
        .attr("transform", "translate(" + [10, height + 10] + ")");

    tooltip.append("rect");

    var tttext = tooltip.append("text")
        .attr("text-anchor", "left");

    svg.on("mouseleave", function (e) {
        d3.select(".ruler").style("display", "none");
    });

    svg.on("mousemove", function (e) {
        d3.select(".ruler")
            .style("display", "block")
            .style("left", d3.event.pageX - 1 + "px");
    });


    var lanes = [];

    // fetch histogram data and show it
    function fetchData(range) {
        var start = range[0],
            end = range[1];
        var step = Math.floor((end - start) / width);

        var url = templates.urls.histogram({
            myria: myriaConnection,
            query: graph.queryStatus.queryId,
            subquery: graph.queryStatus.subqueryId,
            fragment: fragmentId,
            start: start,
            end: end,
            step: step,
            onlyRootOp: false
        });

        d3.csv(url, function(d) {
            d.nanoTime = +d.nanoTime;
            d.numWorkers = +d.numWorkers;
            return d;
        }, function(error, incompleteData) {
            var incompleteNested = d3.nest()
                .key(function(d) { return d.opId; })
                .entries(incompleteData);

            var opIndex = _.object(_.map(operators, function(x){ return [x.opId, x]; }));

            // extend data to include operators without data
            incompleteNested = _.map(operators, function(op) {
                for (var i = 0; i < incompleteNested.length; i++) {
                    var d = incompleteNested[i];
                    if (d.key === op.opId) {
                        return d;
                    }
                }
                return {
                    key: op.opId,
                    values: []
                };
            });

            var data = _.sortBy(reconstructFullData(incompleteNested, start, end, step, true), function(d) {
                return opIndex[d.key].level;
            });

            if (expanded) {
                draw(data, opIndex, range, true);
            } else {
                o.domain([data[0].key]);
                y.range([o.rangeBand(), 0]);
                area.y0(o.rangeBand());
                draw([data[0]], opIndex, range, false);
            }
        });
    }

    function draw(data, opIndex, range, expanded) {
        if (expanded) {
            // subtract data from children to get the self time, not total
            var indexedData = _.object(_.map(data, function(x){ return [x.key, x.values]; }));
            _.each(data, function(d) {
                var allChildrenValues = _.values(_.pick(indexedData, opIndex[d.key].children));
                _.each(allChildrenValues, function(childValues) {
                    for (var i = 0; i < d.values.length; i++) {
                        d.values[i].numWorkers -= childValues[i].numWorkers;
                    }
                });
            });
        }

        x.domain(range);

        svg.select(".x.axis").call(xAxis);

        lanes = plot.selectAll(".lane").data(data);

        lanes.enter().append("g")
            .attr("class", "lane")
            .attr("transform", function(d) { return "translate(0," + o(d.key) + ")"; })
            .each(multiple);

        lanes.each(function(op) {
            var lane = d3.select(this);
            lane.on("mousemove", function (e) {
                var xPixels = d3.mouse(this)[0],
                    xValue = Math.round(x.invert(xPixels));

                var i = bisectTime(op.values, xValue),
                    d0 = op.values[i - 1];

                if (d0 === undefined) {
                    return;
                }

                svg
                    .select(".rulerInfo")
                    .style("opacity", 1)
                    .attr("transform", "translate(" + [xPixels + 6, o(op.key) + o.rangeBand() + 14] + ")");

                tttext.text(templates.chartTooltipTemplate({time: customFullTimeFormat(xValue), number: d0.numWorkers}));

                var bbox = tttext.node().getBBox();
                tooltip.select("rect")
                    .attr("width", bbox.width + 10)
                    .attr("height", bbox.height + 6)
                    .attr("x", bbox.x - 5)
                    .attr("y", bbox.y - 3);
            });
        });

        lanes.select(".area").attr("d", function(op) {
            return area(op.values);
        });

        function multiple(op) {
            var lane = d3.select(this);

            lane.append("g")
                .attr("class", "y axis")
                .call(yAxis);

            var t = lane.append("g")
                .attr("transform", function(d) { return "translate(" + (-margin.left) + "," + (o.rangeBand()/2 - 20) + ")"; })
                .attr("clip-path", "url(#textclip)");

            t.append("text")
                .style("font-size", 12)
                .attr("class", "strong")
                .attr("x", 10)
                .attr("y", 8)
                .attr("dx", function(d) {
                    return opIndex[d.key].level * 5;
                })
                .text(function(d) {
                    if (expanded) {
                        return opIndex[d.key].opName;
                    } else {
                        return "Fragment " + fragmentId;
                    }
                });

            t.append("text")
                .style("font-size", 11)
                .attr("x", 10)
                .attr("dx", function(d) {
                    return opIndex[d.key].level * 5;
                })
                .attr("dy", "2em")
                .attr("class", "muted")
                .text(function(d) {
                    if (expanded) {
                        return opIndex[d.key].opType;
                    }
                });

            // avoid ruler over op texts
            t.append("rect")
                .attr("width", margin.left)
                .attr("height", 32)
                .attr("y", -10)
                .style("opacity", 0)
                .on("mousemove", function () {
                    d3.select(".ruler").style("display", "none");
                    d3.event.stopPropagation();
                });

            t.append("circle")
                .attr("r", 4)
                .attr("cx", function(d) {
                    return opIndex[d.key].level * 5 + 5;
                }).attr("cy", -5)
                .attr("class", "rect-info")
                .popover(function (d) {
                    var body = '';
                    _.each(expanded ? opIndex[d.key].rawData : graph.nodes["f"+fragmentId].rawData, function(value, key){
                        if (key == 'operators') {
                            return;
                        }
                        if (value === null) {
                            value = 'null';
                        }
                        if (value !== null && typeof value === 'object') {
                          value = templates.code({code: JSON.stringify(value)});
                        }
                        body += templates.row({key: key, value: value});
                    });
                    return {
                        placement: 'left',
                        title: templates.strong({text: expanded ? opIndex[d.key].opName : "Fragment " + fragmentId}),
                        content: templates.table({body: body})
                    };
                }).on("mousemove", function () {
                    d3.select(".ruler").style("display", "none");
                    d3.event.stopPropagation();
                });

            /* Ruler */
            lane.append("rect")
                .attr("width", width)
                .attr("height", o.rangeBand())
                .style("opacity", 0);

            lane.on("mouseleave", function () {
                svg
                    .select(".rulerInfo")
                    .style("opacity", 0);
            });

            /* Area */
            lane.append("path")
                .attr("clip-path", "url(#chartclip)")
                .attr("class", "area");

            // Brush
            var brush = d3.svg.brush()
                .x(x)
                .on("brushend", brushend);

            var brushElement = lane.append("g")
                .attr("class", "brush")
                .call(brush);
            brushElement.selectAll('rect')
                .attr('height', o.rangeBand());

            function brushend() {
                var brush_extent = brush.empty() ? wholeDomain : brush.extent();
                var range = [Math.floor(brush_extent[0]), Math.ceil(brush_extent[1])];

                callback(range);

                brushElement.call(brush.clear());
            }
        }
    }

    function changeDomain(range) {
        x.domain(range);

        lanes.select(".area")
            .transition()
            .duration(animationDuration)
            .attr("d", function(d) {
                return area(d.values);
            });

        svg.select(".x.axis")
            .transition()
            .duration(animationDuration)
            .call(xAxis)
            .each("end", function() {
                fetchData(range);
            });
    }

    return {
        changeDomain: changeDomain
    };
};