
module.exports = {
    getFragment: function(lines, loc) {
        var toEnd = (loc.end === 'EOF');

        var line1 = loc.start.line;
        var line2 = toEnd ? lines.length - 1 : loc.end.line;

        var col1 = loc.start.column;
        var col2 = toEnd ? lines[line2].length : loc.end.column;

        var fragment = '';

        if (line1 === line2) {
            fragment = lines[line1].substring(col1, col2);
        } else {
            fragment = lines[line1].substring(col1) + '\n';

            for (var line = line1 + 1; line < line2; ++line) {
                fragment += lines[line] + '\n';
            }
            fragment += lines[line2].substring(0, col2);
        }

        return fragment;
    }
};
