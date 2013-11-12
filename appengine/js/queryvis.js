var margin = {top: 20, right: 20, bottom: 40, left: 30},
    treeWidth = 200,
    width = 1000 - margin.left - margin.right,
    height = 400 - margin.top - margin.bottom,
    chartWidth = width - treeWidth;

var animationDuration = 750;

var color = d3.scale.category10();

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

var svg = d3.select('#fragment').append("svg")
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

chart.append('text')
    .attr({'id': 'xLabel', 'x': chartWidth/2, 'y': height + margin.bottom*2/3, 'text-anchor': 'middle'})
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

chart.append('line')
    .attr('y1', 0)
    .attr('y2', height)
    .attr('class', 'nowLine');

var eventdata = [];

function falatten(operators, depth) {}

function load(data) {
    var qf = JSON.parse(JSON.stringify(data));
    var beginDate = new Date(qf.begin),
        nowDate = new Date(qf.now);

    qf.operators = qf.operators.filter(function(d) {
        return d.visible;
    });

    x.domain([beginDate, nowDate]);
    y.domain(qf.operators.map(function(d) { return d.name; }));

    eventdata = [];

    qf.operators.forEach(function(operator) {
        operator.events.combined.forEach(function(event) {
            var end = event.end;
            if (end)
                end = new Date(end);
            eventdata.push({
                "oid": operator.name,
                "type": event.type,
                "begin": new Date(event.begin),
                "end": end
            });
        });
    });

    /* Lanes */

    // use an index function to identify events
    var lane = lanes.selectAll("rect")
        .data(eventdata, function(d) { return d.oid + d.begin.getTime(); });

    lane.enter().append("rect")
        .style("opacity", 0)
        .attr("clip-path", "url(#clip)")
        .style("fill", function(d) { return color(d.type); })
        .attr('class', 'lane');

    lane
        .transition()
        .duration(animationDuration)
        .attr("x", function(d) {
            return x(d.begin);
        })
        .attr("y", function(d) {
            return y(d.oid);
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

    lane.exit()
        .transition()
        .duration(animationDuration)
        .style("opacity", 0)
        .remove();

    /* Titles */

    // use an index function to identify operators
    var title = svg.selectAll("g.label")
        .data(qf.operators, function(d) { return d.index; });

    var titleEnter = title.enter()
        .append("g")
        .style("opacity", 0)
        .attr("transform", function(d) { return "translate(" + (20 * d.depth) + "," + (y(d.name) + y.rangeBand()/2) + ")"; })
        .style("text-anchor", "begin")
        .attr("class", "label")
        .style("cursor", function(d) {
            if (d.hasChildren) {
                return "pointer";
            }
        })
        .on("click", function(d) {
            laneClick(d, data);
        });

    titleEnter.append("text")
        .attr("class", "title");

    titleEnter.append("text")
        .attr("dx", -18)
        .attr("font-family", "Glyphicons Halflings")
        .attr("font-size", "16px")
        .attr("width", 20)
        .attr("height", 20)
        .attr("dy", 8)
        .attr("class", "icon");

    titleEnter.append("text")
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
            return "translate(" + dx + "," + (y(d.name) + y.rangeBand()/2) + ")";
        });

    title.select("text.icon")
        .text(function(d) {
            if (d.hasChildren) {
                return "\ue080";
            }
        })
        .attr("class", "icon");

    title.select("text.title")
        .text(function(d) {
            return d.name;
        })
        .attr("class", "title");

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
    //svg.select("g.y.axis").transition().call(yAxis);
}

function laneClick(d, data) {
    // toggle visibility of all direct children
    var index = d.index + 1,
        depth = d.depth;
    var hide = data.operators[index].visible;
    for (; index < data.operators.length && data.operators[index].depth > depth; index++) {
        if (hide) {
            if (data.operators[index].depth > depth) {
                data.operators[index].visible = false;
            }
        } else {
            if (data.operators[index].depth === depth + 1) {
                data.operators[index].visible = true;
            }
        }
    }
    load(data);
}

$.getJSON('/execute', {query_id: 9, details:1}, function(querystatus) {
    var data = querystatus.details;
    // set the index, visible and hasChildren fields
    var i = 0;
    data.operators.forEach(function(operator) {
        operator.visible = operator.depth === 0;
        operator.index = i++;
        if (data.operators.length > i) {
            operator.hasChildren = data.operators[i].depth > data.operators[operator.index].depth;
        } else {
            operator.hasChildren = false;
        }
    });

    load(data);
});
