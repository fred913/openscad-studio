// Low-level helper functions and modules
// This file is `use`d by parts.scad, testing that transitive
// dependencies (nested includes/uses) resolve correctly.

// Clamp a value between min and max
function clamp(val, lo, hi) = max(lo, min(hi, val));

// Linear interpolation
function lerp(a, b, t) = a + (b - a) * clamp(t, 0, 1);

// Generate a regular polygon as a list of 2D points
function regular_polygon(sides, radius) = [
  for (i = [0:sides - 1])
    [radius * cos(i * 360 / sides), radius * sin(i * 360 / sides)]
];

// Extrude a regular polygon
module prism(sides, radius, height) {
  linear_extrude(height = height)
    polygon(regular_polygon(sides, radius));
}
