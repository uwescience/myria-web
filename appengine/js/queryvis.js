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

var ganttChart = function(selector, query_id) {
    var margin = {top: 20, right: 20, bottom: 40, left: 30},
        treeWidth = 200,
        width = parseInt(d3.select(selector).style('width'), 10) - margin.left - margin.right,
        height = 350 - margin.top - margin.bottom,
        chartWidth = width - treeWidth;

    var animationDuration = 750;

    var x = d3.time.scale()
        .range([0, chartWidth]);

    var y = d3.scale.ordinal()
        .rangeRoundBands([0, height], 0.2, 0.1);

    var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom")
        .tickSize(-height);

    var yAxis = d3.svg.axis()
        .scale(y)
        .orient("left");

    var svg = d3.select('#chart').append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var chart = svg.append("g")
        .attr("class", "chart")
        .attr("transform", "translate(" + treeWidth + ", 0)");

    chart.append("rect")
        .attr("width", chartWidth)
        .attr("height", height)
        .attr("class", "background");

    chart.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")");

    chart.append("text")
        .attr({"id": "xLabel", "x": chartWidth/2, "y": height + margin.bottom*2/3, "text-anchor": "middle"})
        .text("Time (s)");

    /*chart.append("g")
        .attr("class", "y axis")
        .call(yAxis);*/

    chart.append("defs").append("clipPath")
        .attr("id", "clip")
      .append("rect")
        .attr("width", chartWidth)
        .attr("height", height);

    var lanes = chart.append("g")
        .attr("class", "lanes");

    chart.append("line")
        .attr("y1", 0)
        .attr("y2", height)
        .attr("class", 'nowLine');

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

    function draw() {
        var beginDate = new Date(data.begin),
            nowDate = new Date(data.now);

        var visibleLanes = {};
        getNodes({ children: data.hierarchy }, visibleLanes);

        var visibleStates = _.filter(stateData, function(d) {
            return visibleLanes[d.lane];
        });

        var visibleNodes = _.values(visibleLanes);

        x.domain([beginDate, nowDate]);
        y.domain(_.keys(visibleLanes));

        /* Boxes */
        var box = lanes.selectAll("rect")
            .data(visibleStates, function(d) { return d.id; });

        box.enter().append("rect")
            .popover(function(d) {
                if (d.end === null)
                    d.end = data.now;
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
            .transition()
            .duration(animationDuration)
            .attr("x", function(d) {
                return x(d.begin);
            })
            .attr("y", function(d) {
                return y(d.lane);
            })
            .attr("width", function(d, i) {
                if (d.end) {
                   return x(d.end) - x(d.begin);
                } else {
                    return x(nowDate) - x(d.begin);
                }
            })
            .attr("height", y.rangeBand())
            .style("opacity", 1);

        box.exit()
            .transition()
            .duration(animationDuration)
            .style("opacity", 0)
            .remove();

        /* Titles */
        var title = svg.selectAll("g.label")
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
        svg.select('.nowLine')
            .attr('x1', x(nowDate))
            .attr('x2', x(nowDate));

        svg.select("g.x.axis").transition().duration(animationDuration).call(xAxis);
    }

    function laneClick(d, data) {
        d.childrenVisible = !d.childrenVisible;
        draw();
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
                num.end = data.now;
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

    $.getJSON('/execute', {query_id: query_id, details:1}, function(querystatus) {
        var rawData = querystatus.details;
        data = rawData;
        var lane = 0;
        data.hierarchy.forEach(function(node) {
            lane = importTree(node, lane, 0);
        });
        draw();
    });
};

ganttChart('#chart', 9);
