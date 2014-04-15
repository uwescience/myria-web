//query graph and profiling charts
var graph = function (element, queryPlan) {

    var chartElement = d3.select('.chart');

    var allFragments = _.pluck(queryPlan.physicalPlan.fragments, 'fragmentIndex');
    manyLineCharts(chartElement, allFragments, queryPlan);

    var graphObj = new Graph();
    graphObj.loadQueryPlan(queryPlan);

    graphObj.render(element, chartElement);
};

//query graph
var queryGraph = function(element, queryPlan){
    var graphObj = new Graph();
    graphObj.loadQueryPlan(queryPlan);
    graphObj.render(element, null);
};

// Graph object
function Graph () {

    /********************/
    // Public properties
    /********************/
    this.name = "";         // Query Name
    this.qId = 0;           // Query ID
    this.nodes = {};        // List of graph fragment nodes
    this.links = {};        // List of graph fragment edges
    this.state = {};        // Describes which nodes are "expanded"
    this.opId2color = {};   // Dictionary of opId - color
    this.opId2fId = {};     // Dictionary of opId - fragment ID
    this.queryPlan = {};    // Physical plan

    /********************/
    // Public methods
    /********************/
    Graph.prototype.loadQueryPlan = function(json) {
        var graph = this;

        // Initialize the state
        graph.state.opened = [];
        graph.state.focus = "";

        // Get the query plan ID
        graph.qId = json.queryId;
        graph.name = "Query Plan " + graph.qId;
        // Get query plan
        graph.queryPlan = json;

        // Collect graph nodes
        graph.queryPlan.physicalPlan.fragments.forEach(function(fragment) {
            // Create fragment node object
            var node = new Object();                                    // Node object
            var id = "Frag" + fragment.fragmentIndex.toString();        // Node ID
            node.fragmentIndex = fragment.fragmentIndex.toString();     // Fragment ID
            node.rawData = fragment;                                    // RAW JSON data
            node.workers = fragment.workers;                            // List of workers
            node.operators = fragment.operators;                        // List of operators
            node.opNodes = {};                                          // List of graph operand nodes
            node.opLinks = {};                                          // List of graph operand edges
            node.name = "Fragment " + fragment.fragmentIndex.toString();
            // Process each operator
            var color_index = 0;
            node.operators.forEach(function(op) {
                // Create new op node(s)
                var opnode = {};
                opnode.rawData = op;                                    // Raw JSON data
                opnode.opType = op.opType;                              // Operand type
                var hasName = _.has(op, 'opName') && op.opName;
                opnode.opName = hasName ? op.opName.replace("Myria", "") : op.opId;  // Operand name
                node.opNodes[op.opId] = opnode;
                // Add entry to opId2fId & opId2colorvar
                if (op.hasOwnProperty('opId')) {
                    graph.opId2fId[op.opId] = id;
                    graph.opId2color[op.opId] = opColors(color_index);
                    opToColor[op.opId] = opColors(color_index);
                    color_index ++;
                }
            });
            graph.nodes[id] = node;
        });

        // If there are more than 10 fragments, do not expand
        if (graph.queryPlan.physicalPlan.fragments.length < 10) {
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
                    link.u.fID = graph.opId2fId[op.argOperatorId];      // Src fragment ID
                    link.u.oID = op.argOperatorId;                      // Src operand ID
                    link.v.fID = id;                                    // Dst fragment ID
                    link.v.oID = op.opId;                               // Dst fragment ID
                    var linkid = link.u.fID + "->" + link.v.fID;        // Link ID
                    graph.links[linkid] = link;
                }
                // Add in-fragment links
                for (var key in op) {
                    if (key == "argChildren") {
                        op[key].forEach(function(child){
                            var link = new Object();                        // Link object
                            link.u = {};
                            link.v = {};
                            link.u.fID = id;                                // Src fragment ID
                            link.u.oID = child;                             // Src operand ID
                            link.v.fID = id;                                // Dst fragment ID
                            link.v.oID = op.opId;                           // Dst fragment ID
                            var linkid = link.u.oID + "->" + link.v.oID;    // Link ID
                            fragment.opLinks[linkid] = link;
                        });
                    } else if (key.indexOf("argChild") != -1) {
                        var link = new Object();                        // Link object
                        link.u = {};
                        link.v = {};
                        link.u.fID = id;                                // Src fragment ID
                        link.u.oID = op[key];                           // Src operand ID
                        link.v.fID = id;                                // Dst fragment ID
                        link.v.oID = op.opId;                           // Dst fragment ID
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
                if(nid == id) { exists = true; }
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
            dotStr += templates.graphViz.clusterStyle({ fragment: fragment });
            for (var id in graph.nodes[fragment].opNodes) {
                var node = graph.nodes[fragment].opNodes[id];
                dotStr += '\t\t"' + id + '"' + templates.graphViz.nodeStyle({ color: "white", label: node.opName });
            }
            for (var id in graph.nodes[fragment].opLinks) {
                var link = graph.nodes[fragment].opLinks[id];
                links += templates.graphViz.link({u: link.u.oID, v: link.v.oID});
            }
            dotStr += "\t}\n";
        });
        dotStr += links + "}";
        return (dotStr);
    };

    // Returns the svg description of the graph object
    Graph.prototype.generateSVG = function() {
        var graph = this;

        // Get dot description of the graph
        var dotStr = graph.generateDot();

        // Generate svg graph description
        var graphSVG = Viz(dotStr, "svg");
        return(graphSVG);
    };

    Graph.prototype.generatePlainDot = function() {
        var graph = this;

        // Get dot description of the graph
        var dotStr = graph.generateDot();

        // Generate plain graph description
        return Viz(dotStr, "plain");
    };

    // D3 data generator
    Graph.prototype.generateD3data = function(padding) {
        var graph = this;

        var graphDesc = graph.generatePlainDot();

        // Parse the plain description
        var graphDescRows = graphDesc.split("\n");
        graphDescRows.forEach(function(line) {
            var cols = line.split(" ");
            if(cols[0]=="node") {
                var id = cols[1].replace(/\"/g, '');
                if (id in graph.nodes) {
                    graph.nodes[id].viz = {
                        id: id,
                        type: "fragment",
                        rawData: graph.nodes[id].rawData,
                        x: +cols[2]-cols[4]/2,
                        y: +cols[3]-cols[5]/2,
                        w: +cols[4],
                        h: +cols[5],
                        color: "lightgrey",
                        stroke: (graph.state.focus == id) ? "red" : "black"
                    };
                } else if (id in graph.opId2fId) {
                    var node = graph.nodes[graph.opId2fId[id]];
                    var opnode = node.opNodes[id];
                    opnode.viz = {
                        id: id,
                        name: opnode.opName,
                        type: "operator",
                        optype: opnode.opType,
                        rawData: opnode.rawData,
                        x: +cols[2]-cols[4]/2,
                        y: +cols[3]-cols[5]/2,
                        w: +cols[4],
                        h: +cols[5],
                        color: (graph.state.focus == graph.opId2fId[id]) ? graph.opId2color[id] : "white",
                        stroke: "black"
                    };
                }
            } else if (cols[0]=="edge") {
                var linkID = "not found";
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
                    } else if (dst in graph.opId2fId) {
                        // frag to op link
                        linkID = src+"->"+graph.opId2fId[dst];
                    }
                } else if (src in graph.opId2fId) {
                    if(dst in graph.nodes) {
                        // op to frag link
                        linkID = graph.opId2fId[src]+"->"+dst;
                    } else if (dst in graph.opId2fId) {
                        // op to op link
                        if (graph.opId2fId[src] == graph.opId2fId[dst]) {
                            // inner-fragment link
                            linkID = src+"->"+dst;
                            type = "op";
                        } else {
                            // inter-fragment link
                            linkID = graph.opId2fId[src]+"->"+graph.opId2fId[dst];
                        }
                    }
                }
                if (type == "op") {
                    var link = graph.nodes[graph.opId2fId[src]].opLinks[linkID];
                    link.viz = {
                        id: linkID,
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
                        id: linkID,
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
                id: fID,
                name: fID,
                type: "cluster",
                rawData: graph.nodes[fID].rawData,
                x: minX-padding/2,
                y: minY-padding/2,
                w: maxX-minX+padding,
                h: maxY-minY+padding,
                color: "lightgrey",
                stroke: (graph.state.focus == fID) ? "red" : "black"
            };
            // Add cluster
            nodes.push(node);
            // Add op nodes
            for (opId in fragment.opNodes) {
                var opNode = fragment.opNodes[opId];
                nodes.push(opNode.viz);
            }
            // Add links
            for (opId in fragment.opLinks) {
                var opLink = fragment.opLinks[opId]
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
        var self = this;

        var interactive = chartElement ? true : false;

        // D3 stuff...
        var margin = {top: 0, right: 0, bottom: 0, left:0 },
            width = parseInt(graphElement.style('width'), 10) - margin.left - margin.right,
            padding = 0.25;

        var zoom = d3.behavior.zoom()
            .scaleExtent([0.5, 4])
            .on('zoom', onzoom);

        var wrapper = graphElement
                    .append("svg")
                    .attr("class", "graph")
                    .call(zoom)
                    .append("g");
        var graph = wrapper.append("g"); // avoid jitter

        var overlay = graph.append("rect")
            .attr("class", "overlay")
            .attr("x", -200)
            .attr("y", -200)
            .on("dragstart", function(e) {
                d3.event.sourceEvent.preventDefault();
            });


        function onzoom() {
            graph.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
        }

        var D3data = self.generateD3data(padding);

        // Initial rendering
        draw(D3data, true);

        // On click, update with new data
        if (interactive) {
            graph.attr("class", "interactive");

            graph.selectAll(".node")
                .on("click", function() {
                    if (d3.event.defaultPrevented) return;

                    var node = d3.select(this).data()[0];

                    // Handle fragment state
                    if (node.type == "cluster") {
                        if (node.id == self.state.focus) {
                            self.state.focus = "";
                            self.reduceNode([node.id]);

                            var allFragments = _.pluck(self.queryPlan.physicalPlan.fragments, 'fragmentIndex');
                            manyLineCharts(chartElement, allFragments, self.queryPlan);
                        } else {
                            self.state.focus = node.id;
                            if(chartElement){
                                fragmentVisualization(chartElement, self.nodes[node.id].fragmentIndex, self.queryPlan);
                            }
                        }
                    } else if (node.type == "fragment") {
                        self.expandNode([node.id]);
                        chartElement.selectAll("svg").remove();
                        fragmentVisualization(chartElement, self.nodes[node.id].fragmentIndex, self.queryPlan);
                    }

                    var newD3data = self.generateD3data(padding);
                    draw(newD3data, false);
                });

            graph.selectAll(".link")
                .on("click", function() {
                    if (d3.event.defaultPrevented) return;

                    var line = d3.select(this).data()[0];

                    if (line.type == "frag") {
                        var src = (line.src in self.nodes) ? self.nodes[line.src].fragmentIndex : self.nodes[self.opId2fId[line.src]].fragmentIndex;
                        var dst = (line.dst in self.nodes) ? self.nodes[line.dst].fragmentIndex : self.nodes[self.opId2fId[line.dst]].fragmentIndex;
                        chartElement.selectAll("svg").remove();
                        networkVisualization(chartElement, [src, dst], self.queryPlan);
                        self.state.focus = line.id;
                        var newD3data = self.generateD3data(padding);
                        draw(newD3data, false);
                    }
                });
        }

        function draw(data, initial) {
            graph
                .attr("height", data.height*dpi)
                .attr("width", data.width*dpi);

            overlay
                .attr("height", data.height*dpi + 400)
                .attr("width", data.width*dpi + 400);

            graphElement.style("height", (data.height + 0.5)*dpi + "px");

            wrapper.attr("transform", "translate(" + (width/2 - data.width * dpi/2) + ", 0)");

            var scale = width/(data.width*dpi);
            if (scale < 1) {
                zoom.scale(scale);
            } else {
                scale = 1;
            }

            // see http://commons.oreilly.com/wiki/index.php/SVG_Essentials/Transforming_the_Coordinate_System#Technique:_Scaling_Around_a_Center_Point
            var centerX = width/2;
            zoom.translate([-centerX*(scale-1), 0]);
            zoom.event(overlay);

            /* Nodes */
            var node = graph.selectAll("g.node")
                .data(data.nodes, function(d) { return d.id; });

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

                    //var filtered = _.pick(d.rawData, 'opId', 'opType', 'argOperatorId', 'relationKey', 'argPf');
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
                        title: templates.strong({text: d.name}),
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

            nodeEnter
                .append("text")
                .attr("opacity", function() {
                    return initial ? 1 : 0;
                })
                .attr("text-anchor", "middle")
                .attr("dy", function(d) {return"0.35em";})
                .attr("fill", "black");

            node.select("text")
                .text(function(d) {
                    if (d.type == "operator" || !_.contains(self.state.opened, d.id)) {
                        return d.name;
                    }
                    return "";
                });

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

            var line = d3.svg.line()
                .x(function(d) { return d[0] * dpi; })
                .y(function(d) { return d[1] * dpi; })
                .interpolate("montone");

            var link = graph.selectAll("g.link")
                .data(data.links, function(d) { return d.id; });

            var linkEnter = link.enter().append("g");

            link.attr("class", function(d) { return "link " + d.type; });

            linkEnter.append("path")
                .attr("stroke-dasharray", function(d) {
                    return (d.type=="frag") ? ("0, 0") : ("3, 3");
                })
                .attr("opacity", function() {
                    return initial ? 1 : 0;
                })
                .attr("class", "line");

            linkEnter.append("path")
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
                });

            link.select("path.line").transition().duration(longDuration)
                .attr("opacity", 1)
                .attr("d", function(d) { return line(d.points); })
                .attr("stroke", function(d) { return d.stroke; })
                .attr("marker-end", function(d) { return templates.markerUrl({ name: d.id }) });

            link.select("path.clickme")
                .attr("d", function(d) { return line(d.points); })
                .attr("stroke", "black");

            link.exit().select("path").transition().duration(shortDuration)
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
