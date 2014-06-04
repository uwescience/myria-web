var networkVisualization = function (element, fragments, queryPlan) {
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
        var svg = matrixElement.append("svg")
                .attr("width", width)
                .attr("height", height)
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
            query: queryPlan.queryId,
            fragment: fragmentId
        });

        d3.csv(url, function (data) {
            var dataset = {},
                summary = {
                    numTuples: 0,
                    localTuples: 0
                },
                sources = {},
                destinations = {};

            // column representation to safe space
            data.forEach(function(d,i) {
                var source = +d.workerId;
                var dest = +d.destWorkerId;
                var pixelID = '' + source + '_' + dest;
                var key = [source, dest];
                if (!(key in dataset)) {
                    dataset[key] = {
                        nanoTime: [],
                        numTuples: [],
                        sumTuples: 0,
                        src: source,
                        dest: dest,
                        pixelID: pixelID
                    };
                }
                dataset[key].nanoTime.push(+d.nanoTime);
                dataset[key].numTuples.push(+d.numTuples);
                dataset[key].sumTuples += +d.numTuples;

                if (!(source in sources)) {
                    sources[source] = 0;
                }
                sources[source] += +d.numTuples;
                if (!(dest in destinations)) {
                    destinations[dest] = 0;
                }
                destinations[dest] += +d.numTuples;
            });

            _.each(dataset, function(d) {
                d.maxTuples = d3.max(d.numTuples);
                d.begin = d3.min(d.nanoTime);
                d.end = d3.max(d.nanoTime);
                d.values = _.zip(d.nanoTime, d.numTuples);
                delete d.nanoTime;
                delete d.numTuples;

                summary.numTuples += d.sumTuples;
                if (d.src == d.dest) {
                    summary.localTuples += d.sumTuples;
                }
            });

            summary.duration = _.max(_.pluck(dataset, 'end')) - _.min(_.pluck(dataset, 'begin'));

            updateSummary(element.select(".summary"), summary);

            sourceList = _.map(_.pairs(sources), function(d) {return {id: +d[0], numTuples: d[1]}; });
            destinationList = _.map(_.pairs(destinations), function(d) {return {id: +d[0], numTuples: d[1]}; });

            _.each(sourceList, function(source) {
                _.each(destinationList, function(dest) {
                    var pixelID = '' + source.id + '_' + dest.id;
                    var key = [source.id, dest.id];
                    if (!(key in dataset)) {
                        dataset[key] = {
                            sumTuples: 0,
                            src: source.id,
                            dest: dest.id,
                            pixelID: pixelID
                        };
                    }
                });
            });

            draw(dataset, sourceList, destinationList, 'id');
        });

        var initial = true;

        function draw (rawData, sourceList, destinationList, orderBy) {
            sourceList = _.sortBy(sourceList, function(d) {return d[orderBy];})
            destinationList = _.sortBy(destinationList, function(d) {return d[orderBy];})
            var data = _.values(rawData),
                sources = _.pluck(sourceList, "id"),
                destinations = _.pluck(destinationList, "id"),
                both = destinationList.concat(sourceList);
            rowScale.domain(sources);
            columnScale.domain(destinations);

            var maxValue = d3.max(data, function(d) { return d.sumTuples; });

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
                .attr('width', columnScale.rangeBand())
                .attr('height', rowScale.rangeBand())
                .style('fill',function(d){
                    // access value
                    return color(d.sumTuples);})
                .tooltip(function(d) {
                    return templates.nwTooltip({
                        sumTuples: largeNumberFormat(d.sumTuples),
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
            var avg = d3.mean(destinationList, function(d) { return d.numTuples; });

            colBarChart.select("line.average").remove();
            colBarChart.append("line")
                .attr("class", "average")
                .attr("x1", 0)
                .attr("y1", barHeight(avg))
                .attr("x2", matrixWidth)
                .attr("y2", barHeight(avg))
                .tooltip("average");

            rowBarChart.select("line.average").remove();
            rowBarChart.append("line")
                .attr("class", "average")
                .attr("y1", 0)
                .attr("x1", barHeight(avg))
                .attr("y2", matrixWidth)
                .attr("x2", barHeight(avg))
                .tooltip("average");

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
    items += templates.defItem({key: "# Tuples", value: summary.numTuples});
    items += templates.defItem({key: "Local tuples sent", value: summary.localTuples});
    items += templates.defItem({key: "Duration", value: customFullTimeFormat(summary.duration)});
    items += templates.defItem({key: "Tuples per second", value: (summary.numTuples / summary.duration * 1000000).toFixed(3)});
    var dl = templates.defList({items: items});
    $(element.node()).html(dl);
};
