var graph = function (element, queryPlan) {

    var chartElement = d3.select('.chart');
    var graphElement = d3.select('.query-plan');

    var graphObj = new Graph();
    graphObj.loadQueryPlan(queryPlan);
    graphObj.render(graphElement, chartElement);
};

// Graph object
function Graph () {

    /********************/
    // Public properties
    /********************/
    this.name = "";         // Query Name
    this.qID = 0;           // Query ID
    this.nodes = {};        // List of graph fragment nodes
    this.links = {};        // List of graph fragment edges
    this.state = {};        // Describes which nodes are "expanded"
    this.opName2color = {}; // Dictionary of opName - color
    this.opName2fID = {};   // Dictionary of opName - fragment ID


    /********************/
    // Public methods
    /********************/
    Graph.prototype.loadQueryPlan = function(json) {
        var graph = this;

        // Initialize the state
        graph.state.opened = [];
        graph.state.focus = "";

        // Get the query plan ID
        graph.qID = json.queryId
        graph.name = "Query Plan " + graph.qID;

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
            var color_index = 0;
            node.operators.forEach(function(op) {
                // Create new op node(s)
                var opnode = new Object();
                var opid = op.opName;
                opnode.operator = op;
                node.opNodes[opid] = opnode;
                // Add entry to opName2fID & opName2colorvar 
                if (op.hasOwnProperty('opName')) {
                    graph.opName2fID[op.opName] = id;
                    graph.opName2color[op.opName] = opColors(color_index);
                    opToColor[op.opName] = opColors(color_index);
                    color_index ++;
                }
            });
            graph.nodes[id] = node;
            // Comment out if we don't want to expand all fragments
            // by default...
            //graph.state.opened.push(id);
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
                    link.u.fID = graph.opName2fID[op.argOperatorId];    // Src fragment ID
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
            graph.state.opened.forEach(function(id){
                if(nid==id) { exists = true; }
            });
            if(!exists) {
                graph.state.opened.push(nid);
                graph.state.focus = nid;
            }
        });
    };

    // Function that updates the graph edges when a fragment gets reduced
    Graph.prototype.reduceNode = function (nodes) {
        var graph = this;
        nodes.forEach(function(nid){
            var index = graph.state.opened.indexOf(nid);
            if (index>-1) {
                graph.state.opened.splice(index, 1);
            }
        });
    };

    // Function that spits out graph description in dot
    Graph.prototype.generateDot = function() {
        var graph = this;
        // Derive the graph DOT specification from the GraphObj
        var dotStr = "digraph G { \n\trankdir = \"BT\";\n\n";
        var links = "";
        // First add the fragment links
        for (var id in graph.links) {
            var link = graph.links[id];
            var u = graph.state.opened.indexOf(link.u.fID)==-1 ? link.u.fID : link.u.oID;
            var v = graph.state.opened.indexOf(link.v.fID)==-1 ? link.v.fID : link.v.oID;
            links += templates.graphViz.link({u: u, v: v});
        }
        // Then add the operand links in subgraphs
        graph.state.opened.forEach(function(fragment){
            dotStr += templates.graphViz.clusterStyle(
                {
                    fragment: fragment
                });
            for (var id in graph.nodes[fragment].opNodes) {
                var node = graph.nodes[fragment].opNodes[id];
                dotStr += "\t\t\"" + id + "\"" + templates.graphViz.nodeStyle(
                {
                    color: "white"
                });
            }
            for (var id in graph.nodes[fragment].opLinks) {
                var link = graph.nodes[fragment].opLinks[id];
                links += templates.graphViz.link({u: link.u.oID, v: link.v.oID});
            }
            dotStr += "\t}\n";
        });
        dotStr += links + "}";
        debug(dotStr);
        return (dotStr);
    }

    // Returns the svg desciption of the graph object
    Graph.prototype.generateSVG = function() {
        var graph = this;
        
        // Get dot description of the graph
        var dotStr = graph.generateDot();

        // Generate svg graph description
        var graphSVG = Viz(dotStr, "svg");
        return(graphSVG);
    };

    // D3 data generator
    Graph.prototype.generateD3data = function(padding) {
        var graph = this;

        // Get dot description of the graph
        var dotStr = graph.generateDot();

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
                        name: id,
                        type: "fragment",
                        x: +cols[2]-cols[4]/2,
                        y: +cols[3]-cols[5]/2,
                        w: +cols[4],
                        h: +cols[5],
                        color: "lightgrey",
                        stroke: "black"
                    };
                } else if (id in graph.opName2fID) {
                    var node = graph.nodes[graph.opName2fID[id]];
                    var opnode = node.opNodes[id];
                    opnode.viz = {
                        name: id,
                        type: "operator",
                        x: +cols[2]-cols[4]/2,
                        y: +cols[3]-cols[5]/2,
                        w: +cols[4],
                        h: +cols[5],
                        color: (graph.state.focus == graph.opName2fID[id]) ? graph.opName2color[id] : "white",
                        stroke: "black"
                    };
                }
            } else if (cols[0]=="edge") {
                var linkID = "";
                var src = cols[1].replace(/\"/g, '');
                var dst = cols[2].replace(/\"/g, '');
                var points = [];
                var type = "frag";
                for (var i=0; i<cols[3]; i++) {
                    points.push([cols[4+2*i], cols[4+2*i+1]]);
                }

                if(src in graph.nodes) {
                    if(dst in graph.nodes) {
                        // frag to frag link
                        linkID = src+"->"+dst;
                    } else if (dst in graph.opName2fID) {
                        // frag to op link
                        linkID = src+"->"+graph.opName2fID[dst];
                    }
                } else if (src in graph.opName2fID) {
                    if(dst in graph.nodes) {
                        // op to frag link
                        linkID = graph.opName2fID[src]+"->"+dst;
                    } else if (dst in graph.opName2fID) {
                        // op to op link
                        if (graph.opName2fID[src] == graph.opName2fID[dst]) {
                            // inner-fragment link
                            linkID = src+"->"+dst;
                            type = "op";
                        } else {
                            // inter-fragment link
                            linkID = graph.opName2fID[src]+"->"+graph.opName2fID[dst];
                        }
                    }
                }
                if (type == "op") {
                    var link = graph.nodes[graph.opName2fID[src]].opLinks[linkID];
                    link.viz = {
                        name: linkID,
                        type: type,
                        src: src,
                        dst: dst,
                        points: points
                    }
                } else if (type == "frag") {
                    var link = graph.links[linkID];
                    link.viz = {
                        name: linkID,
                        type: type,
                        src: src,
                        dst: dst,
                        points: points
                    }
                }
            }
        });

        // return values
        var nodes = [];
        var links = [];
        var height = 0;

        // Exploded fragments
        graph.state.opened.forEach(function (fID) {
            var fragment = graph.nodes[fID];
            var minX = 1000; //FIXME
            var maxX = 0; //FIXME
            var minY = 1000; //FIXME
            var maxY = 0; //FIXME
            for (oID in fragment.opNodes) {
                var op = fragment.opNodes[oID].viz;
                minX = (op.x<minX) ? op.x : minX;
                maxX = ((op.x+op.w)>maxX) ? (op.x+op.w) : maxX;
                minY = (op.y<minY) ? op.y : minY;
                maxY = ((op.y+op.h)>maxY) ? (op.y+op.h) : maxY;
            }
            height = maxY > height ? maxY : height;
            var node = {
                name: fID,
                type: "cluster",
                x: minX-padding/4,
                y: minY-padding/4,
                w: maxX-minX+padding/2,
                h: maxY-minY+padding,
                color: "lightgrey",
                stroke: (graph.state.focus == fID) ? "red" : "black"
            };
            // Add cluster
            nodes.push(node);
            // Add op nodes
            for (opID in fragment.opNodes) {
                var opNode = fragment.opNodes[opID];
                nodes.push(opNode.viz);
            }
            // Add links
            for (opID in fragment.opLinks) {
                var opLink = fragment.opLinks[opID]
                links.push(opLink.viz);
            }
        });
        // Add non-exploded fragments
        for (fragID in graph.nodes) {
            if (graph.state.opened.indexOf(fragID) == -1) {
                nodes.push(graph.nodes[fragID].viz);
            }
        }
        // Add frag-to-frag links
        for (fragID in graph.links) {
            links.push(graph.links[fragID].viz);
        }

        return {
            nodes: nodes,
            links: links,
            height: height
        }
    };

    // D3 rendering prototype
    Graph.prototype.render = function(graphElement, chartElement) {
        var graph = this;

        // D3 stuff...
        var margin = {top: 0, right: 0, bottom: 0, left:0 },
            width = parseInt(graphElement.style('width'), 10) - margin.left - margin.right,
            height = 800 - margin.top - margin.bottom,  
            padding = 0.5,
            yOffset = 0;

        var svg = graphElement
                    .append("svg")
                    .attr("class", "graph")
                    .attr("width", width)
                    .attr("height", height);

        var D3data = graph.generateD3data(padding);

        // Initial rendering
        draw(D3data, true);

        // On click, update with new data
        svg.selectAll("rect")
            .on("click", function() {
                var node = d3.select(this).data()[0];

                // Handle fragment state
                if (node.type == "cluster") {
                    graph.reduceNode([node.name]);
                } else if (node.type == "fragment") {
                    graph.expandNode([node.name]);
                    chartElement.selectAll("svg").remove();
                    fragmentVisualization(chartElement, graph.nodes[node.name].fragmentIndex, queryPlan);
                } 

                var newD3data = graph.generateD3data(padding);

                debug(newD3data);

                draw(newD3data, false);
            });

        svg.selectAll("line")
            .on("click", function() {
                var line = d3.select(this).data()[0];

                if (line.type == "frag") {
                    chartElement.selectAll("svg").remove();
                    networkVisualization(chartElement, [graph.nodes[line.src].fragmentIndex], queryPlan);
                } 
            });

        function draw (data, initial) {
            //svg.attr("height", (height+2)+"in"); //FIXME

            // Marker def (arrowhead)
            svg.append("defs").append("marker")
                .attr("id", "arrowhead")
                .attr("refX", 0) /*must be smarter way to calculate shift*/
                .attr("refY", 2)
                .attr("markerWidth", 6)
                .attr("markerHeight", 4)
                .attr("orient", "auto")
                .append("path")
                    .attr("d", "M 0,0 V 4 L6,2 Z"); //this is actual shape for arrowhead

            var node = svg.selectAll("rect")
                    .data(data.nodes, function(d) { return d.name; })
            
            node.enter().append("rect")
                .attr("rx", 10)
                .attr("ry", 10)
                .attr("r", 10)
                .attr("opacity", function() {
                    return initial ? 1 : 0;
                });

            node.transition().duration(1000)
                .attr("opacity", 1)
                .attr("class", function(d) { return d.type; })
                .attr("x", function(d) { return d.x+"in"; })
                .attr("y", function(d) { return (d.y+yOffset)+"in"; })
                .attr("width", function(d) { return d.w+"in"; })
                .attr("height", function(d) { return d.h+"in"; })
                .attr("fill", function(d) { return d.color; })
                .attr("stroke", function(d) { return d.stroke; });
                 
            node.exit().transition().duration(500)
                .attr("opacity", 0).remove();

            var label = svg.selectAll("text")
                .data(data.nodes, function(d) { return d.name; })
            
            label.enter().append("text")
                .attr("opacity", function() {
                    return initial ? 1 : 0;
                })
                .text(function(d) {return d.name;})
                .attr("text-anchor", "middle")
                .attr("dy", function(d) {return"0.35em";})
                .attr("font-family", "sans-serif")
                .attr("font-size", "13px")
                .attr("fill", "black");

            label.transition().duration(1000)
                .attr("opacity", 1)
                .attr("x", function(d) { return (d.x+d.w/2)+"in"; })
                .attr("y", function(d) { 
                    if(d.type == "cluster") {
                        return (d.y+d.h+yOffset-padding*3/8)+"in"
                    } else {
                        return (d.y+d.h/2+yOffset)+"in"
                    }
                });

            label.exit().transition().duration(500)
                .attr("opacity", 0).remove();

            var link = svg.selectAll("line")
                    .data(data.links, function(d) { return d.name; });

            link.enter().append("line")
                .attr("stroke", "black")
                .attr("stroke-width", 2)
                .attr("stroke-dasharray", function(d) {
                    return (d.type=="frag") ? ("0, 0") : ("3, 3");
                })
                .attr("opacity", function() {
                    return initial ? 1 : 0;
                })
                .attr("marker-end", "url(#arrowhead)");

            link.transition().duration(1000)
                .attr("opacity", 1)
                .attr("class", function(d) { return d.type; })
                .attr("x1", function(d) { return d.points[0][0]+"in"; })
                .attr("y1", function(d) { return (d.points[0][1]+yOffset)+"in"; })
                .attr("x2", function(d) { return d.points[d.points.length-1][0]+"in"; })
                .attr("y2", function(d) { return (d.points[d.points.length-1][1]+yOffset)+"in"; });
                 
            link.exit().transition().duration(500)
                .attr("opacity", 0).remove();
        }

        // var xScale = d3.scale.linear()
        //         .domain([d3.min(data, function(d) { return d.x; }), d3.max(data, function(d) { return d.x+d.w; })])
        //         .range([padding, width-padding]),
        //     yScale = d3.scale.linear()
        //         .domain([d3.min(data, function(d) { return d.y; }), d3.max(data, function(d) { return d.y+d.h; })])
        //         .range([padding, height-padding]);

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

