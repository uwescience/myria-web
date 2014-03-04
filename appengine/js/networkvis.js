var networkVisualization = function (element, fragments, queryPlan) {
    // do all the chart stuff

    var fragmentId = fragments[0];
    var queryId = queryPlan.queryId;
    var url = 'http://' + myriaConnection +
          "/logs/sent?fragmentId=" + fragmentId +
          "&queryId=" + queryId;

    var workers;
    var dataset;
    var matrix;
    var timeseries;
    var src2dst2ts;
    var dst2src2ts;

    d3.csv(url, function (data) {
    	matrix = [];
  		dataset = [];
  		workers = new Object();
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

  		dst2src2ts = d3.nest()
      				.key(function(d) { return d.destWorkerId; })
      				.key(function(d) { return d.workerId; })
      				.entries(dataset);

      	workers = d3.keys(workers);
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


        draw();
    });

    function draw() {
        var margin = {top: 10, right: 10, bottom: 60, left:20 },
            side = Math.min(parseInt(element.style('width'), 10) - margin.left - margin.right, 600)
            width = side,
            height = side,
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
            .range(colorbrewer.PuRd[9]);

      var svg = element.append("svg")
              .attr("width", width)
              .attr("height", height);
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
