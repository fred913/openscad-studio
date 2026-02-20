// Reusable part modules
// This file is loaded via `use <parts.scad>` so only modules
// and functions are available (not top-level variables).

use <helpers.scad>

// A simple box with a cylindrical hole
module box_with_hole(size, hole_r) {
  difference() {
    cube(size, center = true);
    cylinder(r = hole_r, h = size + 1, center = true);
  }
}

// A hollow cylinder (tube)
module hollow_cylinder(outer_r, h, wall) {
  difference() {
    cylinder(r = outer_r, h = h);
    translate([0, 0, -1])
      cylinder(r = outer_r - wall, h = h + 2);
  }
}

// A plus-shaped beam
module cross_beam(length, width, height) {
  union() {
    cube([length, width, height], center = true);
    cube([width, length, height], center = true);
  }
}

// A hexagonal prism (uses helpers.scad)
module hex_standoff(radius, height) {
  prism(6, radius, height);
}
