var networkVisualization = function (element, fragments, queryStatus, linkAttr) {
    $('.title-current').html(templates.titleNetworkVis({src: fragments[0], dst: fragments[1]}));

    $(element.node()).empty();
    $(element.node()).append(templates.networkVisFrames);

    createViz();

    function createViz() {
        var matrixElement = element.select(".matrix");

        var     matMargin = {top: 150, right: 30, bottom: 10, left: 150},
                labelMargin = {top: 15, left: 15},
                axisMargin = {left: 30, bottom: 30, right: 30},
                width = parseInt(matrixElement.style('width'), 10) - 30,
                height = width,
                matrixWidth = width - matMargin.left - matMargin.right,
                matrixHeight = height - matMargin.top - matMargin.bottom,
                barChartHeight = 130;

        var columnScale = d3.scale.ordinal()
            .rangeBands([0, matrixWidth], 0.1, 0);

        var rowScale = d3.scale.ordinal()
            .rangeBands([0, matrixHeight], 0.1, 0);

        var barHeight = d3.scale.linear()
            .range([barChartHeight, 0]);

        //append the svg for matrix
        var wsvg = matrixElement.append("svg")
            .attr("width", width)
            .attr("height", height);

        var svg = wsvg.append("g")
            .attr("transform", "translate(10, 10)")
            .attr("class", "matrix-chart");

        var colBarChart = svg.append("g")
            .attr("class", "bars")
            .attr("transform", "translate(" + matMargin.left + "," + 0 + ")");

        var rowBarChart = svg.append("g")
            .attr("class", "bars")
            .attr("transform", "translate(" + 0 + "," + matMargin.top + ")");

        var matrixChart = svg.append("g")
            .attr("class", "mat-chart")
            .attr("transform", "translate(" + matMargin.left + "," + matMargin.top + ")");

        var colLabel = matrixChart.append('text')
            .text('destination worker')
            .attr("font-family", "sans-serif")
            .attr("font-size", "11px")
            .style("text-anchor", "middle")
            .attr('x', matrixWidth/2)
            .attr('y', labelMargin.top - matMargin.top);

        var rowLabel = matrixChart.append('text')
            .text('source worker')
            .attr("font-family", "sans-serif")
            .attr("font-size", "11px")
            .style("text-anchor", "middle")
            .attr("dy", ".71em")
            //.attr('y', width - matMargin.bottom - labelMargin.bottom - 15)
            //.attr('x', -labelMargin.left - 5);
            .attr('transform', 'translate(' + [labelMargin.left - matMargin.left, matrixHeight/2] + ") rotate(-90)");

        var rawMatrix = matrixChart.append('g')
              .attr('class','matrix');

        var tickCol = matrixChart.append('g')
            .attr('class','ticks')
            .attr('transform', 'translate(0 ,' + (-4) + ')');

        var tickRow = matrixChart.append('g')
            .attr('class','ticks')
            .attr('transform', 'translate(' + (-4) + ', 0)');

        // download data
        var fragmentId = fragments[0];
        var url = templates.urls.sentData({
            myria: myriaConnection,
            query: queryStatus.queryId,
            subquery: queryStatus.subqueryId,
            fragment: fragmentId
        });

        d3.csv(url, function(d) {
            d.numTuples = +d.numTuples;
            return d;
        }, function (data) {
            var summary = {
                    numTuples: 0,
                    localTuples: 0
                },
                sources = {},
                destinations = {};

            data = _.map(data, function(d) {
                if (!(d.src in sources)) {
                    sources[d.src] = 0;
                }
                sources[d.src] += +d.numTuples;

                if (!(d.dest in destinations)) {
                    destinations[d.dest] = 0;
                }
                destinations[d.dest] += +d.numTuples;

                summary.numTuples += d.numTuples;
                if (d.src == d.dest) {
                    summary.localTuples += d.numTuples;
                }
                d.pixelID = '' + d.src + '_' + d.dest;
                return d;
            });

            // Dan NB: we could also get numTuples from linkAttr.
            // .. I did verify that they match for q46220 and q59564
            summary.duration = linkAttr.duration;

            updateSummary(element.select(".summary"), summary);

            sourceList = _.map(_.pairs(sources), function(d) {return {id: +d[0], numTuples: d[1]}; });
            destinationList = _.map(_.pairs(destinations), function(d) {return {id: +d[0], numTuples: d[1]}; });

            draw(data, sourceList, destinationList, 'id');
        });

        var initial = true;

        function draw(rawData, sourceList, destinationList, orderBy) {
            sourceList = _.sortBy(sourceList, function(d) {return d[orderBy];});
            destinationList = _.sortBy(destinationList, function(d) {return d[orderBy];});
            var data = _.values(rawData),
                sources = _.pluck(sourceList, "id"),
                destinations = _.pluck(destinationList, "id"),
                both = destinationList.concat(sourceList);
            rowScale.domain(sources);
            columnScale.domain(destinations);

            var maxValue = d3.max(data, function(d) { return d.numTuples; });

            var color = chroma.scale('BuPu').domain([0, maxValue]).correctLightness(true).mode('lab');

            barHeight.domain([0, d3.max(both, function(d) { return d.numTuples; })])

            var delayFunction = function(d, i) { return initial ? 0 : i * delayTime; };

            var pixel = rawMatrix
                .selectAll('rect.pixel')
                .data(data, function(d) {
                    return d.pixelID;
                });

            pixel.enter()
                .append('rect')
                .attr('class', 'pixel')
                .attr('width', columnScale.rangeBand())
                .attr('height', rowScale.rangeBand())
                .style('fill',function(d){
                    // access value
                    return color(d.numTuples);})
                .tooltip(function(d) {
                    return templates.nwTooltip({
                        numTuples: largeNumberFormat(d.numTuples),
                        src: d.src,
                        dest: d.dest
                    });
                });

            pixel
                .attr("opacity", 0)
                .attr('y', function(d){
                    return rowScale(d.src);})
                .attr('x', function(d){
                    return columnScale(d.dest);})
                .transition()
                .duration(shortDuration)
                .delay(initial ? 0 : _.max([sources.length, destinations.length]) * delayTime + longDuration)
                .attr("opacity", 1);

            function addColTick(selection) {
                selection
                    .append('text')
                    .style('text-anchor', 'left')
                    .style("alignment-baseline", "middle")
                    .attr('class','tick')
                    .attr("transform", "rotate(-90)");
            }

            function addRowTick(selection) {
                selection
                    .append('text')
                    .attr('class','tick')
                    .style("alignment-baseline", "middle")
                    .style('text-anchor', 'end');
            }
            var tickColEl = tickCol.selectAll('text.tick')
                .data(destinations, function(d) { return d; });

            tickColEl.enter().call(addColTick);

            tickColEl.exit().remove();

            tickColEl
                .text(function(d){ return d; })
                .transition()
                .duration(longDuration)
                .delay(delayFunction)
                .attr('y', function(d){ return columnScale(d) + columnScale.rangeBand()/2; });

            var tickRowEl = tickRow.selectAll('text.tick')
                .data(sources, function(d) { return d; });

            tickRowEl.enter().call(addRowTick);

            tickRowEl
                .text(function(d){ return d; })
                .transition()
                .duration(longDuration)
                .delay(delayFunction)
                .attr('y', function(d){return rowScale(d)  + rowScale.rangeBand()/2;});

            tickRowEl.exit().remove();

            /* Col bar chart */
            var colBar = colBarChart.selectAll("rect")
                .data(destinationList, function(d) { return d.id; });

            colBar.enter().append("rect")
                .tooltip(function(d) {
                    return templates.barTooltip({ numTuples: d.numTuples, worker: d.id });
                })
                .attr("width", columnScale.rangeBand())
                .attr("height", function(d) { return barChartHeight - barHeight(d.numTuples); })
                .attr("y", function(d) { return barHeight(d.numTuples); });

            colBar
                .transition()
                .duration(longDuration)
                .delay(delayFunction)
                .attr("x", function(d) { return columnScale(d.id); });


            /* Row bar chart */
            var rowBar = rowBarChart.selectAll("rect")
                .data(sourceList, function(d) { return d.id; });

            rowBar.enter().append("rect")
                .tooltip(function(d) {
                    return templates.barTooltip({ numTuples: d.numTuples, worker: d.id });
                })
                .attr("height", rowScale.rangeBand())
                .attr("width", function(d) { return barChartHeight - barHeight(d.numTuples); })
                .attr("x", function(d) { return barHeight(d.numTuples); });

            rowBar
                .transition()
                .duration(longDuration)
                .delay(delayFunction)
                .attr("y", function(d) { return rowScale(d.id); });


            // average lines
            var avgX = d3.mean(sourceList, function(d) { return d.numTuples; });
            var avgY = d3.mean(destinationList, function(d) { return d.numTuples; });

            colBarChart.select("line.average").remove();
            colBarChart.append("line")
                .attr("class", "average")
                .attr("x1", 0)
                .attr("y1", barHeight(avgY))
                .attr("x2", matrixWidth)
                .attr("y2", barHeight(avgY))
                .tooltip("average " + d3.round(avgY, 1));

            rowBarChart.select("line.average").remove();
            rowBarChart.append("line")
                .attr("class", "average")
                .attr("y1", 0)
                .attr("x1", barHeight(avgX))
                .attr("y2", matrixHeight)
                .attr("x2", barHeight(avgX))
                .tooltip("average " + d3.round(avgX, 1));

            // axes
            var xAxis = d3.svg.axis().scale(barHeight).ticks(_.min([4, maxValue])).tickFormat(d3.format("s")).orient("top");
            var yAxis = d3.svg.axis().scale(barHeight).ticks(_.min([4, maxValue])).tickFormat(d3.format("s")).orient("left");

            svg.append("g")
                .attr("class", "x axis")
                .attr("transform", "translate(0, " + (matMargin.top - 2) + ")")
                .call(xAxis);

            svg.append("g")
                .attr("class", "y axis")
                .attr("transform", "translate(" + (matMargin.left - 2) + ",0)")
                .call(yAxis);

            /* Controls */

            var controls = element.select(".controls");
            $(controls.node()).empty();

            controls.append("label").text("Order by: ");

            var sel = controls.append("select")
                .attr("class", "form-control")
                .on("change", function() {
                    draw(rawData, sourceList, destinationList, this.value);
                });

            sel.append("option").attr("value", "id").text("Worker name");
            var o = sel.append("option").attr("value", "numTuples").text("# of Tuples");
            if (orderBy == 'numTuples') {
                o.attr("selected", "selected");
            }

            /* Legend */
            var lsvg = controls.append("svg")
                .style("height", "40")
                .style("width", "500")
                .attr("id", "legend")
                .attr("class", "pull-right");

            colorlegend("#legend", color, "linear", { fill: true, linearBoxes: _.min([10, maxValue + 1]), title: "Number of tuples sent or received" });

            initial = false;
        }
    }

    // return variables that are needed outside this scope
    return {
        update: function(fragments) {
            debug("I should update the chord chart now");
           // TODO: implement
        }
    };
};

var updateSummary = function(element, summary) {
    var items = "";
    items += templates.defItem({key: "# Tuples", value: Intl.NumberFormat().format(summary.numTuples)});
    items += templates.defItem({key: "Local tuples sent", value: Intl.NumberFormat().format(summary.localTuples)});
    items += templates.defItem({key: "Duration", value: customFullTimeFormat(summary.duration, false)});
    items += templates.defItem({key: "Tuples per second", value: (summary.numTuples / summary.duration * 1000000).toFixed(3)});
    var dl = templates.defList({items: items});
    $(element.node()).html(dl);
};
