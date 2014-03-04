var networkVisualization = function (element, fragments, queryPlan) {
    var fragmentId = fragments[0];
    var url = templates.urls.sentData({
        myria: myriaConnection,
        query: queryPlan.queryId,
        fragment: fragmentId
    });

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
  		matrix = new Array(workers.length);
  		for (var i = 0; i < matrix.length; i++) {
  			workerID2matrixID[workers[i]] = i;
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


        draw(matrix);
    });

    function draw(matrix) {
    	debug(element.style('width'));
        var margin = {top: 10, right: 10, bottom: 60, left:20 },
            side = Math.min(parseInt(element.style('width'), 10) - margin.left - margin.right, 600)
            matrixWidth = side,
            matrixHeight = side,
            transition_time = 1500;

        var xScale = d3.scale.linear()
          .domain([0, matrix.length])
          .range([0, width]);

        var yScale = d3.scale.linear()
          .domain([0, matrix.length])
          .range([0, height]);

        var xPadding = 5;
        var yPadding = 5;

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

      var svgMatrix = element.append("svg")
              .attr("width", matrixWidth)
              .attr("height", matrixHeight);
              //.append("g");
              //.attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

        var matrixViz = svg.append('g')
          .attr('class','matrix');

        var pixel = matrixViz.selectAll('rect.pixel').data(corr_data);

        pixel.enter()
          .append('rect')
              .attr('class', 'pixel')
              .attr('width', width/matrix.length - xPadding)
              .attr('height', height/matrix.length - yPadding)
              .attr('y', function(d){return yScale(d.i);})
              .attr('x', function(d){return xScale(d.j);})
              .style('fill',function(d){ return color(d.val);});
              //.on('mouseover', function(d){pixel_mouseover(d);})
              //.on('mouseout', function(d){mouseout(d);});
              // .on('click', function(d){reorder_matrix(d.i, 'col'); reorder_matrix(d.j, 'row');});
              //the last thing works only for symmetric matrices, but with asymmetric sorting
    }

    // return variables that are needed outside this scope
    return {
        update: function(connections) {
            debug("I should update the chord chart now");
        }
    };
};
