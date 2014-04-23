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
                        pixelID: pixelID,
                        active: false
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

        var chart = timeSeriesChart(element.select('.lines'));

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
                .attr('class', function(d) {
                    return 'pixel' + (d.sumTuples ? ' can-click' : '');
                })
                .attr('width', columnScale.rangeBand())
                .attr('height', rowScale.rangeBand())
                .attr('id', function(d){
                    return "pixel_" + d.pixelID;})
                .style('fill',function(d){
                    // access value
                    return color(d.sumTuples);})
                .tooltip(function(d) {
                    return templates.nwTooltip({
                        sumTuples: largeNumberFormat(d.sumTuples),
                        src: d.src,
                        dest: d.dest
                    });
                })
                .on('click', function(d) {
                    if (d.sumTuples === 0)
                        return;
                    if (!d.active) {
                        chart.add(rawData, d.src, d.dest);
                        d3.select(this).attr("class", "pixel active");
                    } else {
                        chart.remove(d.src, d.dest);
                        d3.select(this)
                          .style("stroke", "none");
                    }
                    d.active = !d.active;
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
                    .on('click', function(d) {
                        pairs = [];
                        for (var i = 0; i < sources.length; i++) {
                            if (rawData[[sources[i], d]].sumTuples == 0)
                                continue;
                            pairs.push([sources[i], d]);
                            var id = '#pixel_' + sources[i] + '_' + d;
                            d3.select(id).attr("class", "pixel active");
                            d3.select(id).datum().active = true;
                        }
                        chart.batchAdd(rawData, pairs);
                    })
                    .attr("transform", "rotate(-90)");
            }

            function addRowTick(selection) {
                selection
                    .append('text')
                    .attr('class','tick')
                    .style("alignment-baseline", "middle")
                    .style('text-anchor', 'end')
                    .on('click', function(d) {
                        pairs = [];
                        for (var i = 0; i < destinations.length; i++) {
                            if (rawData[[d,destinations[i]]].sumTuples == 0)
                                continue;
                            pairs.push([d,destinations[i]]);
                            var id = '#pixel_' + d + '_' + destinations[i];
                            d3.select(id).attr("class", "pixel active");
                            d3.select(id).datum().active = true;
                        }
                        chart.batchAdd(rawData, pairs);
                    })
                    .on('mouseover', function(d) {
                        d3.select(this).style('cursor','pointer');
                    });
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

            controls.append("button")
                .attr('class', 'btn btn-primary pull-right')
                .text('clear selection')
                .on("click", function() {
                    chart.emptyActiveKeys();
                    chart.update();
                    for (var i = 0; i < sources.length; i++) {
                        for (var j = 0; j < destinations.length; j++) {

                            var id = '#pixel_' + sources[i] + '_' + destinations[j];
                            d3.select(id).style("stroke", "none");
                            d3.select(id).datum().active = false;
                       }
                    }
                });

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

var timeSeriesChart = function(element) {
    var margin = {top: 20, right: 70, bottom: 50, left:60 },
        width = parseInt(element.style('width'), 10),
        height = 300,
        chartWidth = width - margin.left - margin.right,
        chartHeight = height - margin.top - margin.bottom;

    var x = d3.scale.linear()
         .range([0, chartWidth]);

    var y = d3.scale.linear()
        .range([chartHeight, 0]);

    var xAxis = d3.svg.axis()
        .tickFormat(customTimeFormat)
        .tickSize(-chartHeight)
        .scale(x)
        .orient("bottom");

    var yAxis = d3.svg.axis()
        .scale(y)
        .orient("left");

    var chart = element.append("svg")
            .attr("width", width)
            .attr("height", height)
            .attr("class", "timeseries")
        .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    chart.append("text")
      //.attr("x", 5)
      //.attr("y", height - margin.bottom - 20)
      .attr("font-family", "sans-serif")
      .attr("font-size", "10px")
      .style("text-anchor", "start")
      .attr('transform', 'translate(' + [-margin.left/(1.3),height - margin.bottom - 20] + ") rotate(-90)")
      .text("number of tuples");

    chart.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0, " + chartHeight + ")")
        .call(xAxis);

    chart.append("g")
         .attr("class", "y axis")
         .call(yAxis);

    var line = d3.svg.line()
        //.interpolate('cardinal')
        .x(function(d) { return x(d[0]); })
        .y(function(d) { return y(d[1]); });

    var activeKeys = [];
    var rawData = {};

    function add(newRawData, src, dest) {
        //pixel is a selection
        rawData = newRawData;
        activeKeys.push([src,dest]);
        draw();
    }

    function emptyActiveKeys() {
        activeKeys = [];
    }

    function batchAdd(newRawData, pairs) {

        rawData = newRawData;
        for (var i = 0; i < pairs.length; i++) {
            var exists = false;
            for (var j = 0; j < activeKeys.length; j++) {
              if (activeKeys[j][0]==pairs[i][0] && activeKeys[j][1]==pairs[i][1]) {
                  exists = true;
                  break;
              }
            }
            if (!exists)
                activeKeys.push(pairs[i]);
        }
        draw();
    }

    function remove(src, dest) {
        // remove from array O(n)
        var indexToRemove = -1;
        for (var i = 0; i < activeKeys.length; i++) {
            if (activeKeys[i][0]==src && activeKeys[i][1]==dest) {
                indexToRemove = i;
                break;
            }
        }
        activeKeys.splice(indexToRemove, 1);
        draw();
    }

    function getDist(x1,x2,y1,y2) {

        var xs = x1 - x2;
        xs = xs * xs;

        var ys = y1 - y2;
        ys = ys * ys;

        return Math.sqrt( xs + ys );
    }

    function getNearestPointOnLine(points, x, y) {

        var minDist = Number.MAX_VALUE;
        var minPoint, d;
        for (var i = 0; i < points.length; i++) {

            d = getDist(points[i][0], x, points[i][1], y);
            if (d < minDist) {
                minDist = d;
                minPoint = i;
            }
        }
        return minPoint;
    }

    // shows text about what to do
    var toDelete;

    function draw() {
        var chartData = _.values(_.pick(rawData, activeKeys));

        if (chartData.length == 0) {
            toDelete = chart.append("text")
                .text("Select a communication from the matrix.")
                .attr("x", chartWidth/2)
                .attr("y", chartHeight/2)
                .attr("text-anchor", "middle")
                .attr("class", "help-text");
        } else {
            toDelete.remove();
        }

        // don't update domain when last is removed
        if (activeKeys.length > 0) {
            var xDomain = [d3.min(_.pluck(chartData, 'begin')), d3.max(_.pluck(chartData, 'end'))],
                yDomain = [0, d3.max(_.pluck(chartData, 'maxTuples'))];

            x.domain(xDomain);
            y.domain(yDomain);

            /*
            var legend = chart.selectAll(".legend")
            .data(activeKeys)
            .enter().append("g")
            .attr("class", "legend")
            .attr("transform", function(d, i) { return "translate(0" + "," + (100 + i*10) + ")"; });

            legend.append("rect")
            .attr("x", 100)
            .attr("width", 10)
            .attr("height", 10)
            .style("fill", opColors);
            */
        }

        chart.selectAll(".y.axis")
            .transition(animationDuration)
            .call(yAxis);

        chart.selectAll(".x.axis")
            .transition(animationDuration)
            .call(xAxis);

        var pair = chart.selectAll(".pair")
            .data(chartData, function(d) { return [d.src, d.dest]; });

        var pairGroups = pair.enter().append("g")
            .attr("class", "pair");

        pairGroups.append("path")
            .on("mouseover", function(d) {
                d3.select("#pixel_" + d.pixelID)
                  .style("stroke-width",'5px');
              })
            .on("mouseout", function(d) {
                d3.select(this)
                  .style("stroke-width",'3px');

                d3.select("#pixel_" + d.pixelID)
                  .style("stroke-width", "3px");
            })
            .style("stroke-width", 3)
            .style("stroke", function(d,i) {
                d3.select("#pixel_" + d.pixelID)
                  .style("stroke", opColors(i));

                return opColors(i);
            })
            .attr("stroke-dasharray", function(d) {
                return (d.src != d.dest) ? ("0, 0") : ("3, 3");
            })
            .attr("class", "tsline");

        pairGroups.append("text")
            .attr("class", "line-label")
            .attr("dy", ".35em")
            .attr("dx", "8px")
            .text(function(d) {
                return templates.nwLineTooltip(d);
            });

        pair.transition(animationDuration).selectAll(".tsline")
            .attr("d", function(d) { return line(d.values); });

        pair.transition(animationDuration).selectAll(".line-label")
            .attr("x", function(d) { return x(_.last(d.values)[0]); })
            .attr("y", function(d) { return y(_.last(d.values)[1]); });

        pair.exit().remove();

        var dot = pair.selectAll("circle")
            .data(function(d) {
                return d.values;
            });

        dot.enter()
            .append("circle")
            .attr("r", 5);

        dot.attr("cx", function(d) {
                return x(d[0]);
            }).attr("cy", function(d) {
                return y(d[1]);
            }).tooltip(function(d) {
                return templates.nwPointTooltip({
                    numTuples: d[1],
                    time: customFullTimeFormat(d[0])
                });
            });
    }

    draw()

    return {
        update: draw,
        add: add,
        batchAdd: batchAdd,
        remove: remove,
        emptyActiveKeys: emptyActiveKeys
    };
};
