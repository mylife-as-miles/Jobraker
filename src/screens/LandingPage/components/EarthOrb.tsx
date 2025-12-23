import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, Stars } from '@react-three/drei';
import * as THREE from 'three';

const Globe = () => {
  const pointsRef = useRef<THREE.Points>(null);
  const wireframeRef = useRef<THREE.Mesh>(null);

  // Generate points on a sphere surface - Increased density
  const particlesPosition = useMemo(() => {
    const count = 6000; // Increased count
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
    const time = state.clock.getElapsedTime();
    if (pointsRef.current) {
      pointsRef.current.rotation.y += 0.002; // Faster rotation
      pointsRef.current.rotation.x = Math.sin(time * 0.1) * 0.05;
    }
    if (wireframeRef.current) {
      wireframeRef.current.rotation.y += 0.002;
      wireframeRef.current.rotation.x = Math.sin(time * 0.1) * 0.05;
    }
  });

  return (
    <group rotation={[0, 0, Math.PI / 6]}>
      {/* 1. High Density Points */}
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
          size={0.02} // Slightly larger
          color="#1dff00"
          transparent
          opacity={0.8}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* 2. Wireframe Sphere for structure */}
      <mesh ref={wireframeRef}>
        <sphereGeometry args={[1.98, 48, 48]} />
        <meshBasicMaterial
          color="#1dff00"
          wireframe
          transparent
          opacity={0.05}
        />
      </mesh>

      {/* 3. Inner Dark Core to block background stars */}
      <Sphere args={[1.95, 32, 32]}>
        <meshBasicMaterial color="#000000" />
      </Sphere>

      {/* 4. Glowing Atmosphere */}
      <mesh>
        <sphereGeometry args={[2.2, 32, 32]} />
        <meshBasicMaterial
            color="#1dff00"
            transparent
            opacity={0.03}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* 5. Multiple Orbit Rings */}
      <OrbitRing radius={2.5} speed={0.3} color="#1dff00" opacity={0.4} />
      <OrbitRing radius={3.0} speed={0.2} color="#1dff00" opacity={0.2} rotateX={Math.PI / 2.5} />
      <OrbitRing radius={2.8} speed={-0.2} color="#ffffff" opacity={0.15} rotateZ={Math.PI / 4} />
      <OrbitRing radius={3.5} speed={0.1} color="#1dff00" opacity={0.1} rotateY={Math.PI / 3} />
    </group>
  );
};

const OrbitRing = ({ radius, speed, color, opacity, rotateX = 0, rotateY = 0, rotateZ = 0 }: any) => {
    const ringRef = useRef<THREE.Line>(null);
    const curve = useMemo(() => new THREE.EllipseCurve(0, 0, radius, radius, 0, 2 * Math.PI, false, 0), [radius]);
    const points = useMemo(() => curve.getPoints(120), [curve]);
    const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);

    useFrame(() => {
        if (ringRef.current) {
            ringRef.current.rotation.z += speed * 0.01;
        }
    });

    return (
        <group rotation={[rotateX, rotateY, rotateZ]}>
             <line ref={ringRef} geometry={geometry}>
                <lineBasicMaterial color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} />
            </line>
        </group>
    );
};

export const EarthOrb = () => {
  return (
    <div className="w-full h-[500px] md:h-[600px] lg:h-[700px] relative">
      {/* Enhanced Gradient Overlay */}
      <div className="absolute inset-0 z-10 bg-radial-gradient from-transparent via-transparent to-black pointer-events-none" />

      <Canvas camera={{ position: [0, 0, 8.5], fov: 40 }} dpr={[1, 2]}>
        <ambientLight intensity={0.2} />
        <pointLight position={[10, 10, 10]} intensity={1.5} color="#1dff00" />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#004000" />

        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

        <Globe />

        <OrbitControls
            enableZoom={false}
            enablePan={false}
            autoRotate
            autoRotateSpeed={0.5}
            minPolarAngle={Math.PI / 2.5}
            maxPolarAngle={Math.PI / 1.5}
        />
      </Canvas>
    </div>
  );
};
