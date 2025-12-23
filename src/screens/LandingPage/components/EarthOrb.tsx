import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere } from '@react-three/drei';
import * as THREE from 'three';

const Globe = () => {
  const pointsRef = useRef<THREE.Points>(null);

  // Generate points on a sphere surface
  const particlesPosition = useMemo(() => {
    const count = 3000;
    const positions = new Float32Array(count * 3);
    const radius = 2;

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }
    return positions;
  }, []);

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += 0.001;
      pointsRef.current.rotation.x = Math.sin(state.clock.getElapsedTime() * 0.2) * 0.1;
    }
  });

  return (
    <group rotation={[0, 0, Math.PI / 6]}>
      {/* Main Points Sphere */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particlesPosition.length / 3}
            array={particlesPosition}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.015}
          color="#1dff00"
          transparent
          opacity={0.8}
          sizeAttenuation
        />
      </points>

      {/* Inner faint sphere for depth */}
      <Sphere args={[1.95, 32, 32]}>
        <meshBasicMaterial color="#000000" transparent opacity={0.9} />
      </Sphere>

      {/* Orbiting Rings */}
      <OrbitRing radius={2.5} speed={0.2} color="#1dff00" opacity={0.2} />
      <OrbitRing radius={3.2} speed={0.15} color="#1dff00" opacity={0.1} rotateX={Math.PI / 3} />
      <OrbitRing radius={2.8} speed={-0.1} color="#ffffff" opacity={0.1} rotateZ={Math.PI / 4} />
    </group>
  );
};

const OrbitRing = ({ radius, speed, color, opacity, rotateX = 0, rotateZ = 0 }: { radius: number, speed: number, color: string, opacity: number, rotateX?: number, rotateZ?: number }) => {
    const ringRef = useRef<THREE.Line>(null);
    const curve = useMemo(() => new THREE.EllipseCurve(0, 0, radius, radius, 0, 2 * Math.PI, false, 0), [radius]);
    const points = useMemo(() => curve.getPoints(100), [curve]);
    const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);

    useFrame(() => {
        if (ringRef.current) {
            ringRef.current.rotation.z += speed * 0.01;
        }
    });

    return (
        <group rotation={[rotateX, 0, rotateZ]}>
             <line ref={ringRef} geometry={geometry}>
                <lineBasicMaterial color={color} transparent opacity={opacity} />
            </line>
        </group>

    );
};

export const EarthOrb = () => {
  return (
    <div className="w-full h-[500px] md:h-[600px] lg:h-[700px] relative">
      {/* Gradient overlay for blending */}
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-black via-transparent to-transparent pointer-events-none" />

      <Canvas camera={{ position: [0, 0, 5.5], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} color="#1dff00" />
        <Globe />
        <OrbitControls
            enableZoom={false}
            enablePan={false}
            autoRotate
            autoRotateSpeed={0.5}
            minPolarAngle={Math.PI / 3}
            maxPolarAngle={2 * Math.PI / 3}
        />
      </Canvas>
    </div>
  );
};
