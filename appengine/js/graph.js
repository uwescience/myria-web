var graph = function (element, queryPlan) {
    
    var chartElement = d3.select('.chart');

    var graphObj = new Graph();
    graphObj.loadQueryPlan(queryPlan);

    debug(graphObj);

    //Create SVG element
    // var fullHeight = element.attr('data-height') || 800,
    //     margin = {top: 10, right: 10, bottom: 20, left: 10},
    //     width = parseInt(element.style('width'), 10) - margin.left - margin.right,
    //     height = fullHeight - margin.top - margin.bottom;
    // var svg = graphElement
    //             .append("svg")
    //             .attr("width", width)
    //             .attr("height", height);
    // Render graph using D3-dagre
    // var nodes = graphObj.nodes;
    // var links = graphObj.links;
    // var renderer = new dagreD3.Renderer();
    // var layout = dagreD3.layout();
    // renderer.layout(layout).run(dagreD3.json.decode(nodes, links), svg.append('g'));

    var svg = d3.select('.query-plan')
        .html(graphObj.renderGraph());

    listen(graphObj, svg, chartElement);

};

// Graph object
function Graph () {

    /********************/
    // Public properties
    /********************/
    this.name = "";         // Query ID
    this.nodes = {};        // List of graph fragment nodes
    this.links = {};        // List of graph fragment edges
    this.opName2fID = {};   // Dictionary of opNames - fragment ID
    this.state = [];        // Describes which nodes are "expanded"

    /********************/
    // Public methods
    /********************/
    Graph.prototype.loadQueryPlan = function(json) {
        var graph = this;

        // Get the query plan ID
        graph.name = "Query Plan " + json.queryId;

        // Collect graph nodes 
        json.physicalPlan.fragments.forEach(function(fragment) {
            // Create fragment node object
            var node = new Object();                                    // Node object
            var id = "Frag" + fragment.fragmentIndex.toString();        // Node ID
            node.fragmentIndex = fragment.fragmentIndex.toString();     // Fragment ID
            node.workers = fragment.workers;                            // List of workers
            node.operators = fragment.operators;                        // List of operators
            node.opNodes = {};                                          // List of graph operand nodes
            node.opLinks = {};                                          // List of graph operand edges
            // Process each operator
            node.operators.forEach(function(op) {
                // Create new op node(s)
                var opnode = new Object();
                var opid = op.opName;
                opnode.operator = op;
                node.opNodes[opid] = opnode;
                // Add entry to opName2fID
                if (op.hasOwnProperty('opName')) {
                    graph.opName2fID[op.opName] = id;
                }
            });
            graph.nodes[id] = node;
        });

        // Collect graph links
        for (var id in graph.nodes) {
            var fragment = graph.nodes[id];
            fragment.operators.forEach(function(op) {
                // Add cross-fragment links
                if (op.hasOwnProperty('argOperatorId')) {
                    var link = new Object();                            // Link object
                    link.u = {};
                    link.v = {};
                    link.u.fID = graph.opName2fID[op.argOperatorId];     // Src fragment ID
                    link.u.oID = op.argOperatorId;                      // Src operand ID
                    link.v.fID = id;                                    // Dst fragment ID
                    link.v.oID = op.opName;                             // Dst fragment ID
                    var linkid = link.u.fID + "->" + link.v.fID;        // Link ID
                    graph.links[linkid] = link;
                }
                // Add in-fragment links
                for (var key in op) {
                    if (key.indexOf("argChild")!=-1) {
                        var link = new Object();                        // Link object
                        link.u = {};
                        link.v = {};
                        link.u.fID = id;                                // Src fragment ID
                        link.u.oID = op[key];                           // Src operand ID
                        link.v.fID = id;                                // Dst fragment ID
                        link.v.oID = op.opName;                         // Dst fragment ID
                        var linkid = link.u.oID + "->" + link.v.oID;    // Link ID
                        fragment.opLinks[linkid] = link;
                    }
                }
            });
        }
    };

    // Function that updates the graph edges when a fragment gets expanded
    Graph.prototype.expandNode = function(nodes) {
        var graph = this;
        nodes.forEach(function(nid){
            var exists = false;
            graph.state.forEach(function(id){
                if(nid==id) { exists = true; }
            });
            if(!exists) {
                graph.state.push(nid);
            }
        });
    };

    // Function that updates the graph edges when a fragment gets reduced
    Graph.prototype.reduceNode = function (nodes) {
        var graph = this;
        nodes.forEach(function(nid){
            var index = graph.state.indexOf(nid);
            if (index>-1) {
                graph.state.splice(index, 1);
            }
        });
    };

    // Returns the svg desciption of the graph object
    Graph.prototype.renderGraph = function() {
        var graph = this;
        // Derive the graph DOT specification from the GraphObj
        var dotStr = "digraph G { \n";
        var links = "";
        // First add the fragment links
        for (var id in graph.links) {
            var link = graph.links[id];
            var u = graph.state.indexOf(link.u.fID)==-1 ? link.u.fID : link.u.oID;
            var v = graph.state.indexOf(link.v.fID)==-1 ? link.v.fID : link.v.oID;
            links += templates.graphViz.link({u: u, v: v});
        }
        // Then add the operand links in subgraphs
        graph.state.forEach(function(fragment){
            dotStr += templates.graphViz.clusterStyle({fragment: fragment});
            for (var id in graph.nodes[fragment].opNodes) {
                var node = graph.nodes[fragment].opNodes[id];
                dotStr = dotStr + "\t\t\"" + id + "\"" + templates.graphViz.nodeStyle();
            }
            for (var id in graph.nodes[fragment].opLinks) {
                var link = graph.nodes[fragment].opLinks[id];
                links += templates.graphViz.link({u: link.u.oID, v: link.v.oID});
            }
            dotStr += "\t}\n";
        });
        dotStr += links + "}";
        debug(dotStr);

        // Generate plain graph description
        var graphDesc = Viz(dotStr, "plain");
        debug(graphDesc);

        // Parse the plain description
        var graphDescRows = graphDesc.split("\n");
        graphDescRows.forEach(function(line) {
            var cols = line.split(" ");
            if(cols[0]=="node") {
                var id = cols[1].replace(/\"/g, '');
                if (id in graph.nodes) {
                    graph.nodes[id].viz = {
                        x: cols[2],
                        y: cols[3],
                        w: cols[4],
                        h: cols[5]
                    };
                } else if (id in graph.opName2fID) {
                    var node = graph.nodes[graph.opName2fID[id]];
                    var opnode = node.opNodes[id];
                    opnode.viz = {
                        x: cols[2],
                        y: cols[3],
                        w: cols[4],
                        h: cols[5]
                    };
                }
            }
        });

        // Generate svg graph description
        var graphSVG = Viz(dotStr, "svg");
        return(graphSVG);
    };
}


// Function that listens for user clicks
function listen(graph, svg, chartElement) {
    svg.selectAll(".node")
            .on("click", function () {
                var nodeID = this.firstChild.innerHTML;
                if (nodeID in graph.nodes) {
                    graph.expandNode([nodeID]);
                    fragmentVisualization(chartElement, graph.nodes[nodeID].fragmentIndex, queryPlan);
                } else if (nodeID in graph.opName2fID) {
                    graph.reduceNode([graph.opName2fID[nodeID]]);
                }
                svg.selectAll("g").remove();
                svg.html(graph.renderGraph());
                listen(graph, svg, chartElement);
            });
    svg.selectAll(".cluster")
            .on("click", function () {
                var nodeID = this.lastElementChild.innerHTML;
                if (nodeID in graph.nodes) {
                    graph.reduceNode([nodeID]);
                }
                svg.selectAll("g").remove();
                svg.html(graph.renderGraph());
                listen(graph, svg, chartElement);
            });
    svg.selectAll(".edge")
            .on("click", function () {
                var linkID = this.textContent.trim();
                if (linkID in graph.links) {
                    var src = graph.nodes[graph.links[linkID].u.fID].fragmentIndex;
                    var dst = graph.nodes[graph.links[linkID].v.fID].fragmentIndex;
                    chartElement.selectAll("svg").remove();
                    networkVisualization(chartElement, [src], queryPlan);
                }
            });
}

