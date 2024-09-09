import {
  createCocurrentPerpendicularLine,
  createPlane,
  crossProduct,
  extractPlaneNormal,
extractLineVector,
} from "./util";
import * as THREE from "three";

export function generateAnteriorLine(
  distance,
  projectTEA,
  femur_center,
  mechanicalAxis,
  color
) {
  const d1 = extractLineVector(mechanicalAxis);
  const d2 = extractLineVector(projectTEA);

  return createCocurrentPerpendicularLine(
    d1,
    d2,
    femur_center.position,
    distance,
    color
  );
}

export function generateLateralLine(
  distance,
  anteriorLine,
  femur_center,
  mechanicalAxis,
  color
) {
  const d1 = extractLineVector(mechanicalAxis);
  const d2 = extractLineVector(anteriorLine);
  return createCocurrentPerpendicularLine(
    d1,
    d2,
    femur_center.position,
    distance,
    color
  );
}

export function generateFlexionPlane(varusPlane, color) {
  const flexPlane = createPlane(10, color);
  flexPlane.geometry.copy(varusPlane.geometry);
  flexPlane.position.copy(varusPlane.position);
  return flexPlane;
}
export function generateDistalPlane(flexionPlane, distal_medial, color) {
  const distalPlane = createPlane(10, color);
  distalPlane.geometry.copy(flexionPlane.geometry);
  distalPlane.position.copy(distal_medial.position);
  return distalPlane;
}
export function generateDistalResctionPlane(distalPlane, distance, color) {
  const distalResectionPlane = createPlane(10, color);
  distalResectionPlane.geometry.copy(distalPlane.geometry);
  distalResectionPlane.position
    .copy(distalPlane.position)
    .add(new THREE.Vector3(0, 0, distance));
  const plane = new THREE.Plane();
  plane.setFromNormalAndCoplanarPoint(
    extractPlaneNormal(distalResectionPlane),
    distalResectionPlane.position
  );
  let planeHelper = new THREE.PlaneHelper(plane, 100, "gray");
  return [plane, distalResectionPlane, planeHelper];
}
