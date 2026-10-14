// ReachSense six-finger wrap v1. Units: mm. Experimental, physically unverified.
// R: +X lateral, +Y distal (towards fingertip), +Z dorsal.
// The marker deck's distal edge and the stop's inner contact face are both Y=0.
// The outer stop is Y=1.2; it is NOT the anatomical reference.
// The stop constrains Y only. Anatomical X/Z and placement repeatability are unverified.
$fn = 64;
part = "holder"; // "holder" or "strap"
marker_id = 23;
finger_diameter_mm = 14;
marker_edge_mm = 10;
quiet_zone_mm = 2;
frame_mm = 1;
wall_mm = 2;
stop_wall_mm = 1.2;
strap_width_mm = 6;
strap_length_mm = 90;

r = finger_diameter_mm/2;
tile = marker_edge_mm + 2*quiet_zone_mm;
deck_width = tile + 2*frame_mm;
length = tile + 2*frame_mm + 8;
deck_bottom = r + wall_mm - 0.8;
deck_top = deck_bottom + 2;
pocket_depth = 0.2;
marker_y = -(frame_mm + quiet_zone_mm + marker_edge_mm/2);
support_y = [-5, -length+5];

assert(finger_diameter_mm >= 12 && finger_diameter_mm <= 26, "Choose a 12–26 mm candidate opening");
assert(marker_edge_mm >= 8 && marker_edge_mm <= 16, "Choose an 8–16 mm black edge");
assert(quiet_zone_mm >= 2, "Keep the full white quiet zone");
assert(marker_id >= 0 && marker_id < 100, "DICT_4X4_100 ID required");

module support(y) {
    translate([0,y,0]) intersection() {
        difference() {
            rotate([90,0,0]) cylinder(r=r+wall_mm,h=6.8,center=true);
            rotate([90,0,0]) cylinder(r=r,h=8.8,center=true);
        }
        translate([-r-wall_mm-1,-4.4,0]) cube([2*(r+wall_mm+1),8.8,r+wall_mm+1]);
    }
    // Through-slots for 6 mm hook-and-loop strap or the optional TPU strip.
    for(sign=[-1,1]) translate([sign*(r+wall_mm+2.1),y,1.5]) difference() {
        cube([6,8.8,3],center=true);
        cube([2.6,6.4,5],center=true);
    }
}

module holder() {
    difference() {
        union() {
            for(y=support_y) support(y);
            translate([-deck_width/2,-length,deck_bottom]) cube([deck_width,length,2]);
            // Front stop contacts the fingertip at its INNER face Y=0.
            // Deck ends at Y=0 while this wall extends beyond it, preserving the reference.
            translate([-3,0,0]) cube([6,stop_wall_mm,deck_top]);
        }
        // Shallow square registration recess. Keep all 2 mm white margins visible.
        translate([-tile/2-0.1,marker_y-tile/2-0.1,deck_top-pocket_depth])
            cube([tile+0.2,tile+0.2,pocket_depth+1]);
        // Identity comes from the attached printed marker. Geometry is shared by size.
    }
}

module strap() {
    // TPU-only ladder strip. Its ends need a return loop/fastener or hook-and-loop tape.
    // This is not an articulated hard-plastic chain or a validated locking buckle.
    union() {
        translate([-strap_length_mm/2,-strap_width_mm/2,0])
            cube([strap_length_mm,strap_width_mm,0.8]);
        for(x=[-strap_length_mm/2+3:4:strap_length_mm/2-3])
            translate([x-0.7,-strap_width_mm/2,0.8]) cube([1.4,strap_width_mm,0.5]);
    }
}

if(part == "strap") strap(); else holder();
echo(reference_plane_y_mm=0, outer_stop_y_mm=stop_wall_mm);
echo(marker_center_R_mm=[0,marker_y,deck_top-pocket_depth+0.15]);
echo(marker_center_to_distal_deck_edge_mm=-marker_y);
