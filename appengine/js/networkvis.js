var networkVisualization = function (element, fragments, queryPlan) {
    var fragmentId = fragments[0];
    var url = templates.urls.sentData({
        myria: myriaConnection,
        query: queryPlan.queryId,
        fragment: fragmentId
    });

    //url = "data/data.csv";
    d3.csv(url, function (data) {
    	var matrix = [],
      		dataset = [],
  		    workers = new Object();

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

  		var dst2src2ts = d3.nest()
      				.key(function(d) { return d.destWorkerId; })
      				.key(function(d) { return d.workerId; })
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


        draw(matrix,workers,matrixID2workerID);
    });

    function draw(matrix,workers,matrixID2workerID) {
    	debug(element.style('width'));
        var margin = {top: 10, right: 10, bottom: 10, left:10 },
            matMargin = {top: 10, right: 10, bottom: 10, left:10 },
        	width = parseInt(element.style('width'), 10),
        	height = 600,
            chartWidth = width - margin.left - margin.right,
            chartHeight = height - margin.top - margin.bottom,
            summaryWidth = 300,
            matrixWidth = width - summaryWidth;

        var matrixScale = d3.scale.ordinal()
          .domain(_.range(matrix.length))
          .rangeBands([0, matrixWidth], .1);

      // converts a matrix into a sparse-like entries
      // maybe 'expensive' for large matrices, but helps keeping code clean
       var corr_data = [],
            max = 0;
        for(var i = 0; i < matrix.length; i++){
            for(var j = 0; j < matrix[0].length; j++){
                var val = matrix[i][j];
                corr_data.push({i:i, j:j, val:val});
                max = Math.max(max, val);
            }
        }

        var color = d3.scale.linear()
            .domain([0, max])
            .range(["#FFF7F3", "#49006A"])
            .interpolate(d3.interpolateLab);

        var svg = element.append("svg")
            .attr("width", width)
            .attr("height", height);

        /*
        var tp = element.append('div')
    	    .attr('class', 'tooltip')
    	    .style("opacity", 0.3);
    	*/
        
        var chart = svg.append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        var matrixViz = chart.append('g')
          .attr('class','matrix')
          .attr("transform", "translate(" + matMargin.left + "," + matMargin.top + ")");

        var pixel = matrixViz.selectAll('rect.pixel').data(corr_data);

        pixel.enter()
          .append('rect')
              .attr('class', 'pixel')
              .attr('width', matrixScale.rangeBand())
              .attr('height', matrixScale.rangeBand())
              .attr('y', function(d){return matrixScale(d.i);})
              .attr('x', function(d){return matrixScale(d.j);})
              .style('fill',function(d){ return color(d.val);})
              .popover(function(d) {
              	//var content = boxTemplate({numTuples: d.val});
              	var src = matrixID2workerID[d.i];
              	var dst = matrixID2workerID[d.j];
               	return {
                    title: "src worker ID:" + src + "\n dst worker ID:" + dst,
                    content: "total # of tuples: " + d.val
                    //content: content
                };
              });
              //.on('mouseover', function(d){pixel_mouseover(d);})
              //.on('mouseout', function(d){mouseout(d);});
              // .on('click', function(d){reorder_matrix(d.i, 'col'); reorder_matrix(d.j, 'row');});

        
        var tick_col = chart.append('g')
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

        var tick_row = chart.append('g')
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
        update: function(connections) {
            debug("I should update the chord chart now");
        }
    };
};
