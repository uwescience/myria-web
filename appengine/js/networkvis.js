var workers;
var dataset;
var matrix;
	var svg;
var timeseries;
var src2dst2ts;
var dst2src2ts;

var networkVisualization = function (element, connections, queryPlan) {
    // do all the chart stuff

    var url = "http://vega.cs.washington.edu:8777/logs/sent?queryId=4&fragmentId=2"

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


        visualize(element);
    	
    });

    // return variables that are needed outside this scope
    return {
        update: function(connections) {
            debug("I should update the chord chart now");
        }
    };
};

function visualize(element) {
	var chord = d3.layout.chord()
    .padding(.05)
    .sortSubgroups(d3.descending)
    .matrix(matrix);

    debug(element);
}