import { FaceAnalysisData, Landmark } from "../types";

declare global {
  interface Window {
    FaceMesh: any;
  }
}

let faceMeshInstance: any = null;

const getFaceMesh = async () => {
  if (faceMeshInstance) return faceMeshInstance;

  return new Promise((resolve) => {
    // window.FaceMesh is loaded via the script tag in index.html
    const faceMesh = new window.FaceMesh({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
      },
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    faceMeshInstance = faceMesh;
    resolve(faceMesh);
  });
};

export const detectFaceLandmarks = async (imageSrc: string): Promise<FaceAnalysisData> => {
  const faceMesh = await getFaceMesh();

  return new Promise((resolve, reject) => {
    faceMesh.onResults((results: any) => {
      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks: Landmark[] = results.multiFaceLandmarks[0].map((l: any) => ({
          x: l.x,
          y: l.y,
          z: l.z 
        }));
        
        resolve({
          landmarks,
          description: `Detected ${landmarks.length} facial keypoints via Neural Mesh.`
        });
      } else {
        reject(new Error("No face detected in the image."));
      }
    });

    // Create an HTML image element to pass to MediaPipe
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      try {
        await faceMesh.send({ image: img });
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = (err) => reject(err);
    img.src = imageSrc;
  });
};