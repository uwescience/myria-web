var operatorVisualization = function (element, fragmentId, queryPlan, graph) {
    //$(element.node()).empty();

    var idNameMapping = nameMappingFromFragments(queryPlan.physicalPlan.fragments);

    var margin = {top: 0, right: 0, bottom: 0, left: 0 },
        width = parseInt(element.style('width'), 10) - margin.left - margin.right,
        height = 200 - margin.top - margin.bottom;

    var rootSize = 0;

    var treemap = d3.layout.treemap()
        .size([width, height])
        .sticky(false)
        .round(true)
        .padding(5)
        .value(function(d) { return _.max([d.size, 1540159000/100]); });

    var div = element.append("div")
        .style("position", "relative")
        .style("width", (width) + "px")
        .style("height", (height) + "px")
        .style("left", margin.left + "px")
        .style("top", margin.top + "px")
        .attr("class", "treemap");

    var url = templates.urls.contribution({
        myria: myriaConnection,
        query: queryPlan.queryId,
        fragment: fragmentId
    });

    d3.csv(url, function(error, data) {
        data = _.object(_.map(data, function(x){return [x.opId, +x.nanoTime]; }));

        function addSizes(node) {
            if (node.children === undefined || node.children.length === 0) {
                node.size = data[node.name];
            } else {
                _.map(node.children, addSizes);
                var size = data[node.name] - _.reduce(_.map(node.children, function(child) {
                    return data[child.name];
                }), function(memo, num){ return memo + num; });
                node.children.push({
                    name: node.name,
                    size: size,
                    children: []
                });
            }
        }

        // var nested = _.cloneDeep(graph.nested);
        // var root = {name: "query plan", children: []}
        // _.each(nested, function(tree, fragId) {
        //     root.children.push(tree);
        // });
        // rootSize = _.reduce(_.map(root.children, function(child) {
        //     return data[child.name];
        // }), function(memo, num){ return memo + num; });
        // root.size = rootSize;

        var root = _.cloneDeep(graph.nested[fragmentId]);
        rootSize = data[root.name];
        addSizes(root);

        var node = div.datum(root).selectAll(".node")
            .data(treemap.nodes)
          .enter().append("div")
            .attr("class", "node")
            .call(position)
            .style("border-color", function(d) { return opToColor[d.name]; })
            .style("background", function(d) { return d.children ? null : opToColor[d.name]; })
            .text(function(d) { return d.children ? null : idNameMapping[d.name]; })
            .popover(function(d) {
                var body = templates.opPopover({ time: customFullTimeFormat(d.value)});
                return {
                    title: templates.strong({text: idNameMapping[d.name]}),
                    content: templates.table({body: body})
                };
            });
    });

    // return variables that are needed outside this scope
    return {};
};

function position() {
  this.style("left", function(d) { return d.x + "px"; })
      .style("top", function(d) { return d.y + "px"; })
      .style("width", function(d) { return Math.max(0, d.dx - 1) + "px"; })
      .style("height", function(d) { return Math.max(0, d.dy - 1) + "px"; });
}
