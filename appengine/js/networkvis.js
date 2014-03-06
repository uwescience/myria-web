var networkVisualization = function (element, fragments, queryPlan) {
	var src2dst2ts;
    var dataset;
    var matrix;

    createViz(fragments);

    function createViz(fragments) {

    	var fragmentId = fragments[0];
    	var url = templates.urls.sentData({
        	myria: myriaConnection,
        	query: queryPlan.queryId,
        	fragment: fragmentId
    	});

    	url = "data/data.csv";
    	d3.csv(url, function (data) {
    		matrix = [],
  		    workers = new Object();
  			dataset = [];

  			data.forEach(function(d) {
    			var source = d.workerId;
    			var dest = d.destWorkerId;
    			workers[source] = true;
    			workers[dest] = true;
    			dataset.push(d);
  			});

  			src2dst2ts = d3.nest()
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

        	reDraw(workers,matrixID2workerID);
    	});
    }


    function drawTimeseries(src, dst, tsWidth, tsHeight, tsMargin) {

    	d3.select("#timeseries").remove();
 			   	
		var ts;
		for(var i = 0; i < src2dst2ts.length; i++) {
			if (src2dst2ts[i].key != src)
				continue;
			var dst2ts = src2dst2ts[i].values;
			for(var j = 0; j < dst2ts.length; j++) {
				if (dst2ts[j].key != dst)
					continue;
				ts = dst2ts[j].values;
			}
		}

		var maxTime = d3.max(ts, function(d){ return +d.nanoTime; });
		var minTime = d3.min(ts, function(d){ return +d.nanoTime; });
    	var maxNumTuples = d3.max(ts, function(d){ return +d.numTuples; });
     
		var x = d3.scale.linear()
        				.domain([minTime,maxTime])
    					.range([0, tsWidth - tsMargin.left - tsMargin.right]);

        var y = d3.scale.linear()
                        .domain([0,maxNumTuples])
                        .range([tsHeight - tsMargin.top - tsMargin.bottom, 0]);

        var xAxis = d3.svg.axis()
    				  .scale(x)
    				  .orient("bottom");

        var yAxis = d3.svg.axis()
    				  .scale(y)
    				  .orient("left");

        var line = d3.svg.line()
    		.x(function(d) { return x(+d.nanoTime); })
    		.y(function(d) { return y(+d.numTuples); });

        var tsChart = element.append("svg")
        	    .attr("width", tsWidth)
            	.attr("height", tsHeight)
            	.attr("id", "timeseries")
        	.append("g")
            	.attr("transform", "translate(" + tsMargin.left + "," + tsMargin.top + ")");

        tsChart.append("g")
      		.attr("class", "x axis")
      		.attr("transform", "translate(0," +  (tsHeight - tsMargin.bottom) + ")")
            .call(xAxis);

        tsChart.append("g")
             .attr("class", "y axis")
             .call(yAxis);

        tsChart.append("path")
      		.datum(ts)
      		.attr("class", "line")
      		.attr("d", line);

	}


    function reDraw(workers,matrixID2workerID) {

    	d3.selectAll("svg").remove();
    //initialize the visualization
    	var     matMargin = {top: 10, right: 10, bottom: 10, left:10 },
        	    labelMargin = {top: 20, right: 20, bottom: 20, left:20 },
        	    tsMargin = {top: 20, right: 50, bottom: 50, left:50 },
            	axisMargin = {left: 30, bottom: 30, right: 30},
        		totalWidth = parseInt(element.style('width'), 10),
        		totalHeight = 950,
        		totalMatrixWidth = 550,
        		totalTSWidth = totalWidth,
        		totalTSHeight = totalHeight - totalMatrixWidth; 

        var corr_data = [],
        	    max = 0;
        for(var i = 0; i < matrix.length; i++){
            	for(var j = 0; j < matrix[0].length; j++){
                var val = matrix[i][j];
                corr_data.push({i:i, j:j, val:val});
                max = Math.max(max, val);
            }
        }

    	var matrixScale = d3.scale.ordinal()
    	    .domain(_.range(matrix.length))
          	.rangeBands([0, totalMatrixWidth - matMargin.right - matMargin.left - labelMargin.right], .1);

    	var color = d3.scale.linear()
    	        .domain([0,max])
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


    	var pixel = rawMatrix.selectAll('rect.pixel').data(corr_data);
    	pixel.enter()
        	 .append('rect')
         	.attr('class', 'pixel')
         	.attr('width', matrixScale.rangeBand())
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
          	.on('click', function(d){ drawTimeseries(matrixID2workerID[d.i], matrixID2workerID[d.j], 
              	                                      totalTSWidth, totalTSHeight, tsMargin); });
 
        var tick_col = matrixChart.append('g')
                        .attr('class','ticks')
                        //.attr('transform', 'translate(' + (label_space + 10) + ',' + (label_space) + ')')
      	                .selectAll('text.tick')
                        .data(workers);

        tick_col.enter()
      		.append('text')
          	.attr('class','tick')
          	.style('text-anchor', 'start')
          	//.attr('transform', function(d, i){return 'rotate(270 ' + scale(order_col[i] + 0.7) + ',0)';})
          	//.attr('font-size', scale(0.8))
          	.text(function(d){ return d; })
          	.attr('x', function(d, i){return matrixScale(i);});

        var tick_row = matrixChart.append('g')
                          .attr('class','ticks')
                        //.attr('transform', 'translate(' + (label_space) + ',' + (label_space + 10) + ')')
                          .selectAll('text.tick')
                          .data(workers);

        tick_row.enter()
                .append('text')
                .attr('class','tick')
                .style('text-anchor', 'end')
                //.attr('font-size', scale(0.8))
                .text(function(d){ return d; })
                .attr('y', function(d, i){return matrixScale(i);});
          
    }

    // return variables that are needed outside this scope
    return {
        update: function(fragments) {
            //debug("I should update the chord chart now");
            updateViz(fragments);
        }
    };
};
