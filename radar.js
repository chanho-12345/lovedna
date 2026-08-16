/* Radar chart — dependency-free inline SVG, follows dataviz mark specs:
   2px lines, round joins, ~10% opacity area fill, >=8px end markers with
   2px surface ring, hairline gray grid, legend for 2+ series, direct axis labels. */
(function (root) {
  "use strict";

  var SURFACE = "#fff7fb";
  var GRID = "#e8dbe4";
  var AXIS_TEXT = "#7a6b76";

  function polarPoint(cx, cy, r, angleDeg) {
    var rad = ((angleDeg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  }

  function renderRadar(opts) {
    // opts: { labels: [6 strings], series: [{label, color, values:[6 nums 0-100]}], size }
    var size = opts.size || 320;
    var cx = size / 2;
    var cy = size / 2 + 6;
    var maxR = size * 0.32;
    var labels = opts.labels;
    var n = labels.length;
    var rings = [0.25, 0.5, 0.75, 1];

    var svg = [];
    var padX = 44;
    var vbW = size + padX * 2;
    var vbH = size + 34;
    svg.push('<svg viewBox="' + -padX + ' 0 ' + vbW + ' ' + vbH + '" width="100%" role="img" aria-label="레이더 차트">');
    svg.push('<rect x="' + -padX + '" y="0" width="' + vbW + '" height="' + vbH + '" fill="' + SURFACE + '" rx="16"/>');

    // grid rings
    rings.forEach(function (frac) {
      var pts = [];
      for (var i = 0; i < n; i++) {
        var ang = (360 / n) * i;
        var p = polarPoint(cx, cy, maxR * frac, ang);
        pts.push(p[0].toFixed(1) + "," + p[1].toFixed(1));
      }
      svg.push('<polygon points="' + pts.join(" ") + '" fill="none" stroke="' + GRID + '" stroke-width="1"/>');
    });

    // axis lines + labels
    for (var i = 0; i < n; i++) {
      var ang = (360 / n) * i;
      var end = polarPoint(cx, cy, maxR, ang);
      svg.push('<line x1="' + cx + '" y1="' + cy + '" x2="' + end[0].toFixed(1) + '" y2="' + end[1].toFixed(1) + '" stroke="' + GRID + '" stroke-width="1"/>');
      var labelP = polarPoint(cx, cy, maxR + 22, ang);
      var anchor = "middle";
      if (labelP[0] > cx + 4) anchor = "start";
      else if (labelP[0] < cx - 4) anchor = "end";
      svg.push(
        '<text x="' + labelP[0].toFixed(1) + '" y="' + labelP[1].toFixed(1) +
        '" text-anchor="' + anchor + '" dominant-baseline="middle" font-size="12" font-weight="600" fill="' + AXIS_TEXT + '">' +
        labels[i] + "</text>"
      );
    }

    // series (area fill @10% opacity, 2px stroke round join, >=8px end markers w/ 2px surface ring)
    opts.series.forEach(function (s) {
      var pts = [];
      var markers = [];
      for (var i = 0; i < n; i++) {
        var ang = (360 / n) * i;
        var r = maxR * (Math.max(0, Math.min(100, s.values[i])) / 100);
        var p = polarPoint(cx, cy, r, ang);
        pts.push(p[0].toFixed(1) + "," + p[1].toFixed(1));
        markers.push(p);
      }
      svg.push('<polygon points="' + pts.join(" ") + '" fill="' + s.color + '" fill-opacity="0.14" stroke="' + s.color + '" stroke-width="2" stroke-linejoin="round"/>');
      markers.forEach(function (p) {
        svg.push('<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="6" fill="' + s.color + '" stroke="' + SURFACE + '" stroke-width="2"/>');
      });
    });

    // legend (only for 2+ series)
    if (opts.series.length > 1) {
      var lx = 16, ly = size + 20, gap = 0;
      svg.push('<g font-size="12" font-weight="600">');
      opts.series.forEach(function (s, idx) {
        var x = lx + gap;
        svg.push('<circle cx="' + (x + 5) + '" cy="' + ly + '" r="5" fill="' + s.color + '"/>');
        svg.push('<text x="' + (x + 16) + '" y="' + (ly + 4) + '" fill="#5a4d56">' + s.label + "</text>");
        gap += 18 + s.label.length * 13;
      });
      svg.push("</g>");
    }

    svg.push("</svg>");
    return svg.join("");
  }

  var api = { renderRadar: renderRadar };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.LoveDNARadar = api;
})(typeof window !== "undefined" ? window : global);
