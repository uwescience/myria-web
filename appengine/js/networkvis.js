var networkVisualization = function (element, fragments, queryPlan) {
	createViz(fragments);

    function createViz(fragments) {
        //initialize the visualization
        var     matMargin = {top: 10, right: 10, bottom: 10, left:10 },
                labelMargin = {top: 30, right: 20, bottom: 20, left:30 },
                axisMargin = {left: 30, bottom: 30, right: 30},
                totalWidth = parseInt(element.style('width'), 10),
                totalMatrixWidth = 550;

        var matrixScale = d3.scale.ordinal()
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
		var matrix = [],
		        workers = new Object(),
			    dataset = [];

  			data.forEach(function(d) {
    			var source = d.workerId;
    			var dest = d.destWorkerId;
    			workers[source] = true;
    			workers[dest] = true;
    			dataset.push(d);
  			});

			var src2dst2ts = d3.nest()
      				.key(function(d) { return d.workerId; })
      				.key(function(d) { return d.destWorkerId; })
      				.entries(dataset);

      		var workers = d3.keys(workers);
      		workerID2matrixID = new Object();
      		matrixID2workerID = new Object();
  			matrix = new Array(workers.length);
  			for (var i = 0; i < matrix.length; i++) {
  				workerID2matrixID[workers[i]] = i;
  				matrixID2workerID[i] = workers[i];
    			matrix[i] = new Array(workers.length);
    			for (var j = 0; j < matrix[i].length; j++) {
      				matrix[i][j] = 0;
    			}
  			}

  			dataset.forEach(function(d) {
    			var src = d.workerId;
    			var dst = d.destWorkerId;

    			matrix[workerID2matrixID[src]][workerID2matrixID[dst]] += (+d.numTuples);
  			});

		draw(workers, matrix, matrixID2workerID, src2dst2ts);
    	});

        function draw(workers, matrix, matrixID2workerID, src2dst2ts) {
            var corr_data = [],
                    max = 0;
            for(var i = 0; i < matrix.length; i++){
                    for(var j = 0; j < matrix[0].length; j++){
                    var val = matrix[i][j];
                    corr_data.push({i:i, j:j, val:val});
                    max = Math.max(max, val);
                }
            }

            matrixScale.domain(_.range(matrix.length));
            color.domain([0,max]);


            var pixel = rawMatrix.selectAll('rect.pixel').data(corr_data);

            pixel.enter()
                .append('rect')
                .attr('class', 'pixel');

            pixel.attr('width', matrixScale.rangeBand())
                .attr('height', matrixScale.rangeBand())
                .attr('y', function(d){return matrixScale(d.i);})
                .attr('x', function(d){return matrixScale(d.j);})
                .style('fill',function(d){ return color(d.val);})
                .tooltip(function(d) {
                        //var content = boxTemplate({numTuples: d.val});
                    var src = matrixID2workerID[d.i];
                    var dst = matrixID2workerID[d.j];
                    return "total # of tuples: " + d.val;
                })
                .on('click', function(d){ chart.update(src2dst2ts, matrixID2workerID[d.i], matrixID2workerID[d.j]); });

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
                .data(workers);

            tickColEl.enter().call(addTick);

            tickColEl.exit().remove();

            tickColEl.style('text-anchor', 'start')
                //.attr('transform', function(d, i){return 'rotate(270 ' + scale(order_col[i] + 0.7) + ',0)';})
                .attr('font-size', matLabelTextScale(matrixScale.rangeBand()))
                .text(function(d){ return d; })
                .attr('x', function(d, i){return matrixScale(i);});

            var tickRowEl = tickRow.selectAll('text.tick')
                .data(workers);

            tickRowEl.enter().call(addTick);

            tickRowEl.attr('font-size', matLabelTextScale(matrixScale.rangeBand()))
                .text(function(d){ return d; })
                .attr('y', function(d, i){return matrixScale(i);});

            tickRowEl.exit().remove();
        }
    }

    // return variables that are needed outside this scope
    return {
        update: function(fragments) {
            //debug("I should update the chord chart now");
            updateViz(fragments);
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

    var area = d3.svg.area()
        .x(function(d) { return x(+d.nanoTime); })
        .y0(height - margin.bottom)
        .y1(function(d) { return y(+d.numTuples); });

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
        .x(function(d) { return x(+d.nanoTime); })
        .y(function(d) { return y(+d.numTuples); });

    var data = [];

    function draw(src2dst2ts, src, dst) {
        var data;

        for(var i = 0; i < src2dst2ts.length; i++) {
            if (src2dst2ts[i].key != src)
                continue;
            var dst2ts = src2dst2ts[i].values;
            for(var j = 0; j < dst2ts.length; j++) {
                if (dst2ts[j].key != dst)
                    continue;
                data = dst2ts[j].values;
            }
        }

        var maxTime = d3.max(data, function(d){ return +d.nanoTime; });
        var minTime = d3.min(data, function(d){ return +d.nanoTime; });
        var maxNumTuples = d3.max(data, function(d){ return +d.numTuples; });

        x.domain([minTime, maxTime]);
        y.domain([0, maxNumTuples]);

        chart.selectAll(".y.axis")
            .transition(animationDuration)
            .call(yAxis)

        chart.selectAll(".x.axis")
            .transition(animationDuration)
            .call(xAxis);

        // TODO: multi line: http://bl.ocks.org/mbostock/3884955

        chart.selectAll("path.tsline")
           .datum(data)
           .transition(animationDuration)
           .attr("d", function(d) { return line(d); });
    }

    return {
        update: draw
    }
};
