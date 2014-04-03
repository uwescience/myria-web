// adapted from: https://gist.github.com/mrfr0g/5968059

(function () {
    // Bootstrap provided getPosition uses offsetWidth and offsetHeight to calculate
    // the positioning of the tooltip. SVG Elements do not have this property because
    // SVG does not layout elements, it assumes elements are always positioned.
    // This replaces their implementation for SVG elements, and utilizes getBoundingClientRect.
    var getPosition = $.fn.tooltip.Constructor.prototype.getPosition;
    $.fn.tooltip.Constructor.prototype.getPosition = function (inside) {
        var svgParent = this.$element.parents('svg');
        // Only apply to SVG children
        // Test for iOS 3/BlackBerry
        if(svgParent.length && Element.prototype.getBoundingClientRect) {
            // Get initial offset
            var offset = this.$element.offset(),
                // Get rect (with width/height values)
                rect = this.$element[0].getBoundingClientRect();

            offset.width = rect.width;
            offset.height = rect.height;

            // Return the completed object
            return offset;
        }
        return getPosition.call(this, inside);
    };

    // Attach the tooltip method to d3's selection object
    d3.selection.prototype.tooltip = function (/* Accepts value, or function */ accessorOrValue) {
        this.each(function (d) {
            var tooltip = accessorOrValue instanceof Function ? null : accessorOrValue;

            tooltip = tooltip || accessorOrValue && accessorOrValue(d) || d.tooltip;

            if(tooltip) {
                $(this).tooltip({
                    title: tooltip,
                    container: 'body',
                    html: true
                });
            }
        });

        return this;
    };
})();