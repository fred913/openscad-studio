// Multi-file workspace example
// Open this file in OpenSCAD Studio to test include/use support.
// All .scad files in this directory will be mounted automatically.

use <parts.scad>
include <config.scad>

// Layout all parts using shared config values
spacing = part_size * 2.5;

// Base plate
color("SlateGray")
  translate([0, 0, -2])
    cube([spacing * 3, spacing * 2, 2], center = true);

// Row 1
translate([-spacing, spacing / 2, 0])
  box_with_hole(part_size, part_size / 4);

translate([0, spacing / 2, 0])
  hollow_cylinder(part_size / 2, part_size, wall_thickness);

translate([spacing, spacing / 2, 0])
  cross_beam(part_size * 1.5, part_size / 3, part_size / 3);

// Row 2
translate([0, -spacing / 2, 0])
  hex_standoff(part_size / 3, part_size);
