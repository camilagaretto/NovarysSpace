import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

interface SpaceCameraProps {
  targetPosition: [number, number, number] | null;
}

export function SpaceCamera({ targetPosition }: SpaceCameraProps) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  // Targets for animation
  const animTarget = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const animCamPos = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 15));

  useEffect(() => {
    if (targetPosition) {
      const [tx, ty, tz] = targetPosition;
      animTarget.current.set(tx, ty, tz);

      const satPos = new THREE.Vector3(tx, ty, tz);
      const dir = satPos.clone().normalize();
      if (dir.lengthSq() === 0) {
        dir.set(0, 0, 1);
      }

      // Position camera offset from the target satellite outward and skewed
      const offset = dir.clone().multiplyScalar(4.5).add(new THREE.Vector3(1.5, 2.0, 1.5));
      animCamPos.current.copy(satPos).add(offset);

      // Hard minimum distance from Earth's center (Earth radius is 4.0) to prevent clipping
      const MIN_EARTH_DIST = 7.8;
      if (animCamPos.current.length() < MIN_EARTH_DIST) {
        animCamPos.current.normalize().multiplyScalar(MIN_EARTH_DIST);
      }
    } else {
      animTarget.current.set(0, 0, 0);
      animCamPos.current.set(0, 6, 14);
    }
  }, [targetPosition]);

  useFrame(() => {
    if (controlsRef.current) {
      // Lerp controls target
      controlsRef.current.target.lerp(animTarget.current, 0.05);

      // Only lerp camera position if there is an active target (replay mode)
      if (targetPosition) {
        camera.position.lerp(animCamPos.current, 0.05);
      }
      
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={4.5}
      maxDistance={40}
    />
  );
}
