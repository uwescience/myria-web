var networkVisualization = function (element, fragments, queryPlan) {
	createViz(fragments);

    function createViz(fragments) {
        //initialize the visualization
        var     matMargin = {top: 10, right: 10, bottom: 10, left:10 },
                labelMargin = {top: 30, right: 20, bottom: 20, left:30 },
                axisMargin = {left: 30, bottom: 30, right: 30},
                totalWidth = parseInt(element.style('width'), 10),
                totalMatrixWidth = 550;

        var columnScale = d3.scale.ordinal()
            .rangeBands([0, totalMatrixWidth - matMargin.right - matMargin.left - labelMargin.right], .1);

        var rowScale = d3.scale.ordinal()
            .rangeBands([0, totalMatrixWidth - matMargin.right - matMargin.left - labelMargin.right], .1);

        var color = d3.scale.linear()
                .range(["#FFF7F3", "#49006A"])
                .interpolate(d3.interpolateLab);

        //append the svg for matrix
        var matrixChart = element.append("svg")
                .attr("width", totalMatrixWidth)
                .attr("height", totalMatrixWidth)
            .append("g")
                .attr("transform", "translate(" + matMargin.left + "," + matMargin.top + ")");

        var rawMatrix = matrixChart.append('g')
              .attr('class','matrix')
            .attr("transform", "translate(" + labelMargin.left + "," + labelMargin.top + ")");

        var tickCol = matrixChart.append('g')
            .attr('class','ticks')
            .attr('transform', 'translate(' + (matMargin.left + labelMargin.left) + ',' + labelMargin.top + ')');

        var tickRow = matrixChart.append('g')
            .attr('class','ticks')
            .attr('transform', 'translate(' + (labelMargin.left) + ',' + (matMargin.top + labelMargin.top) + ')');

        // create time series graph
        var chart = timeSeriesChart(element);

        // download data
    	var fragmentId = fragments[0];
    	var url = templates.urls.sentData({
        	myria: myriaConnection,
        	query: queryPlan.queryId,
        	fragment: fragmentId
    	});

    	d3.csv(url, function (data) {
		    var dataset = {},
                sources = [],
                destinations = [];

            // column representation to safe space
  			data.forEach(function(d) {
    			var source = d.workerId;
    			var dest = d.destWorkerId;
                var key = [source,dest];
                if (!(key in dataset)) {
                    dataset[key] = {
                        nanoTime: [],
                        numTuples: [],
                        sumTuples: 0,
                        src: source,
                        dest: dest,
                        active: false
                    }
                }
                dataset[key].nanoTime.push(+d.nanoTime);
                dataset[key].numTuples.push(+d.numTuples);
                dataset[key].sumTuples += +d.numTuples;
                sources.push(source);
                destinations.push(dest);
  			});

            sources = _.uniq(sources);
            destinations = _.uniq(destinations);

    		draw(dataset, _.sortBy(sources, function(d) {return d;}), _.sortBy(sources, function(d) {return d;}));
    	});

        function draw(rawData, sources, destinations) {
            var data = _.values(rawData);
            rowScale.domain(sources);
            columnScale.domain(destinations);

            var maxValue = d3.max(data, function(d) { return d.sumTuples; });
            color.domain([0, maxValue]);

            var pixel = rawMatrix
                .selectAll('rect.pixel')
                .data(data);

            pixel.enter()
                .append('rect')
                .attr('class', 'pixel');

            pixel.attr('width', columnScale.rangeBand())
                .attr('height', rowScale.rangeBand())
                .attr('y', function(d){
                    return rowScale(d.src);})
                .attr('x', function(d){
                    return columnScale(d.dest);})
                .style('fill',function(d){
                    // access value
                    return color(d.sumTuples);})
                .tooltip(function(d) {
                    return templates.nwTooltip(d);
                })
                .on('click', function(d) {
                    if (!d.active) {
                        chart.add(rawData, d.src, d.dest);
                        d3.select(this).attr("class", "pixel active");
                    } else {
                        chart.remove(d.src, d.dest);
                        d3.select(this).attr("class", "pixel");
                    }
                    d.active = !d.active;
                });

            function addTick(selection) {
                selection
                    .append('text')
                    .attr('class','tick')
                    .style('text-anchor', 'end');
            }

            var matLabelTextScale = d3.scale.linear()
                .domain([0, totalMatrixWidth])
                .range([0, 140]);

            var tickColEl = tickCol.selectAll('text.tick')
                .data(destinations);

            tickColEl.enter().call(addTick);

            tickColEl.exit().remove();

            tickColEl.style('text-anchor', 'start')
                //.attr('transform', function(d, i){return 'rotate(270 ' + scale(order_col[i] + 0.7) + ',0)';})
                .attr('font-size', matLabelTextScale(columnScale.rangeBand()))
                .text(function(d){ return d; })
                .attr('x', function(d){ return columnScale(d); });

            var tickRowEl = tickRow.selectAll('text.tick')
                .data(sources);

            tickRowEl.enter().call(addTick);

            tickRowEl.attr('font-size', matLabelTextScale(rowScale.rangeBand()))
                .text(function(d){ return d; })
                .attr('y', function(d){return rowScale(d);});

            tickRowEl.exit().remove();
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

var timeSeriesChart = function (element) {
    var margin = {top: 20, right: 50, bottom: 50, left:50 },
        width = parseInt(element.style('width'), 10),
        height = 400,
        chartWidth = width - margin.left - margin.right,
        chartHeight = height - margin.top - margin.bottom;

    var x = d3.scale.linear()
         .range([0, chartWidth]);

    var y = d3.scale.linear()
        .range([chartHeight, 0]);

    var xAxis = d3.svg.axis()
        .tickFormat(customTimeFormat)
        .tickSize(-height)
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

    chart.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," +  (height - margin.bottom) + ")")
        .call(xAxis);

    chart.append("g")
         .attr("class", "y axis")
         .call(yAxis);

    chart.append("path")
        .attr("class", "tsline");

    var line = d3.svg.line()
        //.interpolate('cardinal')
        .x(function(d) { return x(d[0]); })
        .y(function(d) { return y(d[1]); });

    var data = {};

    function add(rawData, src, dest) {
        var newData = rawData[[src, dest]];
        chartData = _.zip(newData.nanoTime, newData.numTuples);
        data[[src, dest]] = {
            src: src,
            dest: dest,
            maxTuples: d3.max(newData.numTuples),
            begin: d3.min(newData.nanoTime),
            end: d3.max(newData.nanoTime),
            values: chartData
        };
        draw();
    }

    function remove(src, dest) {
        delete data[[src, dest]];
        draw();
    }

    function draw() {
        var chartData = _.values(data);
        var xDomain = [d3.min(_.pluck(chartData, 'begin')), d3.max(_.pluck(chartData, 'end'))],
            yDomain = [0, d3.max(_.pluck(chartData, 'maxTuples'))];
        x.domain(xDomain);
        y.domain(yDomain);

        chart.selectAll(".y.axis")
            .transition(animationDuration)
            .call(yAxis)

        chart.selectAll(".x.axis")
            .transition(animationDuration)
            .call(xAxis);

        var pair = chart.selectAll(".pair")
            .data(chartData, function(d) {return [d.src, d.dest]});

        var pairGroups = pair.enter().append("g")
            .attr("class","pair");

        pairGroups.append("path")
            .attr("class", "tsline");

        pair.transition(animationDuration).selectAll(".tsline")
            .attr("d", function(d) {return line(d.values); });

        pair.exit().remove();
    }

    return {
        update: draw,
        add: add,
        remove: remove
    }
};
