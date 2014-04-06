var graph = function (element, queryPlan) {

    var chartElement = d3.select('.chart');
    var graphElement = d3.select('.query-plan');

    var allFragments = _.pluck(queryPlan.physicalPlan.fragments, 'fragmentIndex');
    manyLineCharts(chartElement, allFragments, queryPlan);

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
        graph.qID = json.queryId;
        graph.name = "Query Plan " + graph.qID;

        // Collect graph nodes
        json.physicalPlan.fragments.forEach(function(fragment) {
            // Create fragment node object
            var node = new Object();                                    // Node object
            var id = "Fragment" + fragment.fragmentIndex.toString();    // Node ID
            node.fragmentIndex = fragment.fragmentIndex.toString();     // Fragment ID
            node.rawData = fragment;                                    // RAW JSON data
            node.workers = fragment.workers;                            // List of workers
            node.operators = fragment.operators;                        // List of operators
            node.opNodes = {};                                          // List of graph operand nodes
            node.opLinks = {};                                          // List of graph operand edges
            // Process each operator
            var color_index = 0;
            node.operators.forEach(function(op) {
                // Create new op node(s)
                var opnode = {};
                var opid = op.opName;                                   // Operand ID
                opnode.rawData = op;                                    // Raw JSON data
                opnode.opType = op.opType;                              // Operand type
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
        });

        // If there are more than 10 fragments, do not expand
        if (json.physicalPlan.fragments.length < 10) {
            for (var id in graph.nodes) {
                graph.state.opened.push(id);
            }
        }

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
            if (index > -1) {
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
        return (dotStr);
    }

    // Returns the svg description of the graph object
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
                        rawData: graph.nodes[id].rawData,
                        x: +cols[2]-cols[4]/2,
                        y: +cols[3]-cols[5]/2,
                        w: +cols[4],
                        h: +cols[5],
                        color: "lightgrey",
                        stroke: (graph.state.focus == id) ? "red" : "black"
                    };
                } else if (id in graph.opName2fID) {
                    var node = graph.nodes[graph.opName2fID[id]];
                    var opnode = node.opNodes[id];
                    opnode.viz = {
                        name: id,
                        type: "operator",
                        optype: opnode.opType,
                        rawData: opnode.rawData,
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
                    points.push([+cols[4+2*i], +cols[4+2*i+1]]);
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
                        points: points,
                        stroke: (graph.state.focus == linkID) ? "red" : "black",
                        id: "link-" + linkID.hashCode()
                    }
                } else if (type == "frag") {
                    var link = graph.links[linkID];
                    link.viz = {
                        name: linkID,
                        type: type,
                        src: src,
                        dst: dst,
                        points: points,
                        stroke: (graph.state.focus == linkID) ? "red" : "black",
                        id: "link-" + linkID.hashCode()
                    }
                }
            }
        });

        // return values
        var nodes = [];
        var links = [];
        var height = 0;
        var width = 0;

        // Exploded fragments (cluster)
        graph.state.opened.forEach(function (fID) {
            var fragment = graph.nodes[fID];
            var minX = Infinity;
            var maxX = 0;
            var minY = Infinity;
            var maxY = 0;
            for (oID in fragment.opNodes) {
                var op = fragment.opNodes[oID].viz;
                minX = (op.x<minX) ? op.x : minX;
                maxX = ((op.x+op.w)>maxX) ? (op.x+op.w) : maxX;
                minY = (op.y<minY) ? op.y : minY;
                maxY = ((op.y+op.h)>maxY) ? (op.y+op.h) : maxY;
            }
            var node = {
                name: fID,
                type: "cluster",
                rawData: graph.nodes[fID].rawData,
                x: minX-padding/4,
                y: minY-3/4*padding,
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

        // Determine svg height
        nodes.forEach(function(d) {
            height = (d.h+d.y) > height ? (d.h+d.y) : height;
            width = (d.w+d.x) > width ? (d.w+d.x) : width;
        });

        return {
            nodes: nodes,
            links: links,
            height: height,
            width: width
        };
    };

    // D3 rendering prototype
    Graph.prototype.render = function(graphElement, chartElement) {
        var graph = this;

        // D3 stuff...
        var margin = {top: 0, right: 0, bottom: 0, left:0 },
            width = parseInt(graphElement.style('width'), 10) - margin.left - margin.right,
            padding = 0.5;

        var wrapper = graphElement
                    .append("svg")
                    .attr("class", "graph")
                .append("g")
                    .call(d3.behavior.zoom().scaleExtent([0.1, 2]).on("zoom", zoom))
        var svg = wrapper.append("g"); // avoid jitter

        var overlay = svg.append("rect")
            .attr("class", "overlay")
            .attr("width", width)
            .attr("x", -200)
            .attr("y", -200)
            .on("dragstart", function(e) {
                d3.event.sourceEvent.preventDefault();
            });

        function zoom() {
            svg.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
        }

        var D3data = graph.generateD3data(padding);

        // Initial rendering
        draw(D3data, true);

        // On click, update with new data
        svg.selectAll(".node")
            .on("click", function() {
                if (d3.event.defaultPrevented) return;

                var node = d3.select(this).data()[0];

                // Handle fragment state
                if (node.type == "cluster") {
                    if (node.name == graph.state.focus) {
                        graph.state.focus = "";
                        graph.reduceNode([node.name]);

                        var allFragments = _.pluck(queryPlan.physicalPlan.fragments, 'fragmentIndex');
                        manyLineCharts(chartElement, allFragments, queryPlan);
                    } else {
                        graph.state.focus = node.name;
                        fragmentVisualization(chartElement, graph.nodes[node.name].fragmentIndex, queryPlan);
                    }
                } else if (node.type == "fragment") {
                    graph.expandNode([node.name]);
                    chartElement.selectAll("svg").remove();
                    fragmentVisualization(chartElement, graph.nodes[node.name].fragmentIndex, queryPlan);
                }

                var newD3data = graph.generateD3data(padding);
                draw(newD3data, false);
            });

        svg.selectAll(".link")
            .on("click", function() {
                if (d3.event.defaultPrevented) return;

                var line = d3.select(this).data()[0];

                if (line.type == "frag") {
                    var src = (line.src in graph.nodes) ? graph.nodes[line.src].fragmentIndex : graph.nodes[graph.opName2fID[line.src]].fragmentIndex;
                    var dst = (line.dst in graph.nodes) ? graph.nodes[line.dst].fragmentIndex : graph.nodes[graph.opName2fID[line.dst]].fragmentIndex;
                    chartElement.selectAll("svg").remove();
                    networkVisualization(chartElement, [src, dst], queryPlan);

                    graph.state.focus = line.name;
                    var newD3data = graph.generateD3data(padding);
                    draw(newD3data, false);
                }
            });

        function draw(data, initial) {
            svg.transition()
                .attr("height", data.height*dpi)
                .attr("width", data.width*dpi);

            overlay
                .attr("height", data.height*dpi + 400)
                .attr("width", data.width*dpi + 400);

            graphElement.style("height", data.height*dpi + 10 + "px");

            wrapper.attr("transform", "translate(" + (width/2 - data.width * dpi/2) + ", 0)")

            /* Nodes */
            var node = svg.selectAll("g.node")
                .data(data.nodes, function(d) { return d.name; });

            var nodeEnter = node.enter()
                .append("g");

            node
                .attr("class", function(d) { return "node " + d.type; });

            nodeEnter.append("rect")
                .attr("rx", 10)
                .attr("ry", 10)
                .attr("r", 10)
                .attr("opacity", function() {
                    return initial ? 1 : 0;
                });

            nodeEnter.append("circle")
                .attr("r", 6)
                .attr("class", "rect-info")
                .popover(function(d) {
                    var body = '';

                    //var filtered = _.pick(d.rawData, 'opName', 'opType', 'argOperatorId', 'relationKey', 'argPf');
                    _.each(d.rawData, function(value, key){
                        if (key == 'operators') {
                            return;
                        }
                        if (value === null) {
                            value = 'null';
                        }
                        if (value != null && typeof value === 'object') {
                          value = JSON.stringify(value);
                        }
                        body += templates.row({key: key, value: value});
                    });
                    return {
                        title: d.name,
                        content: templates.table({body: body})
                    };
                });

            node.select("circle").transition().duration(longDuration)
                .attr("opacity", 1)
                .attr("cx", function(d) { return (d.x+d.w) * dpi; })
                .attr("cy", function(d) { return d.y * dpi; })

            node.select("rect").transition().duration(longDuration)
                .attr("opacity", 1)
                .attr("x", function(d) { return d.x * dpi; })
                .attr("y", function(d) { return d.y * dpi; })
                .attr("width", function(d) { return d.w * dpi; })
                .attr("height", function(d) { return d.h * dpi; })
                .attr("fill", function(d) { return d.color; })
                .attr("stroke", function(d) { return d.stroke; });

            nodeEnter.append("text")
                .attr("opacity", function() {
                    return initial ? 1 : 0;
                })
                .text(function(d) {
                    // TODO: (op labels) comment out for now...
                    //if (d.type == "operator") {
                    //    return d.optype;
                    //} else {
                        return d.name;
                    //}
                })
                .attr("text-anchor", "middle")
                .attr("dy", function(d) {return"0.35em";})
                .attr("font-family", "sans-serif")
                .attr("font-size", "13px")
                .attr("fill", "black");

            node.select("text").transition().duration(longDuration)
                .attr("opacity", 1)
                .attr("x", function(d) { return (d.x+d.w/2) * dpi; })
                .attr("y", function(d) {
                    if(d.type == "cluster") {
                        return (d.y+padding*3/8) * dpi;
                    } else {
                        return (d.y+d.h/2) * dpi;
                    }
                });

            node.exit().select("rect").transition().duration(shortDuration)
                .attr("opacity", 0);

            node.exit().select("text").remove();

            node.exit().select("circle").remove();

            node.exit().transition().duration(shortDuration).remove();

            /* Links */

            var link = svg.selectAll("g.link")
                .data(data.links, function(d) { return d.name; });

            var linkEnter = link.enter().append("g");

            link.attr("class", function(d) { return "link " + d.type; });

            linkEnter.append("polyline")
                .attr("stroke-dasharray", function(d) {
                    return (d.type=="frag") ? ("0, 0") : ("3, 3");
                })
                .attr("opacity", function() {
                    return initial ? 1 : 0;
                })
                .attr("class", "line");

            linkEnter.append("polyline")
                .attr("class", "clickme");

            linkEnter.append("defs").append("marker")
                .attr("id", function(d) {
                    return d.id;
                })
                .attr("refX", 2)
                .attr("refY", 2)
                .attr("markerWidth", 6)
                .attr("markerHeight", 4)
                .attr("orient", "auto")
                .attr("fill-opacity", 1)
                .append("path")
                    .attr("d", "M 0,0 V 4 L6,2 Z");

            link.select("marker").transition().duration(longDuration)
                .attr("fill", function(d) {
                    return d.stroke;
                })

            link.select("polyline.line").transition().duration(longDuration)
                .attr("opacity", 1)
                .attr("points", function(d) {
                    // TODO: use d3 line
                    path = ""
                    d.points.forEach(function (point) {
                        path += (point[0]*dpi)+" "+(point[1]*dpi)+", "
                    });
                    return path.substr(0, path.length-2).trim();
                })
                .attr("stroke", function(d) { return d.stroke; })
                .attr("marker-end", function(d) { return templates.markerUrl({ name: d.id }) });

            link.select("polyline.clickme").attr("points", function(d) {
                    // TODO: use d3 line
                    path = ""
                    d.points.forEach(function (point) {
                        path += (point[0]*dpi)+" "+(point[1]*dpi)+", "
                    });
                    return path.substr(0, path.length-2).trim();
                })
                .attr("stroke", "black");

            link.exit().select("polyline").transition().duration(shortDuration)
                .attr("opacity", 0);

            link.exit().select("marker").transition().duration(shortDuration)
                .attr("fill-opacity", 0)

            link.exit().transition().duration(shortDuration).remove();
        }

        // var xScale = d3.scale.linear()
        //         .domain([d3.min(data, function(d) { return d.x; }), d3.max(data, function(d) { return d.x+d.w; })])
        //         .range([padding, width-padding]),
        //     yScale = d3.scale.linear()
        //         .domain([d3.min(data, function(d) { return d.y; }), d3.max(data, function(d) { return d.y+d.h; })])
        //         .range([padding, height-padding]);
    };
};
