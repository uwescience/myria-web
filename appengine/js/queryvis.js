var state_colors = {
    "sleep": "gray",
    "compute": "orangered",
    "wait": "dodgerblue",
    "receive": "orange",
    "send": "olivedrab"
};

var boxTemplate = _.template("Duration: <%- duration %> ms");
var titleTemplate = _.template("<strong><%- name %></strong> <small><%- type %></small>");
var stateTemplate = _.template("<span style='color: <%- color %>'><%- state %></span>: <%- time %>");


var makeChart = function(chartSelector, query_id, chartWidth, treeWidth) {
    var margin = {top: 10, right: 10, bottom: 30, left: 10 },
        width = chartWidth,
        height = 200 - margin.top - margin.bottom;

    var x = d3.time.scale()
        .range([0, width]);

    var y = d3.scale.linear()
        .range([height, 0]);

    var xAxis = d3.svg.axis()
        .scale(x)
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

    var svg = d3.select(chartSelector).append("svg")
        .attr("width", width + treeWidth + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      .append("g")
        .attr("transform", "translate(" + (margin.left + treeWidth) + "," + margin.top + ")");

    svg.append("defs").append("clipPath")
        .attr("id", "chartclip")
      .append("rect")
        .attr("width", chartWidth)
        .attr("height", height + 10)
        .attr("y", -10);

    var wholeDomain;

    d3.csv("/stats?format=utilization&query_id=" + query_id, function(error, data) {
        data.forEach(function(d) {
            d.time = new Date(parseInt(d.time, 10));
        });

        wholeDomain = d3.extent(data, function(d) { return d.time; });

        x.domain(wholeDomain);
        y.domain(d3.extent(data, function(d) { return d.value; }));

        svg.append("g")
          .attr("class", "x axis")
          .attr("transform", "translate(0," + height + ")")
          .call(xAxis);

        svg.append("g")
          .attr("class", "y axis")
          .call(yAxis)
        .append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", -50)
            .attr("dy", ".71em")
            .style("text-anchor", "end")
            .text("Number of nodes working");

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
    });

    function brushed(brush) {
        x.domain(brush.empty() ? wholeDomain : brush.extent());
        svg.select("path.area").attr("d", area);
        svg.select("path.line").attr("d", line);
        svg.select(".x.axis").call(xAxis);
    }

    return brushed;
};

var ganttChart = function(ganttSelector, chartSelector, query_id) {
    var margin = {top: 10, right: 10, bottom: 20, left: 10},
        treeWidth = 200,
        width = parseInt(d3.select(ganttSelector).style('width'), 10) - margin.left - margin.right,
        height = 400 - margin.top - margin.bottom,
        miniHeight = 30,
        chartMargin = 40,
        chartWidth = width - treeWidth,
        chartHeight = height - miniHeight - chartMargin;

    var animationDuration = 750;

    var x = d3.time.scale()
        .range([0, chartWidth]);

    var x2 = d3.time.scale()
        .range([0, chartWidth]);

    var y = d3.scale.ordinal()
        .rangeRoundBands([0, chartHeight], 0.2, 0.1);

    var y2 = d3.scale.linear()
        .range([0, miniHeight]);

    var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom")
        .tickSize(-chartHeight);

    var xAxis2 = d3.svg.axis()
        .scale(x2)
        .orient("bottom")
        .tickSize(-miniHeight);

    var yAxis = d3.svg.axis()
        .scale(y)
        .orient("left");

    /* charts and hierarchy */

    var svg = d3.select(ganttSelector).append("svg")
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
        .attr("transform", "translate(0," + chartHeight + ")");

    chart.append("text")
        .attr({"id": "xLabel", "x": chartWidth/2, "y": chartHeight + 30, "text-anchor": "middle"})
        .text("Time (s)");

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

    mini.append('g')
        .attr('class', 'x brush')
        .call(brush)
        .selectAll('rect')
            .attr('y', 1)
            .attr('height', miniHeight - 1);

    mini.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + miniHeight + ")");


    /* ruler */
    var ruler = d3.select("body")
        .append("div")
        .attr("class", "ruler");

    var tooltip = d3.select("body")
        .append("div")
        .attr("id", "rulerInfo");

    chart.on("mousemove", function (e) {
        ruler
            .style("display", "block")
            .style("left", d3.event.pageX + "px");

        tooltip
            .style("display", "block")
            .style("left", d3.event.pageX + 10 + "px")
            .style("top", d3.event.pageY + "px")
            .text("time: " + x.invert(d3.mouse(this)[0]).getMilliseconds());
    });

    chart.on("mouseleave", function (e) {
        ruler.style("display", "none");
        tooltip.style("display", "none");
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
        var beginDate = new Date(data.begin),
            endDate = new Date(data.end);

        x2.domain([beginDate, endDate]);

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
        var beginDate = new Date(data.begin),
            endDate = new Date(data.end);

        x.domain(brush.empty() ? [beginDate, endDate] : brush.extent());

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
                    content: boxTemplate({duration: duration})
                };
            })
            .style("opacity", 0)
            .attr("clip-path", "url(#clip)")
            .style("fill", function(d) { return state_colors[d.name]; })
            .attr("class", "box");

        box
            .attr("x", function(d) {
                return x(d.begin);
            })
            .attr("width", function(d, i) {
                if (d.end) {
                   return x(d.end) - x(d.begin);
                } else {
                    return x(endDate) - x(d.begin);
                }
            })
            .transition()
            .duration(animationDuration)
            .attr("y", function(d) {
                return y(d.lane);
            })
            .attr("height", y.rangeBand())
            .style("opacity", 0.75);

        box.on("mouseover", function() {
                d3.select(this)
                    .transition()
                    .duration(animationDuration/3)
                    .style({opacity: 1});
            })
            .on("mouseout", function() {
                d3.select(this)
                    .transition()
                    .duration(animationDuration)
                    .style({opacity: 0.75});
            });

        box.exit()
            .transition()
            .duration(animationDuration)
            .style("opacity", 0)
            .remove();

        /* Titles */
        var title = hierarchy.selectAll("g.label")
            .data(visibleNodes, function(d) { return d.lane; });

        var titleEnter = title.enter()
            .append("g")
            .style("opacity", 0)
            .attr("transform", function(d) { return "translate(" + (20 * d.depth) + "," + (y(d.lane) + y.rangeBand()/2) + ")"; })
            .style("text-anchor", "begin")
            .attr("class", "label");

        titleEnter.append("text")
            .attr("dx", -20)
            .attr("font-family", "Glyphicons Halflings")
            .attr("font-size", "16px")
            .attr("width", 20)
            .attr("height", 20)
            .attr("dy", 9)
            .attr("class", "icon")
            .style("cursor", function(d) {
                if (d.hasChildren) {
                    return "pointer";
                }
            });

        var labelTextEnter = title.append("g")
            .attr("class", "labelText");

        labelTextEnter.append("text")
            .attr("class", "title");

        labelTextEnter.append("text")
            .attr("dy", "1.2em")
            .attr("class", "subtitle");

        title
            .transition()
            .duration(animationDuration)
            .style("opacity", 1)
            .attr("transform", function(d) {
                var dx = (25 * d.depth);
                if (d.hasChildren) {
                    dx += 18;
                }
                return "translate(" + dx + "," + (y(d.lane) + y.rangeBand()/2) + ")";
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

        title.select("g.labelText").popover(function(d) {
            var content = "";
            _.each(d.times, function(time, state) {
                content += stateTemplate({state: state, color: state_colors[state], time: time}) + "<br/>";
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
            .attr('x1', x(endDate))
            .attr('x2', x(endDate));

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
            var end = state.end;
            if (end)
                end = new Date(end);
            var begin = new Date(state.begin);
            stateData.push({
                "id": node.lane + begin.getTime(),
                "lane": node.lane,
                "name": state.name,
                "begin": begin,
                "end": end
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
    if (chartSelector) {
        utilizationChart = makeChart(chartSelector, query_id, chartWidth, treeWidth);
    }

    $.getJSON('/stats', {query_id: query_id, format: 'states'}, function(rawData) {
        data = rawData;
        var lane = 0;
        data.hierarchy.forEach(function(node) {
            lane = importTree(node, lane, 0);
        });
        numberLanes = lane;
        draw();
    });
};

ganttChart('#gantt', '#chart', 9);
