var graph = function (element, queryPlan, queryID) {

    var chartElement = d3.select('.chart');
    var graphElement = d3.select('.query-plan')

    //var networkVis = networkVisualization(chartElement, [], queryPlan);
    //networkVis.update([]);

    var fragmentVis = fragmentVisualization(chartElement, 2, queryPlan);


    // Process the queryPlan    
    var fragments = queryPlan.physicalPlan.fragments;
    var graphObj = new Object;
    graphObj.name = ("Query Plan ").concat(queryID);
    graphObj.nodes = []; // List of query fragment
    graphObj.links = []; // List of graph edges
    graphObj.opNames = {}; // Dictionary of opNames - fragment ID
    // 1: collect graph info
    for(var i=0; i<fragments.length; i++){
        // Create node object
        var node = new Object();
        node.id = fragments[i].fragmentIndex;
        node.value = {};
        node.value.label = "";
        node.value.workers = fragments[i].workers;
        node.value.operators = fragments[i].operators;
        // Fill the dictionary: opName -> fragment id
        for(var j=0; j<node.value.operators.length; j++){
            var op = node.value.operators[j];
            if (op.hasOwnProperty('opName')) {
                graphObj.opNames[op.opName] = node.id;
            }
            // Get the fragment name
            var s1 = "Consumer";
            var s2 = "Producer";
            if (op.opType.indexOf(s1)==-1 && op.opType.indexOf(s2)==-1) {
                node.value.label = op.opName;
            }
        } 
        graphObj.nodes.push(node);
    }
    // 2: collect graph edges
    for(var i=0; i<graphObj.nodes.length; i++){
        var node = graphObj.nodes[i];
        for(var j=0; j<node.value.operators.length; j++){
            var op = node.value.operators[j];
            if (op.hasOwnProperty('argOperatorId')) {
                var link = new Object();
                link.u = graphObj.opNames[op.argOperatorId];
                link.v = node.id;
                link.value = {};
                link.value.u = op.argOperatorId;
                link.value.v = node.value.operators[j].opName;
                link.value.label = ('');
                graphObj.links.push(link);
            }
        }
    }
    // 3: expand a node (placeholder)
    var node_id = [2];
    for (var i=0; i<node_id.length; i++) {
        // Update the links
        for(var j=0; j<graphObj.links.length; j++){
            if(graphObj.links[j].u == node_id[i]){
                graphObj.links[j].u = (node_id[i].toString()).concat("_",graphObj.links[j].value.u);
            }
            if(graphObj.links[j].v == node_id[i]){
                graphObj.links[j].v = (node_id[i].toString()).concat("_",graphObj.links[j].value.v);
            }
        }
        // add new nodes & links
        for (var j=0; j<graphObj.nodes.length; j++) {
            if (graphObj.nodes[j].id == node_id[i]) {
                for (var k=0; k<graphObj.nodes[j].value.operators.length; k++) {
                    var op = graphObj.nodes[j].value.operators[k];
                    // create new node(s)
                    var node = new Object();
                    node.id = (node_id[i].toString()).concat("_",op.opName);
                    node.value = {};
                    node.value.label = op.opName;
                    graphObj.nodes.push(node);
                    // look for in-fragment edges
                    var key;
                    for (key in op) {
                        if (key.indexOf("argChild")!=-1) {
                            var link = new Object();
                            link.u = (node_id[i].toString()).concat("_",op[key]);
                            link.v = node.id;
                            link.value = {};
                            link.value.u = op[key];
                            link.value.v = op.opName;
                            link.value.label = ('');
                            graphObj.links.push(link);
                        }
                    }
                }
            }  
        } 
    }

    debug(graphObj);

    //Create SVG element
    var fullHeight = element.attr('data-height') || 400;
    var margin = {top: 10, right: 10, bottom: 20, left: 10};
    var width = parseInt(element.style('width'), 10) - margin.left - margin.right;
    var height = fullHeight - margin.top - margin.bottom;
    var svg = graphElement
                .append("svg")
                .attr("class", "plan-graph")
                .attr("width", width)
                .attr("height", height);

    // Render graph
    var nodes = graphObj.nodes;
    var links = graphObj.links;
    var renderer = new dagreD3.Renderer();
    var layout = dagreD3.layout();
    renderer.layout(layout).run(dagreD3.json.decode(nodes, links), svg.append('g'));
};
