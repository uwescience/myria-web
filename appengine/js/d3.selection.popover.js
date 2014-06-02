// adapted from: https://gist.github.com/mrfr0g/5968059

(function () {
    // Bootstrap provided getPosition uses offsetWidth and offsetHeight to calculate
    // the positioning of the popover. SVG Elements do not have this property because
    // SVG does not layout elements, it assumes elements are always positioned.
    // This replaces their implementation for SVG elements, and utilizes getBoundingClientRect.
    var getPosition = $.fn.popover.Constructor.prototype.getPosition;
    $.fn.popover.Constructor.prototype.getPosition = function (inside) {
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

    // Attach the popover method to d3's selection object
    d3.selection.prototype.popover = function (/* Accepts value, or function */ accessorOrValue) {
        this.each(function (d) {
            var popover = accessorOrValue instanceof Function ? null : accessorOrValue;

            popover = popover || accessorOrValue && accessorOrValue(d) || d.popover;

            if(popover) {
                $(this).popover({
                    title: popover.title,
                    content: popover.content,
                    container: 'body',
                    placement: popover.placement ? popover.placement : 'auto',
                    offset: 10,
                    trigger: 'manual',
                    html: true,
                    template: '<div class="popover" onmouseover="clearTimeout(timeoutObj);$(this).mouseleave(function() {$(this).hide();});"><div class="arrow"></div><div class="popover-inner"><h3 class="popover-title"></h3><div class="popover-content"><p></p></div></div></div>'
                }).mouseenter(function(e) {
                    $(this).popover('show');
                }).mouseleave(function(e) {
                    var ref = $(this);
                    timeoutObj = setTimeout(function(){
                        ref.popover('hide');
                    }, 100);
                });
            }
        });

        return this;
    };
})();