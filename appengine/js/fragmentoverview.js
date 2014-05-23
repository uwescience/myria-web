var manyLineCharts = function(element, fragmentIds, queryPlan) {
    $('.title-current').html('');

    $(element.node()).empty();
    _.each(fragmentIds, function(fragmentId) {
        var div = element.append("div")
            .attr("class", "overview-fragment");
        div.append("span")
            .text(templates.fragmentTitle({fragment: fragmentId}));

        div.on("click", function(a) {
            d3.event.stopPropagation();
            graph.openFragment("Frag" + fragmentId);
        });
        var workers = queryPlan.physicalPlan.fragments[fragmentId].workers;
        var numWorkers = _.max(workers);
        lineChart(div, fragmentId, queryPlan, numWorkers);
    });

    // return variables that are needed outside this scope
    return {};
};

var lineChart = function(element, fragmentId, queryPlan, numWorkers) {
    var margin = {top: 10, right: 10, bottom: 20, left: 30 },
        width = parseInt(element.style('width'), 10) - margin.left - margin.right,
        height = 150 - margin.top - margin.bottom;

    var bisectTime = d3.bisector(function(d) { return d.time; }).right;

    var x = d3.scale.linear()
        .range([0, width]);

    var y = d3.scale.linear()
        .range([height, 0])
        .domain([0, numWorkers]);

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
        .x(function(d) { return x(d.nanoTime); })
        .y0(height)
        .y1(function(d) { return y(d.numWorkers); });

    var svg = element.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      .append("g")
        .attr("transform", "translate(" + (margin.left) + "," + margin.top + ")")
        .attr("class", "chart");

    svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("class", "background");

    svg.append("defs").append("clipPath")
        .attr("id", "chartclip")
      .append("rect")
        .attr("width", width)
        .attr("height", height + 10)
        .attr("y", -10);

    var wholeDomain;

    var url = templates.urls.histogram({
        myria: myriaConnection,
        query: queryPlan.queryId,
        fragment: fragmentId,
        start: 0,
        end: queryPlan.elapsedNanos,
        step: queryPlan.elapsedNanos/1000
    });

    $('body').on('changeRange', function(e, lower, upper) {
        if (wholeDomain == undefined || lower == undefined || isNaN(lower) || lower == -Infinity) {
            return;
        }

        var previousDomain = wholeDomain;
        wholeDomain = [_.min([lower, wholeDomain[0]]), _.max([upper, wholeDomain[1]])];
        if (previousDomain[0] != wholeDomain[0] || previousDomain[1] != wholeDomain[1]) {
            x.domain(wholeDomain);
            svg.select("g.x.axis").call(xAxis);
            svg.select("path.area").attr("d", area);
            $('body').trigger('changeRange', wholeDomain);
        }
    });

    d3.csv(url, function(d) {
        d.nanoTime = parseFloat(d.nanoTime, 10);
        d.numWorkers = +d.numWorkers;
        return d;
    }, function(error, data) {
        wholeDomain = d3.extent(data, function(d) { return d.nanoTime; });

        x.domain(wholeDomain);

        $('body').trigger('changeRange', wholeDomain);

        svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height + ")")
            .call(xAxis);

        svg.append("g")
            .attr("class", "y axis")
            .call(yAxis)
          .append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", -40)
            .attr("dy", ".71em")
            .style("text-anchor", "end")
            .text("Number of nodes working");

        svg.append("path")
            .attr("clip-path", "url(#chartclip)")
            .datum(data)
            .attr("class", "area")
            .attr("d", area);

        // put Time label on xAxis
        svg.append("g")
            .attr("transform", "translate(" + [width, height] + ")")
            .append("text")
            .attr("class", "axis-label")
            .attr({"x": - 6, "y": -12, "text-anchor": "middle"})
            .attr("dy", ".71em")
            .style("text-anchor", "end")
            .text("Time");

        svg.select("g.x.axis").call(xAxis);

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

            tttext.text(templates.chartTooltipTemplate({time: customFullTimeFormat(xValue), number: d0.numWorkers}));

            var bbox = tttext.node().getBBox();
            tooltip.select("rect")
                .attr("width", bbox.width + 10)
                .attr("height", bbox.height + 6)
                .attr("x", bbox.x - 5)
                .attr("y", bbox.y - 3);
        });
    });
};