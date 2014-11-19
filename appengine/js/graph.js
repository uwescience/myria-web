//query graph and profiling charts
var queryGraphInteractive = function (element, queryPlan) {
    var chartElement = d3.select('.chart');

    var graphObj = new Graph();
    graphObj.loadQueryPlan(queryPlan);
    graphObj.loadCosts(function() {
        graphObj.render(element, chartElement);
        graphObj.openOverview();
    });
    return graphObj;
};

//query graph
var queryGraph = function(element, queryPlan){
    var graphObj = new Graph();
    graphObj.loadQueryPlan(queryPlan);
    graphObj.render(element, null);
    return graphObj;
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
    this.costs = {};
    this.linkOrigins = {};

    /********************/
    // Private properties
    /********************/

    var padding = 0.25;

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

        // a nested version of op ids, not needed in here but useful for other visualizations
        graph.nested = {};

        // edges, used to construct graph.nested
        var links = {};

        // Collect graph nodes
        graph.queryPlan.plan.fragments.forEach(function(fragment) {
            // Create fragment node object
            var node = {};                                              // Node object
            var id = "f"+fragment.fragmentIndex;                            // Node ID
            node.fragmentIndex = fragment.fragmentIndex;                // Fragment ID
            node.rawData = fragment;                                    // RAW JSON data
            node.workers = fragment.workers;                            // List of workers
            node.operators = fragment.operators;                        // List of operators
            node.opNodes = {};                                          // List of graph operand nodes
            node.opLinks = {};                                          // List of graph operand edges
            node.name = "Fragment " + fragment.fragmentIndex.toString();// Name for fragment node

            // Process each operator
            var color_index = 0;
            node.operators.forEach(function(op) {
                op.opId = ""+op.opId;
                // Create new op node(s)
                var opNode = {};
                opNode.rawData = op;                                    // Raw JSON data
                opNode.opType = op.opType;                              // Operand type
                var hasName = _.has(op, 'opName') && op.opName;
                var name = hasName ? op.opName.replace("Myria", "") : op.opId;  // Operand name
                opNode.fullName = name;
                opNode.opName = name.substring(0, 50) + (name.length > 50 ? "...": "");
                node.opNodes[op.opId] = opNode;
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
        if (graph.queryPlan.plan.fragments.length < 7) {
            for (var id in graph.nodes) {
                graph.state.opened.push(id);
            }
        }

        // Collect graph links
        for (var id in graph.nodes) {
            var fragment = graph.nodes[id];
            links[id] = {};
            fragment.operators.forEach(function(op) {
                // Add cross-fragment links
                if (op.hasOwnProperty('argOperatorId')) {
                    var link = {};                                      // Link object
                    link.u = {};
                    link.v = {};
                    link.u.fID = graph.opId2fId[""+op.argOperatorId];   // Src fragment ID
                    link.u.oID = ""+op.argOperatorId;                   // Src operand ID
                    link.v.fID = id;                                    // Dst fragment ID
                    link.v.oID = ""+op.opId;                            // Dst fragment ID
                    var linkID = link.u.fID + "->" + link.v.fID;        // Link ID
                    graph.links["link-" + linkID.hashCode()] = link;
                    graph.linkOrigins["link-" + linkID.hashCode()] = link.u.fID;
                }
                // Add in-fragment links
                for (var key in op) {
                    op.opId = ""+op.opId;
                    if (key == "argChildren") {
                        op[key].forEach(function(child){
                            child = ""+child;
                            var link = {};                                  // Link object
                            link.u = {};
                            link.v = {};
                            link.u.fID = id;                                // Src fragment ID
                            link.u.oID = child;                             // Src operand ID
                            link.v.fID = id;                                // Dst fragment ID
                            link.v.oID = ""+op.opId;                        // Dst fragment ID
                            var linkID = link.u.oID + "->" + link.v.oID;    // Link ID
                            fragment.opLinks["link-" + linkID.hashCode()] = link;

                            if (!_.has(links[id], ""+op.opId)) {
                                links[id][""+op.opId] = [];
                            }
                            links[id][""+op.opId].push(child);
                        });
                    } else if (key.indexOf("argChild") != -1) {
                        var link = {};                                  // Link object
                        link.u = {};
                        link.v = {};
                        link.u.fID = id;                                // Src fragment ID
                        link.u.oID = ""+op[key];                        // Src operand ID
                        link.v.fID = id;                                // Dst fragment ID
                        link.v.oID = ""+op.opId;                        // Dst fragment ID
                        var linkID = link.u.oID + "->" + link.v.oID;    // Link ID
                        fragment.opLinks["link-" + linkID.hashCode()] = link;

                        if (!_.has(links[id], ""+op.opId)) {
                            links[id][""+op.opId] = [];
                        }
                        links[id][""+op.opId].push(""+op[key]);
                    }
                }
            });
        }

        _.each(links, function(linkdict, fragid) {
            var roots = _.difference(_.keys(linkdict), _.flatten(_.values(linkdict)));
            if (roots.length !== 1) {
                console.warn("Too many roots");
            }
            var root = roots[0];
            var addChildren = function(id) {
                var c = {
                    id: id,
                    children: _.map(linkdict[id], addChildren)
                };
                return c;
            };
            graph.nested[fragid] = addChildren(root);
        });
    };

    // Function that loads the communication costs
    Graph.prototype.loadCosts = function(cb) {
        var url = templates.urls.aggregatedSentData({
            myria: myriaConnection,
            query: queryPlan.queryId,
        });

        var self = this;

        d3.csv(url, function(d) {
            d.numTuples = +d.numTuples;
            return d;
        }, function(data) {
            var d = _.pluck(data, "numTuples")
            var costs = d3.scale.linear().domain([_.min(d), _.max(d)]).range([2, 6]);
            self.costs = {};
            _.each(data, function(e) {
                self.costs["f" + e["fragmentId"]] = costs(e["numTuples"])
            });
            console.log(self.costs)
            cb()
        });
    };

    // Function that updates the graph edges when a fragment gets expanded
    Graph.prototype.expandNode = function(node) {
        this.state.opened = _.union(this.state.opened, [node]);
        this.state.focus = +node;
    };

    // Function that updates the graph edges when a fragment gets reduced
    Graph.prototype.reduceNode = function (node) {
        this.state.opened = _.without(this.state.opened, node);
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
        graph.state.opened.forEach(function(fragment) {
            dotStr += templates.graphViz.clusterStyle({ fragment: fragment, label:graph.nodes[fragment].name });
            for (var id in graph.nodes[fragment].opNodes) {
                var node = graph.nodes[fragment].opNodes[+id];
                dotStr += '\t\t"' + id + '"' + templates.graphViz.nodeStyle({ color: "white", label: node.opName });
            }
            for (var id in graph.nodes[fragment].opLinks) {
                var link = graph.nodes[fragment].opLinks[id];
                links += templates.graphViz.link({u: link.u.oID, v: link.v.oID});
            }
            dotStr += "\t}\n";
        });
        // closed fragments
        _.each(_.difference(_.keys(graph.nodes), graph.state.opened), function(key) {
            var node = graph.nodes[key];
            dotStr += '\t\t"' + key + '"' + templates.graphViz.nodeStyle({ color: "white", label: node.name });
        });
        dotStr += links + "}";
        return dotStr;
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
    Graph.prototype.generateD3data = function() {
        var graph = this;

        var graphDesc = graph.generatePlainDot();

        // Parse the plain description
        var graphDescRows = graphDesc.split("\n");
        graphDescRows.forEach(function(line) {
            var cols = line.split(" ");
            if(cols[0]=="node") {
                var id = ""+cols[1].replace(/\"/g, '');
                if (id in graph.nodes) {
                    graph.nodes[id].viz = {
                        id: id,
                        name: graph.nodes[id].name,
                        fullName: graph.nodes[id].name,
                        type: "fragment",
                        rawData: graph.nodes[id].rawData,
                        x: +cols[2]-cols[4]/2,
                        y: +cols[3]-cols[5]/2,
                        w: +cols[4],
                        h: +cols[5],
                        color: "lightgrey",
                        stroke: (graph.state.focus === id) ? "red" : "black"
                    };
                } else if (id in graph.opId2fId) {
                    var node = graph.nodes[graph.opId2fId[id]];
                    var opNode = node.opNodes[id];
                    opNode.viz = {
                        id: id,
                        name: opNode.opName,
                        fullName: opNode.fullName,
                        type: "operator",
                        optype: opNode.opType,
                        rawData: opNode.rawData,
                        x: +cols[2]-cols[4]/2,
                        y: +cols[3]-cols[5]/2,
                        w: +cols[4],
                        h: +cols[5],
                        color: (graph.state.focus === graph.opId2fId[id]) ? graph.opId2color[id] : "white",
                        stroke: "black"
                    };
                }
            } else if (cols[0]=="edge") {
                var linkID = undefined;
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
                var lid = "link-" + linkID.hashCode();
                if (type == "op") {
                    var link = graph.nodes[graph.opId2fId[src]].opLinks[lid];
                    link.viz = {
                        type: type,
                        src: src,
                        dst: dst,
                        points: points,
                        stroke: (graph.state.focus === lid) ? "red" : "black",
                        id: lid
                    };
                } else if (type == "frag") {
                    var link = graph.links[lid];
                    link.viz = {
                        type: type,
                        src: src,
                        dst: dst,
                        points: points,
                        stroke: (graph.state.focus === lid) ? "red" : "black",
                        id: lid
                    };
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
                name: fragment.name,
                fullName: fragment.name,
                type: "cluster",
                rawData: graph.nodes[fID].rawData,
                x: minX-padding/2,
                y: minY-padding/2 - padding,
                w: maxX-minX+padding,
                h: maxY-minY+padding + padding,
                color: "lightgrey",
                stroke: (graph.state.focus === fID) ? "red" : "black"
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

        self.chartElement = chartElement;

        var interactive = chartElement ? true : false;

        // D3 stuff...
        var margin = {top: 0, right: 0, bottom: 0, left:0 },
            width = parseInt(graphElement.style('width'), 10) - margin.left - margin.right;

        var zoom = d3.behavior.zoom()
            .scaleExtent([0.3, 2])
            .on('zoom', onzoom);

        var svg = graphElement
                    .append("svg")
                    .style("width", "100%")
                    .attr("class", "query-graph")
                    .call(zoom);
        var wrapper = svg
                    .append("g");
        var gel = wrapper.append("g"); // avoid jitter

        function onzoom() {
            gel.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
        }

        var D3data = self.generateD3data();

        // Initial rendering
        draw(D3data, true);

        // On click, update with new data
        if (interactive) {
            gel.attr("class", "interactive");

            gel.selectAll(".node")
                .on("click", function() {
                    if (d3.event.defaultPrevented) return;

                    var node = d3.select(this).data()[0];

                    // Handle fragment state
                    if (node.type == "cluster") {
                        if (node.id === self.state.focus) {
                            self.closeFragment(node.id);
                        } else {
                            self.openFragment(node.id);
                        }
                    } else if (node.type == "fragment") {
                        self.openFragment(node.id);
                    }
                });

            gel.selectAll(".link")
                .on("click", function() {
                    if (d3.event.defaultPrevented) return;

                    var line = d3.select(this).data()[0];

                    if (line.type == "frag") {
                        var src = (line.src in self.nodes) ? self.nodes[line.src].fragmentIndex : self.nodes[self.opId2fId[line.src]].fragmentIndex;
                        var dst = (line.dst in self.nodes) ? self.nodes[line.dst].fragmentIndex : self.nodes[self.opId2fId[line.dst]].fragmentIndex;
                        chartElement.selectAll("svg").remove();
                        networkVisualization(chartElement, [src, dst], self.queryPlan);
                        self.state.focus = line.id;
                        var newD3data = self.generateD3data();
                        draw(newD3data, false);
                    }
                });
        }

        function draw(data, initial) {
            /*
             * Axiom 1: we want the SVG viewport to be constant size. Resizing the SVG as we change zoom is distracting for users.
             *
             * Axiom 2: the entire SVG should be visible in the default view and zoom.
             *
             * Axiom 3: the width of the SVG viewport is fixed and determined by bootstrap.
             *
             * Consequence: we need to set the height based on the bootstrap width and the aspect ratio.
             */
            svg
                .style("height", (width * data.height / data.width) + "px");

            gel
                .attr("height", data.height*dpi)
                .attr("width", data.width*dpi);

            graphElement.style("height", (width * data.height / data.width + 15) + "px");

            if (initial) {
                var scale = width/(data.width*dpi + 10);
                if (scale < 1) {
                    zoom.scale(scale);
                }
                zoom.event(gel);
            }

            /* Nodes */
            var node = gel.selectAll("g.node")
                .data(data.nodes, function(d) { return d.id; });

            var nodeEnter = node.enter()
                .append("g");

            node
                .attr("class", function(d) { return "node " + d.type; });

            nodeEnter.append("rect")
                .attr("class", "node-rect")
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
                        if (value !== null && typeof value === 'object') {
                          value = templates.code({code: JSON.stringify(value)});
                        }
                        body += templates.row({key: key, value: value});
                    });
                    return {
                        title: templates.strong({text: d.fullName}),
                        content: templates.table({body: body})
                    };
                });

            node.select("circle").transition().duration(animationDuration)
                .attr("opacity", 1)
                .attr("cx", function(d) { return d.x * dpi; })
                .attr("cy", function(d) { return d.y * dpi; });

            node.select(".node-rect").transition().duration(animationDuration)
                .attr("opacity", 1)
                .attr("x", function(d) { return d.x * dpi; })
                .attr("y", function(d) { return d.y * dpi; })
                .attr("width", function(d) { return d.w * dpi; })
                .attr("height", function(d) { return d.h * dpi; })
                .attr("fill", function(d) { return d.color; })
                .attr("stroke", function(d) { return d.stroke; });

            var nodeLabel = nodeEnter.append("g").attr("class", "node-label");

            var textBackground = nodeLabel.filter(function(d) {
                    return d.type !== "cluster";
                }).append("rect")
                .attr("opacity", function() {
                    return initial ? 1 : 0;
                })
                .attr("height", 26)
                .attr("y", "-1.2em")
                .transition().duration(animationDuration)
                .transition().duration(shortDuration)
                .attr("opacity", 1);

            nodeLabel
                .append("text")
                .attr("opacity", function() {
                    return initial ? 1 : 0;
                })
                .attr("text-anchor", "middle")
                .attr("fill", "black")
                .attr("dy", "0.3em");

            node.select(".node-label text")
                .text(function(d) {
                    return d.name;
                })
                .transition().duration(animationDuration)
                .transition().duration(shortDuration)
                .attr("opacity", 1);

            textBackground
                .attr("width", function(d) {
                    return 1.2 * d3.select(this.parentNode).select("text").node().getBBox().width;
                }).attr("x", function(d) {
                    return - 1.2 * d3.select(this.parentNode).select("text").node().getBBox().width / 2;
                });

            node.select(".node-label")
                .transition().duration(function(d) {
                    return initial ? 0 : animationDuration;
                })
                .attr("transform", function(d) {
                    var y = (d.y+d.h/2) * dpi,
                        x = (d.x+d.w/2) * dpi;
                    if (d.type == "cluster") {
                        y = (d.y+padding * 0.7) * dpi;
                    }
                    return "translate(" + [x, y] + ")";
                });

            node.exit().select(".node-rect").transition().duration(shortDuration)
                .attr("opacity", 0);

            node.exit().select("text").remove();

            node.exit().select("circle").remove();

            node.exit().transition().duration(shortDuration).remove();

            /* Links */

            var line = d3.svg.line()
                .x(function(d) { return d[0] * dpi; })
                .y(function(d) { return d[1] * dpi; })
                .interpolate("montone");

            var link = gel.selectAll("g.link")
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

            link.select("marker").transition().duration(shortDuration)
                .attr("fill", function(d) {
                    return d.stroke;
                });

            link.select("path.line").transition().duration(animationDuration)
                .attr("opacity", 1)
                .attr("d", function(d) { return line(d.points); })
                .attr("stroke", function(d) { return d.stroke; })
                .attr("marker-end", function(d) { return templates.markerUrl({ name: d.id });})
                .attr("stroke-width", function(d) {
                    var x = self.costs[self.linkOrigins[d.id]];
                    if (x !== undefined) {
                        return x;
                    }
                    return 3;
                });

            link.select("path.clickme")
                .attr("d", function(d) { return line(d.points); })
                .attr("stroke", "black");

            link.exit().select("path").transition().duration(shortDuration)
                .attr("opacity", 0);

            link.exit().select("marker").transition().duration(shortDuration)
                .attr("fill-opacity", 0);

            link.exit().transition().duration(shortDuration).remove();
        }

        Graph.prototype.draw = draw;
    };

    Graph.prototype.openFragment = function(nodeId) {
        var self = this;

        self.expandNode(nodeId);
        self.state.focus = nodeId;
        fragmentVisualization(self.chartElement, self.nodes[nodeId].fragmentIndex, self.queryPlan, self);

        var newD3data = self.generateD3data();
        self.draw(newD3data, false);
    };

    Graph.prototype.closeFragment = function(nodeId) {
        var self = this;

        self.state.focus = "";
        self.reduceNode(nodeId);
        self.openOverview();

        var newD3data = self.generateD3data();
        self.draw(newD3data, false);
    };

    Graph.prototype.unfocus = function() {
        var self = this;

        self.state.focus = "";
        var newD3data = self.generateD3data();
        self.draw(newD3data, false);
    };

    Graph.prototype.openOverview = function() {
        var self = this;
        var allFragments = _.pluck(self.queryPlan.plan.fragments, 'fragmentIndex');
        manyLineCharts(self.chartElement, allFragments, self.queryPlan, self);
    };
}
