// ReachSense six-finger wrap v2. Units: mm. Experimental, physically unverified.
// R: +X lateral, +Y distal (towards fingertip), +Z dorsal.
// A REMOVABLE seating gauge defines Y=0. The wearable deck ends at Y=-3.
// Remove the gauge before testing; no permanent wall blocks the fingertip.
// This defines nominal longitudinal registration, NOT an anatomical 3D point.
$fn = 48;
part = "holder"; // "holder", "gauge" or "strap"
marker_id = 23;
finger_diameter_mm = 14;
marker_edge_mm = 10;
quiet_zone_mm = 2;
frame_mm = 1;
wall_mm = 2;
stop_wall_mm = 1.2;
strap_width_mm = 6;
strap_length_mm = 90;
gauge_side_clearance_mm = 0.3;
r = finger_diameter_mm/2;
tile = marker_edge_mm + 2*quiet_zone_mm;
deck_width = tile + 2*frame_mm;
length = tile + 2*frame_mm + 8;
deck_front_y = -3;
deck_back_y = deck_front_y-length;
deck_bottom = r + wall_mm - 0.8;
deck_top = deck_bottom + 2;
pocket_depth = 0.2;
marker_y = deck_front_y-(frame_mm+quiet_zone_mm+marker_edge_mm/2);
support_y = [deck_front_y-5,deck_back_y+5];
nail_seat_width = min(8,finger_diameter_mm/2);
nail_seat_z = r-0.6;
assert(finger_diameter_mm >= 12 && finger_diameter_mm <= 26,"Choose a 12–26 mm candidate opening");
assert(marker_edge_mm >= 8 && marker_edge_mm <= 16,"Choose an 8–16 mm black edge");
assert(quiet_zone_mm >= 2,"Keep the full white quiet zone");
assert(marker_id >= 0 && marker_id < 100,"DICT_4X4_100 ID required");
module support(y) {
    translate([0,y,0]) intersection() {
        difference() {
            rotate([90,0,0]) cylinder(r=r+wall_mm,h=6.8,center=true);
            rotate([90,0,0]) cylinder(r=r,h=8.8,center=true);
        }
        translate([-r-wall_mm-1,-4.4,0]) cube([2*(r+wall_mm+1),8.8,r+wall_mm+1]);
    }
    // Flat dorsal bearing at each strap region closes the gap below the deck.
    // Contact with a real nail/dorsal surface and rotational retention are unverified.
    translate([-nail_seat_width/2,y-1.5,nail_seat_z])
        cube([nail_seat_width,3,deck_bottom-nail_seat_z+0.2]);
    for(sign=[-1,1]) translate([sign*(r+wall_mm+2.1),y,1.5]) difference() {
        cube([6,8.8,3],center=true);
        cube([2.6,6.4,5],center=true);
    }
}
module deck() {
    // Rounded corners retain a straight central gauge abutment at Y=-3.
    hull() for(x=[-deck_width/2+1,deck_width/2-1])
        for(y=[deck_back_y+1,deck_front_y-1])
            translate([x,y,deck_bottom]) cylinder(r=1,h=2);
}
module holder() {
    difference() {
        union() { for(y=support_y) support(y); deck(); }
        translate([-tile/2-0.1,marker_y-tile/2-0.1,deck_top-pocket_depth])
            cube([tile+0.2,tile+0.2,pocket_depth+1]);
    }
}
module gauge() {
    // Hand-held drop-on gauge, NOT a validated snap fit. Hold its proximal
    // abutment against the deck's front face at Y=-3 while gently seating the finger.
    // Feet sit on the bare side frame; the ArUco pocket remains clear.
    union() {
        translate([-deck_width/2-2.3,deck_front_y,deck_top])
            cube([deck_width+4.6,-deck_front_y+stop_wall_mm,1.2]);
        // Deck contact Y=-3; fingertip contact Y=0. Remove upwards after tightening.
        translate([-deck_width/2+1,deck_front_y,deck_bottom])
            cube([deck_width-2,-deck_front_y,deck_top-deck_bottom+0.5]);
        translate([-deck_width/2,0,-r/2])
            cube([deck_width,stop_wall_mm,deck_top+1.2+r/2]);
        for(sign=[-1,1]) {
            x=sign>0 ? deck_width/2+gauge_side_clearance_mm : -deck_width/2-gauge_side_clearance_mm-2;
            translate([x,-10,deck_bottom]) cube([2,10,deck_top-deck_bottom+1.2]);
            foot_x=sign>0 ? deck_width/2-0.8 : -deck_width/2-2.3;
            translate([foot_x,-10,deck_top]) cube([3.1,10,1.2]);
        }
    }
}
module strap() {
    // TPU-only ladder strip. Ends require a return loop/fastener or hook-and-loop.
    union() {
        translate([-strap_length_mm/2,-strap_width_mm/2,0]) cube([strap_length_mm,strap_width_mm,0.8]);
        for(x=[-strap_length_mm/2+3:4:strap_length_mm/2-3])
            translate([x-0.7,-strap_width_mm/2,0.8]) cube([1.4,strap_width_mm,0.5]);
    }
}
if(part=="strap") strap(); else if(part=="gauge") gauge(); else holder();
echo(reference_plane_y_mm=0,deck_front_y_mm=deck_front_y);
echo(marker_center_R_mm=[0,marker_y,deck_top-pocket_depth+0.15]);
echo(marker_center_to_reference_plane_mm=-marker_y);
