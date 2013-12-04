var state_colors = {
    "sleep": "#c7c7c7",
    "compute": "#ff7f0e",
    "wait": "#ffbb78",
    "receive": "#fd8d3c",
    "send": "#2ca02c"
};

var boxTemplate = _.template("Duration: <%- duration %>"),
    titleTemplate = _.template("<strong><%- name %></strong> <small><%- type %></small>"),
    stateTemplate = _.template("<span style='color: <%- color %>'><%- state %></span>: <%- time %>"),
    chartTooltipTemplate = _.template("Time: <%- time %> #: <%- number %>"),
    ganttTooltipTemplate = _.template("Time: <%- time %>");

var animationDuration = 750;

function timeFormat(formats) {
  return function(date) {
    var i = formats.length - 1, f = formats[i];
    while (!f[1](date)) f = formats[--i];
    return f[0](date);
  };
}

function timeFormatNs(formats) {
  return function(date) {
    if (date % 1e6 !== 0) {
        return (date % 1e6).toExponential(2) + " ns";
    }

    return timeFormat(formats)(new Date(date/1e6 + new Date().getTimezoneOffset() * 6e4));
  };
}

var customTimeFormat = timeFormatNs([
  [d3.time.format("%H:%M:%S"), function(d) { return true; }],
  [d3.time.format("%H:%M:%S"), function(d) { return d.getMinutes(); }],
  [d3.time.format(":%S.%L"), function(d) { return d.getSeconds(); }],
  [d3.time.format(".%L"), function(d) { return d.getMilliseconds(); }]
]);

function divmod(a, b) {
    return [Math.floor(a/b), a%b];
}

function customFullTimeFormat(d) {
    var str = "", ms, ns, s, m, h, x;

    x = divmod(d, 1e6);
    ns = x[1];
    x = divmod(x[0], 1000);
    ms = x[1];
    x = divmod(x[0], 60);
    s = x[1];
    x = divmod(x[0], 60);
    m = x[1];
    h = x[0];

    if (h) {
        str += h + " H ";
    }
    if (m) {
        str += m + " m ";
    }
    if (s) {
        str += s + " s ";
    }
    if (ms) {
        if (s) {
            str += d3.format("03d")(ms) + " ms ";
        } else {
            str += ms + " ms ";
        }
    }
    str += d3.format("06d")(ns) + " ns ";
    return str;
}

var ruler = d3.select("body")
    .append("div")
    .attr("class", "ruler");

var lineChart = function(element, treeWidth) {
    var margin = {top: 10, right: 10, bottom: 30, left: 10 },
        width = parseInt(element.style('width'), 10) - margin.left - margin.right,
        height = 150 - margin.top - margin.bottom,
        chartWidth = width - treeWidth;

    var bisectTime = d3.bisector(function(d) { return d.time; }).right;

    var x = d3.scale.linear()
        .range([0, chartWidth]);

    var y = d3.scale.linear()
        .range([height, 0]);

    var xAxis = d3.svg.axis()
        .scale(x)
        .tickFormat(customTimeFormat)
        .tickSize(-height)
        .orient("bottom");

    var yAxis = d3.svg.axis()
        .scale(y)
        .tickFormat(d3.format("d"))
        .orient("left");

    var area = d3.svg.area()
        .interpolate("step-after")
        .x(function(d) { return x(d.time); })
        .y0(height)
        .y1(function(d) { return y(d.value); });

    var line = d3.svg.line()
        .interpolate("step-after")
        .x(function(d) { return x(d.time); })
        .y(function(d) { return y(d.value); });

    var svg = element.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      .append("g")
        .attr("transform", "translate(" + (margin.left + treeWidth) + "," + margin.top + ")")
        .attr("class", "chart");

    svg.append("rect")
        .attr("width", chartWidth)
        .attr("height", height)
        .attr("class", "background");

    svg.append("defs").append("clipPath")
        .attr("id", "chartclip")
      .append("rect")
        .attr("width", chartWidth)
        .attr("height", height + 10)
        .attr("y", -10);

    /* Ruler */
    var tooltip = svg
        .append("g")
        .attr({"class": "rulerInfo"})
        .attr("transform", "translate(" + [10, height + 10] + ")");

    tooltip.append("svg:rect");

    var tttext = tooltip.append("svg:text")
        .attr("text-anchor", "left");

    svg.on("mouseleave", function (e) {
        d3.select(".ruler").style("display", "none");
        svg
            .select(".rulerInfo")
            .style("opacity", 0);
    });

    var wholeDomain;

    var url = "/statsdata?aggregated=1";
    url += "&query_id=" + element.attr('data-query');
    url += "&fragment_id=" + element.attr('data-fragment');

    d3.csv(url, function(error, data) {
        data.forEach(function(d) {
            d.time = parseInt(d.time, 10);
        });

        wholeDomain = d3.extent(data, function(d) { return d.time; });

        x.domain(wholeDomain);
        y.domain(d3.extent(data, function(d) { return d.value; }));

        yAxis.ticks(y.domain()[1]);

        svg.append("path")
            .attr("clip-path", "url(#chartclip)")
            .datum(data)
            .attr("class", "area")
            .attr("d", area);

        svg.append("path")
            .attr("clip-path", "url(#chartclip)")
            .datum(data)
            .attr("class", "line")
            .attr("d", line);

        svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height + ")")
            .call(xAxis)
          .append("text")
            .attr("class", "label")
            .attr({"id": "xLabel", "x": chartWidth - 6, "y": -12, "text-anchor": "middle"})
            .attr("dy", ".71em")
            .style("text-anchor", "end")
            .text("Time");

        svg.append("g")
            .attr("class", "y axis")
            .call(yAxis)
          .append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", -40)
            .attr("dy", ".71em")
            .style("text-anchor", "end")
            .text("Number of nodes working");

        svg.select("g.x.axis").call(xAxis);

        svg.on("mousemove", function (e) {
            d3.select(".ruler")
                .style("display", "block")
                .style("left", d3.event.pageX - 1 + "px");

            var xPixels = d3.mouse(this)[0],
                xValue = Math.round(x.invert(xPixels));

            var i = bisectTime(data, xValue),
                d0 = data[i - 1];

            if (d0 === undefined) {
                return;
            }

            svg
                .select(".rulerInfo")
                .style("opacity", 1)
                .attr("transform", "translate(" + [xPixels + 6, height + 14] + ")");

            tttext.text(chartTooltipTemplate({time: customFullTimeFormat(xValue), number: d0.value}));

            var bbox = tttext.node().getBBox();
            tooltip.select("rect")
                .attr("width", bbox.width + 10)
                .attr("height", bbox.height + 6)
                .attr("x", bbox.x - 5)
                .attr("y", bbox.y - 3);
        });
    });

    function brushed(brush) {
        x.domain(brush.empty() ? wholeDomain : brush.extent());
        svg.select("path.area").attr("d", area);
        svg.select("path.line").attr("d", line);
        svg.select(".x.axis").call(xAxis);
    }

    return brushed;
};

var ganttChart = function(element) {
    var margin = {top: 10, right: 10, bottom: 20, left: 10},
        treeWidth = 200,
        width = parseInt(element.style('width'), 10) - margin.left - margin.right,
        height = 400 - margin.top - margin.bottom,
        miniHeight = 30,
        chartMargin = 47,
        chartWidth = width - treeWidth,
        chartHeight = height - miniHeight - chartMargin;

    var x = d3.scale.linear()
        .clamp(true)
        .range([0, chartWidth]);

    var x2 = d3.scale.linear()
        .range([0, chartWidth]);

    var y = d3.scale.ordinal()
        .rangeRoundBands([0, chartHeight], 0.2, 0.1);

    var y2 = d3.scale.linear()
        .range([0, miniHeight]);

    var xAxis = d3.svg.axis()
        .scale(x)
        .tickFormat(customTimeFormat)
        .orient("bottom")
        .tickSize(-chartHeight);

    var xAxis2 = d3.svg.axis()
        .scale(x2)
        .tickFormat(customTimeFormat)
        .orient("bottom")
        .tickSize(-miniHeight);

    var yAxis = d3.svg.axis()
        .scale(y)
        .orient("left");

    /* charts and hierarchy */
    var svg = element.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var chart = svg.append("g")
        .attr("class", "chart")
        .attr("transform", "translate(" + treeWidth + ", 0)");

    var hierarchy = svg.append("g")
        .attr("class", "hierarchy");

    var mini = svg.append('g')
        .attr('transform', 'translate(' + treeWidth + ',' + (chartHeight + chartMargin) + ')')
        .attr('width', chartWidth)
        .attr('height', miniHeight)
        .attr('class', 'mini');

    /* main chart */
    chart.append("rect")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("class", "background");

    chart.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + chartHeight + ")")
      .append("text")
        .call(xAxisLabel);

    chart.append("defs").append("clipPath")
        .attr("id", "clip")
      .append("rect")
        .attr("width", chartWidth)
        .attr("height", chartHeight);

    var lanes = chart.append("g")
        .attr("class", "lanes");

    chart.append("line")
        .attr("y1", 0)
        .attr("y2", chartHeight)
        .attr("class", 'endLine');

    /* mini and brush */
    var brush = d3.svg.brush()
        .x(x2)
        .on("brush", brushed);

    miniLanes = mini.append("g");

    mini.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + miniHeight + ")")
      .append("text")
        .call(xAxisLabel);

    mini.append('g')
        .attr('class', 'x brush')
        .call(brush)
        .selectAll('rect')
            .attr('y', 0)
            .attr('height', miniHeight);

    mini.select("rect.background")
        .style("visibility", "visible");

    function xAxisLabel(selection) {
        selection.attr("class", "label")
            .attr({"id": "xLabel", "x": chartWidth - 6, "y": -12, "text-anchor": "middle"})
            .attr("dy", ".71em")
            .style("text-anchor", "end")
            .text("Time");
    }

    /* ruler */
    var tooltip = chart
        .append("g")
        .attr({"class": "rulerInfo"})
        .attr("transform", "translate(" + [10, chartHeight + 10] + ")");

    tooltip.append("svg:rect");

    var tttext = tooltip.append("svg:text")
        .attr("text-anchor", "left");

    chart.on("mousemove", function (e) {
        ruler
            .style("display", "block")
            .style("left", d3.event.pageX - 1 + "px");

        chart
            .select(".rulerInfo")
            .style("opacity", 1)
            .attr("transform", "translate(" + [d3.mouse(this)[0] + 6, chartHeight + 14] + ")");

        var xValue = Math.round(x.invert(d3.mouse(this)[0]));
        tttext.text(ganttTooltipTemplate({ time: customFullTimeFormat(xValue) }));

        var bbox = tttext.node().getBBox();
        tooltip.select("rect")
            .attr("width", bbox.width + 10)
            .attr("height", bbox.height + 6)
            .attr("x", bbox.x - 5)
            .attr("y", bbox.y - 3);
    });

    chart.on("mouseleave", function (e) {
        ruler.style("display", "none");
        chart
            .select(".rulerInfo")
            .style("opacity", 0);
    });

    /* state data as an array */
    var stateData = [];
    /* hierarchy and general data */
    var data = {};

    function getNodes(node, nodes) {
        if ('lane' in node) {
            node.hasChildren = node.children.length > 0;
            nodes[node.lane] = node;
            if (!node.childrenVisible) {
                return;
            }
        }
        node.children.forEach(function(child) {
            getNodes(child, nodes);
        });
    }

    // generates a single path for each item class in the mini display
    // ugly - but draws mini 2x faster than append lines or line generator
    // is there a better way to do a bunch of lines as a single path with d3?
    // from: http://bl.ocks.org/bunkat/1962173
    function getPaths(items) {
        var paths = {}, d, offset = 0.5 * y2(1) + 0.5, result = [];
        _.each(items, function(d) {
            if (!paths[d.name]) paths[d.name] = '';
            if (d.end === null)
                    d.end = data.end;
            paths[d.name] += ["M", x2(d.begin), (y2(d.lane) + offset), "H", x2(d.end)].join(" ");
        });

        for (var name in paths) {
            result.push({name: name, path: paths[name]});
        }

        return result;
    }

    var numberLanes = 0;

    function draw() {
        x2.domain([data.begin, data.end]);

        y2.domain([0, numberLanes]);

        miniLanes.selectAll("miniItems")
            .data(getPaths(stateData))
            .enter().append("path")
            .attr("class", function(d) { return "miniItem " + d.name; })
            .attr("d", function(d) { return d.path; })
            .style("stroke", function(d) { return state_colors[d.name]; });

        mini.select("g.x.axis").call(xAxis2);

        recalculateVisible();
        redraw();
    }

    var visibleLanes, visibleStates, visibleNodes;
    function recalculateVisible() {
        visibleLanes = {};
        getNodes({ children: data.hierarchy }, visibleLanes);

        visibleStates = _.filter(stateData, function(d) {
            return visibleLanes[d.lane];
        });

        visibleNodes = _.values(visibleLanes);
        y.domain(_.keys(visibleLanes));
    }

    function redraw() {
        x.domain(brush.empty() ? [data.begin, data.end] : brush.extent());

        /* Boxes */
        var box = lanes.selectAll("rect")
            .data(visibleStates, function(d) { return d.id; });

        box.enter().append("rect")
            .popover(function(d) {
                if (d.end === null)
                    d.end = data.end;
                var duration = d.end - d.begin;
                return {
                    title: d.name,
                    content: boxTemplate({duration: customFullTimeFormat(duration)})
                };
            })
            .attr("clip-path", "url(#clip)")
            .style("fill", function(d) { return state_colors[d.name]; })
            .style("stroke", function(d) { return d3.rgb(state_colors[d.name]).darker(0.5); })
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

        box.on("mousemove", function() {
                d3.select(this)
                    .style("fill", function(d) { return d3.rgb(state_colors[d.name]).darker(0.5); });
            })
            .on("mouseout", function() {
                d3.select(this)
                    .transition()
                    .duration(animationDuration/2)
                    .style("fill", function(d) { return state_colors[d.name]; });
            });

        box.exit()
            .transition()
            .duration(animationDuration)
            .style("opacity", 0)
            .remove();

        /* Titles */
        var title = hierarchy.selectAll("g.title")
            .data(visibleNodes, function(d) { return d.lane; });

        var titleEnter = title.enter()
            .append("g")
            .style("opacity", 0)
            .attr("transform", function(d) { return "translate(" + (20 * d.depth) + "," + (y(d.lane) + y.rangeBand()/2) + ")"; })
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
                return "translate(" + [10 + 25 * d.depth, (y(d.lane) + y.rangeBand()/2)] + ")";
            });

        title.select("text.icon")
            .text(function(d) {
                if (d.hasChildren) {
                    if (d.childrenVisible) {
                        return "\ue114";
                    } else {
                        return "\ue080";
                    }
                }
            })
            .attr("class", "icon")
            .on("click", function(d) {
                laneClick(d, data);
            });

        title.select("text.title")
            .text(function(d) {
                return d.name;
            })
            .attr("class", "title");

        title.select("g.title-text").popover(function(d) {
            var content = "";
            _.each(d.times, function(time, state) {
                content += stateTemplate({state: state, color: state_colors[state], time: customFullTimeFormat(time) }) + "<br/>";
            });
            return {
                title: titleTemplate({ name: d.name, type: d.type }),
                content: content
            };
        });

        title.select("text.subtitle")
            .text(function(d) { return  d.type; })
            .attr("class", "subtitle");

        title.exit()
            .transition()
            .duration(animationDuration).style("opacity", 0)
            .remove();

        /* Other elements */
        svg.select('.endLine')
            .attr('x1', x(data.end))
            .attr('x2', x(data.end));

        chart.select("g.x.axis").call(xAxis);
    }

    function brushed() {
        redraw();
        if (utilizationChart) {
            utilizationChart(brush);
        }
    }

    function laneClick(d, data) {
        d.childrenVisible = !d.childrenVisible;
        recalculateVisible();
        redraw();
    }

    /* import loaded data into internal data structures */
    function importTree(node, lane, depth) {
        node.lane = lane++;
        node.depth = depth;
        node.childrenVisible = true;
        node.states.forEach(function(state) {
            stateData.push({
                "id": node.lane + state.begin,
                "lane": node.lane,
                "name": state.name,
                "begin": state.begin,
                "end": state.end
            });
        });

        // aggregate data
        node['times'] = {};
        var agg = _.groupBy(node.states, "name");
        var content = "";
        var sum = function(memo, num){
            if (num.end === null)
                num.end = data.end;
            return memo + num.end - num.begin;
        };
        _.each(agg, function(arr, state) {
            var time = _.reduce(arr, sum, 0);
            node['times'][state] = time;
        });

        // state data is in stateData
        delete node.states;

        depth++;
        node.children.forEach(function(child) {
            lane = importTree(child, lane, depth);
        });
        return lane;
    }

    var utilizationChart;
    if (element.attr('data-ref')) {
        var el = d3.select(element.attr('data-ref'));
        utilizationChart = lineChart(el, treeWidth);
    }

    var args = {'query_id': element.attr('data-query')};

    if (element.attr('data-fragment')) {
        args.fragment_id = element.attr('data-fragment');
    }

    if (element.attr('data-worker')) {
        args.worker_id = element.attr('data-worker');
    }

    $.getJSON('/statsdata', args, function(rawData) {
        data = rawData;
        var lane = 0;
        data.hierarchy.forEach(function(node) {
            lane = importTree(node, lane, 0);
        });
        numberLanes = lane;
        draw();
    }).fail(function(jqxhr, textStatus, error) {
        var err = textStatus + ", " + error;
        console.error("Request Failed: " + err);
    });
};

// use data bindings to attach charts
d3.selectAll('.chart').each(function() {
    element = d3.select(this);
    var type = element.attr('data-type');
    if (type === 'gantt') {
        ganttChart(element);
    } else if (type === 'line') {
        lineChart(element, 10);
    }
});
