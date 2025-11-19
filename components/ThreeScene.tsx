
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { AppState, Landmark, FaceAnalysisData } from "../types";

interface ThreeSceneProps {
  analysisData: FaceAnalysisData | null;
  appState: AppState;
  onGenerationComplete: () => void;
}

// MediaPipe Face Mesh Indices for Feature Extraction
const FEATURES = {
    lipsOuter: [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185, 61],
    lipsInner: [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78],
    leftEye: [33, 160, 158, 133, 153, 144, 33],
    rightEye: [362, 385, 387, 263, 373, 380, 362],
    leftEyebrow: [70, 63, 105, 66, 107, 55, 65, 52, 53, 46],
    rightEyebrow: [336, 296, 334, 293, 300, 276, 283, 282, 295, 285],
    faceOval: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10]
};

const ThreeScene: React.FC<ThreeSceneProps> = ({ analysisData, appState, onGenerationComplete }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  
  const sceneRef = useRef<THREE.Scene | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const appStateRef = useRef(appState);

  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  // --- 1. HIGH-FIDELITY GEOMETRY ENGINE ---
  const generateHeadGroup = (landmarks: Landmark[]) => {
    const group = new THREE.Group();

    // A. Normalize Landmarks to Unit Space
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    landmarks.forEach(l => {
        minX = Math.min(minX, l.x); maxX = Math.max(maxX, l.x);
        minY = Math.min(minY, l.y); maxY = Math.max(maxY, l.y);
    });
    
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const faceWidth = maxX - minX;
    const faceHeight = maxY - minY;
    const scale = 1.6 / Math.max(faceWidth, faceHeight);

    const targetPoints = landmarks.map(l => new THREE.Vector3(
        (l.x - cx) * scale,
        -(l.y - cy) * scale, 
        -l.z * scale 
    ));

    // --- LAYER 1: THE SKULL MESH (Shrink-Wrapped Sphere) ---
    const sphereGeo = new THREE.SphereGeometry(1, 48, 36);
    const pos = sphereGeo.attributes.position;
    const vertex = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
        vertex.fromBufferAttribute(pos, i);
        vertex.y *= 1.3; // Elongate
        vertex.x *= 0.9; // Narrow width
        
        // FACE REGION (Front)
        if (vertex.z > 0.1) {
            vertex.z *= 0.6; // Flatten face plane initially

            let minDist = Infinity;
            let closestPt = null;
            
            for (const tp of targetPoints) {
                const dx = vertex.x - tp.x;
                const dy = vertex.y - tp.y;
                const distSq = dx*dx + dy*dy;
                if (distSq < minDist) {
                    minDist = distSq;
                    closestPt = tp;
                }
            }
            
            const dist = Math.sqrt(minDist);
            if (closestPt && dist < 0.35) {
                const influence = Math.max(0, 1 - (dist * 2.5));
                vertex.x = THREE.MathUtils.lerp(vertex.x, closestPt.x, influence * 0.6);
                vertex.y = THREE.MathUtils.lerp(vertex.y, closestPt.y, influence * 0.6);
                vertex.z = THREE.MathUtils.lerp(vertex.z, closestPt.z + 0.3, influence * 0.8); 
            }
        } 
        // SKULL REGION (Back)
        else {
            if (vertex.z < -0.5) vertex.z *= 0.9;
            if (vertex.y < -0.5) {
                const taper = 1 - (Math.abs(vertex.y + 0.5) * 0.5);
                vertex.x *= taper;
                vertex.z *= taper;
            }
        }
        pos.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    sphereGeo.computeVertexNormals();

    // 1.1 Wireframe Mesh
    const wireframeGeo = new THREE.WireframeGeometry(sphereGeo);
    const wireframeMaterial = new THREE.LineBasicMaterial({
        color: 0x334155, // Slate 700
        transparent: true,
        opacity: 0.35, 
        linewidth: 1
    });
    const skullMesh = new THREE.LineSegments(wireframeGeo, wireframeMaterial);
    group.add(skullMesh);

    // 1.2 Glowing Vertices (Enhanced)
    const pointsMaterial = new THREE.PointsMaterial({
        color: 0x0ea5e9, // Sky 500
        size: 0.025,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const pointsMesh = new THREE.Points(sphereGeo, pointsMaterial);
    group.add(pointsMesh);


    // --- LAYER 2: FEATURE GEOMETRY ---

    // 2.1 Eyes (Spheres)
    const createEye = (indices: number[]) => {
        const eyePoints = indices.map(i => targetPoints[i]).filter(p => p);
        if (eyePoints.length === 0) return null;

        // Calculate centroid
        const center = new THREE.Vector3();
        eyePoints.forEach(p => center.add(p));
        center.divideScalar(eyePoints.length);

        // Calculate approximate radius based on eye width
        let minX = Infinity, maxX = -Infinity;
        eyePoints.forEach(p => {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
        });
        const width = maxX - minX;
        const radius = width * 0.35;

        const eyeGeo = new THREE.SphereGeometry(radius, 16, 12);
        const eyeMat = new THREE.MeshBasicMaterial({
            color: 0x0ea5e9,
            wireframe: true,
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending
        });
        const eyeMesh = new THREE.Mesh(eyeGeo, eyeMat);
        
        // Position slightly ahead for prominence
        eyeMesh.position.copy(center);
        eyeMesh.position.z += 0.04; 
        
        return eyeMesh;
    };

    const leftEye = createEye(FEATURES.leftEye);
    const rightEye = createEye(FEATURES.rightEye);
    if (leftEye) group.add(leftEye);
    if (rightEye) group.add(rightEye);


    // 2.2 Mouth (Tube Topology)
    const lipPoints = FEATURES.lipsOuter.map(i => targetPoints[i]).filter(p => p);
    if (lipPoints.length > 0) {
        const curve = new THREE.CatmullRomCurve3(lipPoints, true);
        const tubeGeo = new THREE.TubeGeometry(curve, 64, 0.008, 6, true);
        const tubeMat = new THREE.MeshBasicMaterial({
            color: 0x0ea5e9,
            transparent: true,
            opacity: 0.9,
            wireframe: false
        });
        const mouthMesh = new THREE.Mesh(tubeGeo, tubeMat);
        
        mouthMesh.position.z += 0.02; 
        group.add(mouthMesh);
    }

    // 2.3 Contour Lines
    const featureMaterial = new THREE.LineBasicMaterial({
        color: 0x0ea5e9,
        linewidth: 2,
        transparent: true,
        opacity: 0.6
    });

    const createLineLoop = (indices: number[]) => {
        const points: THREE.Vector3[] = [];
        indices.forEach(idx => {
            if (targetPoints[idx]) {
                const p = targetPoints[idx].clone();
                p.z += 0.015; 
                points.push(p);
            }
        });
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        return new THREE.Line(geo, featureMaterial);
    };

    group.add(createLineLoop(FEATURES.leftEyebrow));
    group.add(createLineLoop(FEATURES.rightEyebrow));
    group.add(createLineLoop(FEATURES.faceOval));

    return { group }; 
  };

  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    const isMobile = width < 768;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0xffffff);

    // Standard Camera Setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    if (isMobile) {
        camera.position.set(0, -0.4, 5.5); 
        camera.lookAt(0, 0.3, 0);
    } else {
        camera.position.set(0, 0, 5.0);
        camera.lookAt(0, 0, 0);
    }
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    if (isMobile) {
        controls.target.set(0, 0.3, 0);
    }
    controlsRef.current = controls;

    // Initial Placeholder
    const initialGroup = new THREE.Group();
    const sphere = new THREE.SphereGeometry(0.8, 24, 24);
    const wireframe = new THREE.WireframeGeometry(sphere);
    const material = new THREE.LineBasicMaterial({ color: 0xcbd5e1, opacity: 0.3, transparent: true });
    const mesh = new THREE.LineSegments(wireframe, material);
    initialGroup.add(mesh);
    scene.add(initialGroup);
    groupRef.current = initialGroup;

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      
      if (groupRef.current) {
        if (appStateRef.current === AppState.COMPLETE) {
            groupRef.current.rotation.y += 0.002;
        } else if (appStateRef.current === AppState.IDLE) {
            groupRef.current.rotation.y += 0.001;
        }
      }
      
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
        if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;
        const w = mountRef.current.clientWidth;
        const h = mountRef.current.clientHeight;
        cameraRef.current.aspect = w / h;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (rendererRef.current && mountRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
    };
  }, []);

  // --- PROGRESSIVE CONSTRUCTION ANIMATION ---
  useEffect(() => {
    if (appState === AppState.GENERATING && analysisData && sceneRef.current) {
        if (groupRef.current) {
            sceneRef.current.remove(groupRef.current);
        }

        const { group } = generateHeadGroup(analysisData.landmarks);
        sceneRef.current.add(group);
        groupRef.current = group;

        // Prepare for Animation: Reset Draw Ranges
        group.traverse((child) => {
            if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments || child instanceof THREE.Points || child instanceof THREE.Line) {
                if (child.geometry) {
                    // Start invisible
                    child.geometry.setDrawRange(0, 0);
                    child.visible = true;
                }
            }
        });
        
        let start = performance.now();
        const duration = 2500; // 2.5s build time

        const loop = (now: number) => {
            const elapsed = now - start;
            const p = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3); // Cubic ease out
            
            setProgress(Math.floor(eased * 100));

            // Animate Geometry Construction (Dot by Dot)
            group.traverse((child) => {
                if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments || child instanceof THREE.Points || child instanceof THREE.Line) {
                    if (child.geometry) {
                        const count = child.geometry.index ? child.geometry.index.count : child.geometry.attributes.position.count;
                        const currentDraw = Math.floor(count * eased);
                        child.geometry.setDrawRange(0, currentDraw);
                    }
                }
            });

            if (p < 1) requestAnimationFrame(loop);
            else onGenerationComplete();
        };
        requestAnimationFrame(loop);
    } 
  }, [appState, analysisData]);

  return (
    <div className="absolute inset-0 z-0 bg-white">
        <div ref={mountRef} className="w-full h-full touch-none outline-none" />
        
        {appState === AppState.GENERATING && (
             <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                 <div className="text-4xl font-mono font-bold text-slate-900">{progress}%</div>
                 <div className="text-xs font-bold tracking-widest text-slate-500 mt-1">CONSTRUCTING TOPOLOGY</div>
             </div>
        )}
    </div>
  );
};

export default ThreeScene;
