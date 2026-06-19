import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Stars, useTexture } from "@react-three/drei";
import * as THREE from "three";
import * as satellite from "satellite.js";
import { EARTH_RADIUS_3D } from "../services/orbital";

interface EarthSceneProps {
  currentTime: Date;
}

export function EarthScene({ currentTime }: EarthSceneProps) {
  const earthRef = useRef<THREE.Mesh>(null);

  // Load textures using Drei's useTexture hook (guarantees proper binding & color space)
  const [map, bumpMap] = useTexture([
    "/earth-blue-marble.jpg",
    "/earth-topology.png",
  ]);

  // Rotate Earth
  useFrame((state) => {
    if (earthRef.current) {
      const gmst = satellite.gstime(currentTime);
      earthRef.current.rotation.y = -gmst;
    }
  });

  return (
    <>
      {/* Background space elements */}
      <Stars radius={150} depth={50} count={3000} factor={4} saturation={0.5} fade speed={1} />
      
      {/* Lights */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 10]} intensity={1.2} color="#ffffff" />
      <pointLight position={[-15, -5, -10]} intensity={0.6} color="#4585ff" />

      {/* Atmospheric Glow */}
      <mesh>
        <sphereGeometry args={[EARTH_RADIUS_3D + 0.15, 32, 32]} />
        <meshBasicMaterial
          color="#0066ff"
          transparent
          opacity={0.12}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
        />
      </mesh>

      <group>
        {/* Core Earth Sphere */}
        <mesh ref={earthRef}>
          <sphereGeometry args={[EARTH_RADIUS_3D, 64, 64]} />
          <meshStandardMaterial
            map={map}
            color="#ffffff"
            bumpMap={bumpMap}
            bumpScale={0.02}
            roughness={0.45}
            metalness={0.1}
          />

          {/* Scientific Grid overlay */}
          <mesh>
            <sphereGeometry args={[EARTH_RADIUS_3D + 0.005, 32, 32]} />
            <meshBasicMaterial
              color="#00ffff"
              wireframe
              transparent
              opacity={0.04}
            />
          </mesh>
        </mesh>
      </group>
    </>
  );
}
