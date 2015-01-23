var operatorVisualization = function (element, fragmentId, graph) {
    $(element.node()).empty();

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

    var idNameMapping = nameMappingFromFragments(graph.fragments);

    var margin = {top: 5, right: 5, bottom: 5, left: 5 },
        width = parseInt(element.style('width'), 10) - margin.left - margin.right,
        height = 60 - margin.top - margin.bottom;

    var x = d3.scale.linear()
        .range([0, width]);

    var svg = element.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
        .attr("class", "map");

    var url = templates.urls.contribution({
        myria: myriaConnection,
        query: graph.queryStatus.queryId,
        subquery: graph.queryStatus.subqueryId,
        fragment: fragmentId
    });

    d3.csv(url, function(d) {
        d.nanoTime = +d.nanoTime;
        return d;
    }, function(error, data) {
        var indexedData = _.object(_.map(data, function(x){ return [x.opId, x]; }));
        var rootTime = indexedData[hierarchy.id].nanoTime;
        data = _.map(data, function(d) {
            d.level = levels[d.opId];
            d.name = idNameMapping[d.opId];
            d.rawData = graph.nodes["f"+fragmentId].opNodes[d.opId].rawData;
            // contributions from children should be excluded
            var sumChildren = _.reduce(_.pluck(_.pick(indexedData, children[d.opId]), 'nanoTime'), function(a,b) { return a + b; }, 0);
            d.timeWithoutChildren = d.nanoTime - sumChildren;
            return d;
        });

        data = _.sortBy(data, 'level');

        var totalDomain = 0;
        data = _.map(data, function(d) {
            d.share = _.max([0.03, d.timeWithoutChildren/rootTime]);
            d.prevEnd = totalDomain;
            totalDomain += d.share;
            return d;
        });

        x.domain([0, totalDomain]);

        var op = svg.selectAll(".op").data(data)
          .enter().append("g")
            .attr("class", "op")
            .attr("transform", function(d) {
                return "translate("+ [x(d.prevEnd), 0] +")"
            });

        op.append("rect")
            .attr("width", function(d) { return x(d.share); })
            .attr("height", height)
            .style("fill", function(d) { return opToColor[d.opId]; });

        var bgRect = op.append("rect")
            .attr("class", "bg-rect")
            .attr("height", 36)
            .attr("x", 4)
            .attr("y", 8);

        op.append("circle")
            .attr("r", 4)
            .attr("cx", 4)
            .attr("cy", 8)
            .attr("class", "rect-info")
            .popover(function(d) {
                var body = templates.row({key: "Overall runtime", value: customFullTimeFormat(d.nanoTime, false)});
                body += templates.row({key: "Time spent in this operator", value: customFullTimeFormat(d.timeWithoutChildren, false)});
                _.each(d.rawData, function(value, key){
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
                    title: templates.strong({text: d.name}),
                    content: templates.table({body: body})
                };
            });

        op.append("text")
            .attr("dx", 7)
            .attr("dy", 20)
            .style("fill", "black")
            .text(function(d) { return d.name.substr(0, x(d.share)/5); });

        op.append("text")
            .attr("dx", 7)
            .attr("dy", 40)
            .style("fill", "black")
            .text(function(d) { return Math.round(100* d.timeWithoutChildren/rootTime) + " %"; });

        bgRect.attr("width", function(d) {
                return d3.select(this.parentNode).select("text").node().getBBox().width + 6;
            });

        op.on('mouseover', function(d) {
            d3.select(this).select("rect")
                .transition().duration(shortDuration)
                .style("fill", function(d) { return d3.rgb(opToColor[d.opId]).brighter(0.4); });
        });

        op.on('mouseout', function(d) {
            d3.select(this).select("rect")
                .transition().duration(animationDuration)
                .style("fill", function(d) { return opToColor[d.opId]; });
        });
    });

    // return variables that are needed outside this scope
    return {};
};
