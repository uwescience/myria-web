var graph = function (element, queryPlan, queryID) {

    var chartElement = d3.select('.chart');
    var graphElement = d3.select('.query-plan');
    
    var networkVis = networkVisualization(chartElement, [], queryPlan);

    networkVis.update([]);

    var fragmentVis = fragmentVisualization(chartElement, 2, queryPlan);

    // Process the queryPlan    
    var graphObj = new Object;
    graphObj.name = ("Query Plan ").concat(queryID);
    graphObj.nodes = {};        // List of graph nodes
    graphObj.links = {};        // List of graph edges
    graphObj.opName2fID = {};   // Dictionary of opNames - fragment ID
    graphObj.state = [];        // Describes which nodes are "expanded"

    // Collect graph info
    //$.getJSON("js/query.json", function(queryPlan) { 
        queryPlan.physicalPlan.fragments.forEach(function(fragment) {
            // Create fragment node object
            var node = new Object();
            var id = "Frag".concat(fragment.fragmentIndex.toString());
            node.workers = fragment.workers;
            node.operators = fragment.operators;
            node.opNodes = {};      // List of graph operand nodes
            node.opLinks = {};      // List of graph operand edges
            // Process operators
            node.operators.forEach(function(op) {
                // Create new op node(s)
                var opnode = new Object();
                var opid = op.opName;
                opnode.operator = op;
                node.opNodes[opid] = opnode;
                // Add entry to opName2fID
                if (op.hasOwnProperty('opName')) {
                    graphObj.opName2fID[op.opName] = id;
                }
            });
            graphObj.nodes[id] = node;
        });

        // Collect graph links
        for (var id in graphObj.nodes) {
            var fragment = graphObj.nodes[id];
            fragment.operators.forEach(function(op) {
                // Add cross-fragment links
                if (op.hasOwnProperty('argOperatorId')) {
                    var link = new Object();
                    link.u = {};
                    link.v = {};
                    link.u.fID = graphObj.opName2fID[op.argOperatorId];
                    link.u.oID = op.argOperatorId;
                    link.v.fID = id;
                    link.v.oID = op.opName;
                    var linkid = link.u.fID.concat("->", link.v.fID);
                    graphObj.links[linkid] = link;
                }
                // Add in-fragment links
                for (var key in op) {
                    if (key.indexOf("argChild")!=-1) {
                        var link = new Object();
                        link.u = {};
                        link.v = {};
                        link.u.fID = id;
                        link.u.oID = op[key];
                        link.v.fID = id;
                        link.v.oID = op.opName;
                        var linkid = link.u.oID.concat("->", link.v.oID);
                        fragment.opLinks[linkid] = link;
                    }
                }
            });
        }

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

        var svg = graphElement
                    .html(renderGraph(graphObj));  

         listen(graphObj, svg);
    //});
    
};

// Function that listens for user clicks 
function listen(graph, svg) {
    svg.selectAll(".node")
            .on("click", function () {
                var nodeID = this.firstChild.innerHTML;
                if (nodeID in graph.nodes) {
                    expandNode(graph, [nodeID]);
                } else if (nodeID in graph.opName2fID) {
                    reduceNode(graph, [graph.opName2fID[nodeID]]);
                }
                svg.selectAll("g").remove();
                svg.html(renderGraph(graph));
                listen(graph, svg);
            });
    svg.selectAll(".cluster")
            .on("click", function () {
                var nodeID = this.lastElementChild.innerHTML;
                debug(nodeID);
                if (nodeID in graph.nodes) {
                    reduceNode(graph, [nodeID]);
                } 
                svg.selectAll("g").remove();
                svg.html(renderGraph(graph));
                listen(graph, svg);
            });

}

// Returns the svg desciption of the graph object
function renderGraph(graph) {
    // Derive the graph DOT specification from the GraphObj
    var dotStr = "digraph G { \n";
    var links = "";
    // First add the fragment links
    for (var id in graph.links) {
        var link = graph.links[id];
        var u = graph.state.indexOf(link.u.fID)==-1 ? link.u.fID : link.u.oID;
        var v = graph.state.indexOf(link.v.fID)==-1 ? link.v.fID : link.v.oID;
        links = links.concat("\t\"", u, "\" -> \"", v, "\";\n");
    }
    // Subgraph node style
    var nodeStyle = "[style=\"rounded, filled\",color=white,shape=box];\n";
    // Then add the operand links in subgraphs
    graph.state.forEach(function(fragment){
        dotStr = dotStr.concat("\n\tsubgraph cluster_", fragment, " {\n");
        dotStr = dotStr.concat("\t\tstyle=\"rounded, filled\";\n");
        dotStr = dotStr.concat("\t\tcolor=lightgrey;\n");
        dotStr = dotStr.concat("\t\tnode [style=filled,color=white];\n");
        dotStr = dotStr.concat("\t\tlabel = \"", fragment, "\";\n");
        for (var id in graph.nodes[fragment].opNodes) {
            var node = graph.nodes[fragment].opNodes[id];
            dotStr = dotStr.concat("\t\t\"", id, "\"", nodeStyle);
        }
        for (var id in graph.nodes[fragment].opLinks) {
            var link = graph.nodes[fragment].opLinks[id];
            links = links.concat("\t\"", link.u.oID, "\" -> \"", link.v.oID, "\";\n");
        }
        dotStr = dotStr.concat("\t}\n");
    });
    dotStr = dotStr.concat(links, "}");
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
                graph.nodes[id].viz = {};
                graph.nodes[id].viz.x = cols[2];
                graph.nodes[id].viz.y = cols[3];
                graph.nodes[id].viz.w = cols[4];
                graph.nodes[id].viz.h = cols[5];
            } else if (id in graph.opName2fID) {
                var node = graph.nodes[graph.opName2fID[id]];
                var opnode = node.opNodes[id];
                opnode.viz = {};
                opnode.viz.x = cols[2];
                opnode.viz.y = cols[3];
                opnode.viz.w = cols[4];
                opnode.viz.h = cols[5];
            }
        }
    });

    // Generate svg graph description
    var graphSVG = Viz(dotStr, "svg");
    return(graphSVG);
}

// Function that updates the graph edges when a fragment gets expanded
function expandNode(graph, nodes) {
    nodes.forEach(function(nid){
        var exists = false;
        graph.state.forEach(function(id){
            if(nid==id) { exists = true; }
        });
        if(!exists) {
            graph.state.push(nid);
        }
    });
}

// Function that updates the graph edges when a fragment gets reduced
function reduceNode(graph, nodes) {
    nodes.forEach(function(nid){
        var index = graph.state.indexOf(nid);
        if (index>-1) {
            graph.state.splice(index, 1);
        }
    });
}