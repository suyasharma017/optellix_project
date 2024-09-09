import * as THREE from "three";
import { Sidebar } from "./sidebar";
import Scene from "./scene";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import {
  generateAnteriorLine,
  generateDistalPlane,
  generateFlexionPlane,
  generateDistalResctionPlane,
  generateLateralLine,
} from "./helper";
import {
  generateLine,
  generatePependicularPlane,
  extractPlaneNormal,
  extractLineVector,
  mapLineOntoPlane,
} from "./util";
import Measure from "./measure";

class Viewer3D {
  constructor() {
    this.activeMarker = null;
    this.chosenLandmark = null;
    this.renderWindow = document.getElementById("canvas");
    this.renderer = new THREE.WebGLRenderer();
    this.scene = new Scene();
    this.sidebar = new Sidebar();

    this.initRenderer();
    this.initControls();
    this.initEventListeners();

    // Bind methods to preserve 'this' context
    this.onWindowClick = this.onWindowClick.bind(this);
    this.onWindowResize = this.onWindowResize.bind(this);
    this.animate = this.animate.bind(this);
  }

  initRenderer() {
    this.renderer.setSize(this.renderWindow.offsetWidth, this.renderWindow.offsetHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.localClippingEnabled = true;
    this.renderWindow.appendChild(this.renderer.domElement);
  }

  initControls() {
    this.initializeOrbitControls();
    this.initializeTransformControls();
  }

  initializeOrbitControls() {
    const orbitControl = new OrbitControls(this.scene.camera, this.renderer.domElement);
    orbitControl.enableDamping = true;
    orbitControl.target = new THREE.Vector3(5, 0, 750);
    this.scene.orbitControl = orbitControl;
  }

  initializeTransformControls() {
    const transformControl = new TransformControls(this.scene.camera, this.renderer.domElement);
    transformControl.addEventListener("change", () => this.render());
    transformControl.addEventListener("dragging-changed", (event) => {
      this.scene.orbitControl.enabled = !event.value;
    });
    this.scene.transformControl = transformControl;
    this.scene.scene.add(transformControl);
  }

  initEventListeners() {
    this.sidebar.init();
    this.sidebar.addEventListener("landmark_clicked", (event) => this.onLandMarkClicked(event));
    this.sidebar.addEventListener("submit", (event) => this.onSubmit(event));
    this.sidebar.addEventListener("rotate", (event) => this.onRotate(event));
    this.sidebar.addEventListener("distal", (event) => this.onDistalClicked(event));
    window.addEventListener("resize", this.onWindowResize);
  }

  onSubmit({ type, data }) {
    const markers = this.sidebar.markers;
    
    // Create axes and planes
    const mechanicalAxis = generateLine(markers["Femur_Center"].position, markers["Hip_Center"].position, "blue");
    const anatomicalAxis = generateLine(markers["Femur_Proximal_Canal"].position, markers["Femur_Distal_Canal"].position, "blue");
    const teaAxis = generateLine(markers["Medial_Epicondyle"].position, markers["Lateral_Epicondyle"].position, "blue");
    const pcaAxis = generateLine(markers["Posterior_Medial_Pt"].position, markers["Posterior_Lateral_Pt"].position, "blue");
    
    const perpendicularPlane = generatePependicularPlane(markers["Femur_Center"].position, markers["Hip_Center"].position, 0xff0000);
    const projectTEA = mapLineOntoPlane(teaAxis, perpendicularPlane, extractLineVector(mechanicalAxis));
    
    const anteriorLine = generateAnteriorLine(10, projectTEA, markers["Femur_Center"], mechanicalAxis, "yellow");
    const varusPlane = generatePependicularPlane(markers["Femur_Center"].position, markers["Hip_Center"].position, 0x00ff00);
    const lateralLine = generateLateralLine(100, anteriorLine, this.sidebar.markers["Femur_Center"], mechanicalAxis, "yellow");
    const flexionPlane = generateFlexionPlane(varusPlane, 0x0000ff);
    const distalMedialPlane = generateDistalPlane(flexionPlane, markers["Distal_Medial_Pt"], 0xff0000);
    
    const [distalResectionPlane, distalResectionPlaneMesh] = generateDistalResctionPlane(
      distalMedialPlane, this.sidebar.getDistalResectionValue(), 0x00ff00
    );

    const distalMedialMeasure = new Measure(this.scene.camera);
    distalMedialMeasure.setFromPointAndPlane(markers["Distal_Medial_Pt"].position, distalResectionPlane);
    
    const distalLateralMeasure = new Measure(this.scene.camera);
    distalLateralMeasure.setFromPointAndPlane(markers["Distal_Lateral_Pt"].position, distalResectionPlane);

    // Update scene
    this.updateScene(mechanicalAxis, anatomicalAxis, pcaAxis, teaAxis, projectTEA, anteriorLine, lateralLine, perpendicularPlane, varusPlane, flexionPlane, distalMedialPlane, distalResectionPlane, distalResectionPlaneMesh, distalMedialMeasure, distalLateralMeasure);
  }

  updateScene(...sceneElements) {
    const [mechanicalAxis, anatomicalAxis, pcaAxis, teaAxis, projectTEA, anteriorLine, lateralLine, perpendicularPlane, varusPlane, flexionPlane, distalMedialPlane, distalResectionPlane, distalResectionPlaneMesh, distalMedialMeasure, distalLateralMeasure] = sceneElements;

    this.scene.axises = [mechanicalAxis, anatomicalAxis, pcaAxis, teaAxis, projectTEA];
    this.scene.anteriorLine = anteriorLine;
    this.scene.lateralLine = lateralLine;
    this.scene.perpendicularPlane = perpendicularPlane;
    this.scene.varusPlane = varusPlane;
    this.scene.flexionPlane = flexionPlane;
    this.scene.distalMedialPlane = distalMedialPlane;
    this.scene.distalResectionPlane = distalResectionPlane;
    this.scene.distalResectionPlaneMesh = distalResectionPlaneMesh;

    this.scene.rotateVarusPlane(this.sidebar.getVarusRotationValue());
    this.scene.rotateFlexionPlane(this.sidebar.getFlexionRotationValue());

    this.scene.measurements.push(distalMedialMeasure, distalLateralMeasure);
    this.scene.scene.add(distalMedialMeasure.line, distalLateralMeasure.line, perpendicularPlane, varusPlane, flexionPlane, distalMedialPlane, distalResectionPlaneMesh, anteriorLine);

    this.scene.femurModel.material.clippingPlanes = this.sidebar.isResect() ? [distalResectionPlane] : null;
    this.scene.femurModel.material.clippingPlanesNeedUpdate = true;

    this.scene.showAxises();
    this.scene.initPlaneGui();
  }

  onLandMarkClicked({ type, data }) {
    if (this.chosenLandmark && this.activeMarker) {
      this.sidebar.addMarker(this.chosenLandmark, this.activeMarker);
      this.scene.transformControl.detach(this.activeMarker);
      this.activeMarker = null;
    }
    this.chosenLandmark = data.chosenLandmark;
    if (data.chosenLandmark) {
      if (this.sidebar.markers[data.chosenLandmark]) {
        this.scene.transformControl.attach(this.sidebar.markers[data.chosenLandmark]);
        this.activeMarker = this.sidebar.markers[data.chosenLandmark];
      }
      this.renderWindow.addEventListener("click", this.onWindowClick);
    } else {
      this.scene.transformControl.detach(this.activeMarker);
      this.renderWindow.removeEventListener("click", this.onWindowClick);
    }
  }

  onRotate({ type, data }) {
    if (data.plane === "varus") {
      this.scene.rotateVarusPlane(data.value === "minus" ? -1 : 1);
    } else if (data.plane === "flexion") {
      this.scene.rotateFlexionPlane(data.value === "minus" ? -1 : 1);
    }
  }

  onDistalClicked({ type, data }) {
    if (data.value === "plus") {
      this.scene.translateDistaResectionPlane(1);
    } else if (data.value === "minus") {
      this.scene.translateDistaResectionPlane(-1);
    } else if (data.value === "toggle") {
      this.scene.femurModel.material.clippingPlanes = this.sidebar.isResect() && this.scene.distalResectionPlane ? [this.scene.distalResectionPlane] : [];
    }
  }

  addMarkerToScene(e) {
    const rect = this.renderWindow.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();

    mouse.x = ((e.clientX - rect.left) / this.renderWindow.offsetWidth) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / this.renderWindow.offsetHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, this.scene.camera);

    const intersects = raycaster.intersectObjects(this.scene.group.children, true);

    if (intersects.length > 0) {
      const intersectionPoint = intersects[0].point;
      if (this.activeMarker) {
        this.scene.group.remove(this.activeMarker);
      }
      const markerGeometry = new THREE.SphereGeometry(2, 32, 32);
      const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      this.activeMarker = new THREE.Mesh(markerGeometry, markerMaterial);
      this.activeMarker.position.copy(intersectionPoint);
      this.scene.transformControl.attach(this.activeMarker);
      this.scene.group.add(this.activeMarker);
    }
  }

  onWindowClick(e) {
    this.addMarkerToScene(e);
    this.sidebar.addMarker(this.chosenLandmark, this.activeMarker);
  }

  onWindowResize() {
    this.scene.camera.aspect = this.renderWindow.offsetWidth / this.renderWindow.offsetHeight;
    this.scene.camera.updateProjectionMatrix();
    this.renderer.setSize(this.renderWindow.offsetWidth, this.renderWindow.offsetHeight);
  }

  animate() {
    requestAnimationFrame(this.animate);
    this.scene.measurements.forEach((m) => m.updatePosition());
    this.scene.orbitControl.update();
    this.render();
  }

  render() {
    this.renderer.render(this.scene.scene, this.scene.camera);
  }

  start() {
    this.animate();
  }
}

// Create and start the viewer
const viewer = new Viewer3D();
viewer.start();