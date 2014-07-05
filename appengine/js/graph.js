//query graph and profiling charts
var queryGraphInteractive = function (element, queryPlan) {
    var chartElement = d3.select('.chart');

    var graphObj = new Graph();
    graphObj.loadQueryPlan(queryPlan);
    graphObj.render(element, chartElement);
    graphObj.openOverview();
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
    this.name = "";             // Query Name
    this.qId = 0;               // Query ID
    this.nodes = {};            // List of graph fragment nodes
    this.links = {};            // List of graph fragment edges
    this.interQueryLinks = {};  // List of inter subQuery links
    this.state = {};            // Describes which nodes are "expanded"
    this.opId2color = {};       // Dictionary of opId - color
    this.opId2fId = {};         // Dictionary of opId - fragment ID
    this.queryPlan = {};        // Physical plan
    this.fragmentColor = "";    // Fragment color
    this.subQueryColor = "";    // SubQuery color

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
        var root = graph.queryPlan.physicalPlan.plan;

        // Create fragmentIndex
        graph.createFragmentIndex(root);

        // Create subQueryIndex
        graph.createSubQueryIndex(root, graph);

        // Normalize operator ids
        graph.normalizeOpIds(root);

        // Collect graph nodes
        graph.collectGraphNodes(root, graph);

        // If there are more than 7 fragments, do not expand
        for (var id in graph.nodes) {
            graph.state.opened.push(id);
        }

        // Collect graph links
        graph.collectIntraQueryLinks(root, graph);
        graph.collectInterQueryLinks(root, graph);

    };

    // Create fragmentIndex for each SubQuery
    Graph.prototype.createFragmentIndex = function createFragmentIndex(plan) {
        if(plan.type == 'SubQuery') {
            var i = 0;
            _.each(plan.fragments, function (frag) {
                frag.fragmentIndex = i++;
            });
        } else if(plan.type == 'Sequence') {
            _.each(plan.plans, createFragmentIndex);
        } else if(plan.type == 'DoWhile') {
            _.each(plan.body, createFragmentIndex);
        }
    };

    // Create SubQuery index recursively
    Graph.prototype.createSubQueryIndex = function createSubQueryIndex(plan, graph) {
        var i = 0;
        (function iterateSubQuery(plan){
            plan.subQueryIndex = i++;
            graph.interQueryLinks[plan.subQueryIndex] = {};
            if(plan.type == 'Sequence') {
                _.each(plan.plans, iterateSubQuery);
            } else if(plan.type == 'DoWhile') {
                _.each(plan.body, iterateSubQuery);
            }
        })(plan);
    };

    // normalize operator id: add SubQuery prefix to operator id, unify children
    Graph.prototype.normalizeOpIds = function normalizeOpIds(plan) {
        if(plan.type == 'SubQuery') {
            _.each(plan.fragments, function(fragment){
                _.each(fragment.operators, function(op){
                    //add subQueryIndex prefix
                    op.opId = "s"+plan.subQueryIndex+"_op"+op.opId;
                    //unify children
                    _.each(op, function(value, key, op){
                        if (key == "argChildren"){
                            op.children = _.map(op.argChildren, function(id){
                                return "s"+plan.subQueryIndex+"_op"+id;
                            });
                        } else if(key.indexOf("argChild") != -1) {
                            var newid = "s"+plan.subQueryIndex+"_op"+op[key];
                            if("children" in op){
                                op.children.push(newid);
                            } else {
                                op.children = [newid];
                            }
                        } else if(key == "argOperatorId") {
                            op[key] = "s"+plan.subQueryIndex+"_op"+op[key];
                        }
                    });
                });
            });
        } else if(plan.type == 'Sequence') {
            _.each(plan.plans, normalizeOpIds);
        } else if(plan.type == 'DoWhile') {
            _.each(plan.body, normalizeOpIds);
        }
    };

    // Collect graph nodes
    Graph.prototype.collectGraphNodes = function collectGraphNodes(plan, graph){
        if(plan.type == 'SubQuery') {
            plan.fragments.forEach(function(fragment) {
                // Create fragment node object
                var node = {};                                               // Node object
                var id = "s"+plan.subQueryIndex+"_f"+fragment.fragmentIndex; // Node ID
                fragment.fid = id;                                           // fid
                node.fragmentIndex = fragment.fragmentIndex;                 // Fragment ID
                node.subQueryIndex = plan.subQueryIndex;                     //SubQuery ID
                node.rawData = fragment;                                     // RAW JSON data
                node.workers = fragment.workers;                             // List of workers
                node.operators = fragment.operators;                         // List of operators
                node.opNodes = {};                                           // List of graph operand nodes
                node.parents = {};                                           // List of parents
                node.linkvizes = {};                                          // List of link vizs
                node.name = "Fragment " + fragment.fragmentIndex.toString(); // Name for fragment node

                // Process each operator
                var color_index = 0;
                node.operators.forEach(function(op) {
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
        } else if(plan.type == 'Sequence') {
            _.each(plan.plans, function(element){
                collectGraphNodes(element, graph);
            });
        } else if(plan.type == 'DoWhile') {
            _.each(plan.body, function(element){
                collectGraphNodes(element, graph);
            });
        }
    };

    // Collect intra subQuery links
    Graph.prototype.collectIntraQueryLinks = function collectIntraQueryLinks(plan, graph){
        if(plan.type == 'SubQuery'){
            plan.links = {};
            _.each(plan.fragments, function(fragment){
                var parents = {};
                _.each(fragment.operators, function(op){
                    // Add cross-fragment links
                    if (op.hasOwnProperty('argOperatorId')) {
                        var link = {};                                      // Link object
                        link.u = {};
                        link.v = {};
                        link.u.fID = graph.opId2fId[op.argOperatorId];      // Src fragment ID
                        link.u.oID = op.argOperatorId;                      // Src operand ID
                        link.v.fID = graph.opId2fId[op.opId];               // Dst fragment ID
                        link.v.oID = op.opId;                               // Dst operand ID
                        var linkID = link.u.fID + "->" + link.v.fID;        // Link ID
                        plan.links["link-"+linkID.hashCode()] = link;
                        graph.links["link-"+linkID.hashCode()] = link;
                    }
                    // Add intra-fragment links
                    if(op.hasOwnProperty("children")){
                        _.each(op.children, function(child){
                            // intra-fragment link only have single parent
                            if(_.has(parents, child)){
                                console.warn("an operator cannot have multiple parents.");
                            }
                            parents[child] = op.opId;
                        });
                    }
                });
                fragment.parents = parents;
                graph.nodes[fragment.fid].parents = parents;

                // Get the root operator of the fragment
                var roots = _.difference(_.values(parents), _.keys(parents));
                if (roots.length !== 1) {
                    console.warn("Too many roots");
                }
                fragment.root = roots[0];

                // Get a leaf operator of the fragment
                var leaves = _.difference(_.keys(parents), _.values(parents));
                fragment.aLeaf = leaves[0];
            });
            plan.root = _.first(plan.fragments).root;
            plan.aLeaf = _.last(plan.fragments).aLeaf;
        } else if(plan.type == 'Sequence') {
            _.each(plan.plans, function(element){
                collectIntraQueryLinks(element, graph);
            });
            plan.root = _.last(plan.plans).root;
            plan.aLeaf = _.first(plan.plans).aLeaf;
        } else if(plan.type == 'DoWhile') {
            _.each(plan.body, function(element){
                collectIntraQueryLinks(element, graph);
            });
            plan.root = _.last(plan.body).root;
            plan.aLeaf = _.first(plan.body).aLeaf;
        }
    };


    // Collect inter subQuery links
    Graph.prototype.collectInterQueryLinks = function collectInterQueryLinks(plan, graph){
        if(plan.type == 'Sequence') {
            var lastRoot = "";
            _.each(plan.plans, function(element){
                // add link from a subQuery in a sequence to the next subQuery
                if(lastRoot !== ""){
                    var link = {};
                    link.u = {};
                    link.v = {};
                    link.u.fID = graph.opId2fId[lastRoot];
                    link.u.oID = lastRoot;
                    link.v.fID = graph.opId2fId[element.aLeaf];
                    link.v.oID = element.aLeaf;
                    var linkID = link.u.fID + "->" + link.v.fID; 
                    graph.links["link-"+linkID.hashCode()] = link;
                    graph.interQueryLinks[plan.subQueryIndex][linkID] = link;
                }
                lastRoot = element.root;
                collectInterQueryLinks(element, graph);
            });
        } else if(plan.type == 'DoWhile') {
            _.each(plan.body, function(element){
                collectInterQueryLinks(element, graph);
            });
        }
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
        var root = graph.queryPlan.physicalPlan.plan;
        // Derive the graph DOT specification from the GraphObj
        var dotStrPrefix = "digraph G { \n\trankdir = \"BT\";\n\n";
        var dotStr = graph.subgraphDot(root, "", graph);
        return dotStrPrefix + dotStr.dotStr + "}";
    };

    // Generate subgraph dot string
    Graph.prototype.subgraphDot = function subgraphDot(plan, dotstring, graph) {
        var ret = {};
        if(plan.type == 'SubQuery'){
            var subqDotStr = dotstring + templates.graphViz.subqueryStyle({ subQuery: "subQuery_"+plan.subQueryIndex, label: "subQuery "+plan.subQueryIndex});
            
            // First add the fragment links
            _.each(plan.links, function(link, id){
                var u = graph.state.opened.indexOf(link.u.fID)==-1 ? link.u.fID : link.u.oID;
                var v = graph.state.opened.indexOf(link.v.fID)==-1 ? link.v.fID : link.v.oID;
                subqDotStr += templates.graphViz.link({u: u, v: v});
            });

            // Then add the operand links in fragments
            var openedFrags = _.filter(plan.fragments, function(fragment){ 
                return _.indexOf(graph.state.opened, fragment.fid) != -1; 
            });
            _.each(openedFrags, function(fragment) {
                subqDotStr += templates.graphViz.fragmentStyle({ fragment: fragment.fid, label:graph.nodes[fragment.fid].name });
                for (var id in graph.nodes[fragment.fid].opNodes) {
                    var node = graph.nodes[fragment.fid].opNodes[id];
                    subqDotStr += '\t\t"' + id + '"' + templates.graphViz.nodeStyle({ color: "white", label: node.opName });
                }
                _.each(graph.nodes[fragment.fid].parents, function(dst, src){
                    if(dst === undefined || src === undefined){
                        console.warn("null node.");
                    }
                    subqDotStr += templates.graphViz.link({u: src, v: dst});
                });

                subqDotStr += "\t}\n";
            });
            
            // close fragments
            _.each(_.difference(_.keys(graph.nodes), graph.state.opened), function(key) {
                var node = graph.nodes[key];
                subqDotStr += '\t\t"' + key + '"' + templates.graphViz.nodeStyle({ color: "white", label: node.name });
            });

            // close subQuery
            subqDotStr += "}";

            ret.aLeaf = _.last(plan.fragments).aLeaf;
            ret.root = _.first(plan.fragments).root;
            ret.dotStr = subqDotStr;
        } else if(plan.type == 'Sequence') {
            // add edges between children
            var seqDotStr = templates.graphViz.subqueryStyle({subQuery: "subQuery_"+plan.subQueryIndex, label: "subQuery "+plan.subQueryIndex});
            var lastRoot = "";
            _.each(plan.plans, function(plan){
               var sgdot = subgraphDot(plan, dotstring, graph);
               seqDotStr += sgdot.dotStr;
               if(lastRoot !== ""){
                    if(lastRoot === undefined || sgdot.aLeaf === undefined){
                        console.warn("null node.");
                    }
                    seqDotStr += templates.graphViz.link({u: lastRoot, v: sgdot.aLeaf});
               }
               lastRoot = sgdot.root; 
            });
            seqDotStr += "}\n";
            // set aLeaf and root
            ret.aLeaf = _.first(plan.plans).aLeaf;
            ret.root = _.last(plan.plans).root;
            ret.dotStr = seqDotStr;
        } else if(plan.type == 'DoWhile') {
            // add while condition edge
            var dowhileDotStr = "";
            _.each(plan.body, function(plan){
               dowhileDotStr += subgraphDot(plan, dotstring, graph).dotStr;
            });
            ret.aLeaf = _.first(plan.body).aLeaf;
            ret.root = _.last(plan.body).root;
            ret.dotStr = dowhileDotStr;
        } else {
            console.warn("plan should be SubQuery or Sequence or DoWhile");
        }
        return ret;
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
        console.log(dotStr);

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
                var linkID;
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
                if(linkID === undefined){
                    console.warn("linkID is undefined.");
                }
                var lid = "link-" + linkID.hashCode();
                var oplinkviz = {};
                if (type == "op") {
                    oplinkviz = {
                        type: type,
                        src: src,
                        dst: dst,
                        points: points,
                        stroke: (graph.state.focus === lid) ? "red" : "black",
                        id: lid
                    };
                    graph.nodes[graph.opId2fId[src]].linkvizes[src] = oplinkviz;
                } else if (type == "frag") {
                    link = graph.links[lid];   
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
            for (var oID in fragment.opNodes) {
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
            for (var opId in fragment.opNodes) {
                var opNode = fragment.opNodes[opId];
                nodes.push(opNode.viz);
            }
            // Add links
            for (opId in fragment.parents) {
                if (fragment.linkvizes[opId] === undefined){
                    console.warn("linkviz is undefined");
                }
                links.push(fragment.linkvizes[opId]);
            }
        });
        // Add non-exploded fragments
        for (var fragID in graph.nodes) {
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
            svg
                .style("height", (data.height + 0.5)*dpi);

            gel
                .attr("height", data.height*dpi)
                .attr("width", data.width*dpi);

            graphElement.style("height", (data.height + 0.5)*dpi + "px");

            if (initial) {
                    var scale = width/(data.width*dpi + 10);
                if (scale < 1) {
                    zoom.scale(scale);
                } else {
                    scale = 1;
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
                .data(data.links, function(d) { 
                    return d.id; 
                });

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
                .attr("marker-end", function(d) { return templates.markerUrl({ name: d.id });});

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
        var allFragments = _.pluck(self.queryPlan.physicalPlan.plan.fragments, 'fragmentIndex');
        manyLineCharts(self.chartElement, allFragments, self.queryPlan, self);
    };
}
