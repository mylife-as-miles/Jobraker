import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { Edges, OrbitControls, Sparkles, useTexture, Float } from '@react-three/drei';
import * as THREE from 'three';

// --- Constants ---
const CUBE_SIZE = 1;
const SPACING = 0.08; // Slightly larger spacing for "floating" tech look
const TOTAL_SIZE = CUBE_SIZE + SPACING;
const WAIT_TIME = 60; // Slower, more deliberate moves

// --- Types ---
type Vector3 = [number, number, number];

// --- Helper: Round position to nearest grid point ---
const snapToGrid = (val: number) => {
  const S = TOTAL_SIZE;
  return Math.round(val / S) * S;
};

const InnerCore = () => {
    return (
        <mesh>
            <sphereGeometry args={[0.8, 32, 32]} />
            <meshBasicMaterial color="#1dff00" toneMapped={false} />
            <pointLight distance={5} intensity={5} color="#1dff00" decay={2} />
        </mesh>
    )
}

const Cubie = React.forwardRef(({ position, isCenter, logoMap }: { position: Vector3; isCenter: boolean; logoMap?: THREE.Texture }, ref: React.ForwardedRef<THREE.Mesh>) => {
  // Random "tech" detailing for non-center cubes
  const detail = useMemo(() => Math.random(), []);

  return (
    <mesh position={position} ref={ref}>
      <boxGeometry args={[CUBE_SIZE, CUBE_SIZE, CUBE_SIZE]} />
      {/* Glassy Cyber Material */}
      <meshPhysicalMaterial
        color={isCenter ? "#000000" : "#050505"}
        roughness={0.1}
        metalness={0.9}
        transmission={0.2} // Slight transparency
        clearcoat={1}
        clearcoatRoughness={0.1}
      />

      {/* Neon Edges - pulsating logic could go here, but static is cleaner for performance */}
      <Edges
        color="#1dff00"
        threshold={15}
        scale={0.98} // Slightly inside
        linewidth={2}
      />

      {/* Internal "Circuitry" Glow for Center Cubies */}
      {isCenter && (
          <mesh scale={[0.85, 0.85, 0.85]}>
              <boxGeometry />
              <meshBasicMaterial color="#1dff00" wireframe opacity={0.3} transparent />
          </mesh>
      )}

      {/* Logo Texture on center face if provided */}
      {isCenter && logoMap && (
          <>
             {/* We place planes on the 6 faces for the logo */}
             {[
                 [0, 0, 0.51, 0, 0, 0], // Front
                 [0, 0, -0.51, 0, Math.PI, 0], // Back
                 [0.51, 0, 0, 0, Math.PI/2, 0], // Right
                 [-0.51, 0, 0, 0, -Math.PI/2, 0], // Left
                 [0, 0.51, 0, -Math.PI/2, 0, 0], // Top
                 [0, -0.51, 0, Math.PI/2, 0, 0], // Bottom
             ].map((transforms, i) => (
                 <mesh key={i} position={[transforms[0], transforms[1], transforms[2]] as Vector3} rotation={[transforms[3], transforms[4], transforms[5]] as Vector3}>
                     <planeGeometry args={[0.6, 0.6]} />
                     <meshBasicMaterial map={logoMap} transparent opacity={0.9} toneMapped={false} />
                 </mesh>
             ))}
          </>
      )}
    </mesh>
  );
});

const RubiksLogic = () => {
  const cubieRefs = useRef<(THREE.Mesh | null)[]>([]);
  const pivotRef = useRef<THREE.Group>(null);

  // Load Logo
  const logoTexture = useLoader(THREE.TextureLoader, '/favicon.png'); // Using favicon as it's usually square and clean

  // State
  const [isAnimating, setIsAnimating] = useState(false);
  const animationState = useRef({
    axis: 'x' as 'x' | 'y' | 'z',
    targetRotation: 0,
    currentRotation: 0,
    cubieIndices: [] as number[],
    direction: 1
  });
  const timer = useRef(0);

  // Initialize Cubies
  const cubies = useMemo(() => {
    const arr = [];
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          // Identify if this is a "center" piece of a face or the core
          // Actually, we want the logo on the "Face Centers" (e.g. 0,0,1)
          // The absolute core (0,0,0) is hidden inside.
          // Let's mark the Core (0,0,0) specifically.
          const isCore = x===0 && y===0 && z===0;
          const isFaceCenter = (Math.abs(x) + Math.abs(y) + Math.abs(z)) === 1; // Only one coord is non-zero

          arr.push({
              id: `${x}-${y}-${z}`,
              initialPos: [x * TOTAL_SIZE, y * TOTAL_SIZE, z * TOTAL_SIZE] as Vector3,
              isCore,
              isFaceCenter
          });
        }
      }
    }
    return arr;
  }, []);

  useFrame((state, delta) => {
    if (!pivotRef.current) return;

    if (isAnimating) {
      const { axis, direction, targetRotation } = animationState.current;
      // Ease in-out speed? constant for now
      const speed = 2.5 * delta; // Slower, heavier movement

      let step = speed * direction;
      animationState.current.currentRotation += step;

      let finished = false;
      if ((direction > 0 && animationState.current.currentRotation >= targetRotation) ||
          (direction < 0 && animationState.current.currentRotation <= targetRotation)) {
        animationState.current.currentRotation = targetRotation;
        finished = true;
      }

      pivotRef.current.rotation.set(0, 0, 0);
      pivotRef.current.rotation[axis] = animationState.current.currentRotation;

      if (finished) {
        pivotRef.current.updateMatrixWorld();
        const activeIndices = animationState.current.cubieIndices;

        activeIndices.forEach(idx => {
          const mesh = cubieRefs.current[idx];
          if (mesh) {
            mesh.applyMatrix4(pivotRef.current!.matrixWorld);
            mesh.position.x = snapToGrid(mesh.position.x);
            mesh.position.y = snapToGrid(mesh.position.y);
            mesh.position.z = snapToGrid(mesh.position.z);

            const euler = new THREE.Euler().setFromQuaternion(mesh.quaternion);
            mesh.rotation.x = Math.round(euler.x / (Math.PI/2)) * (Math.PI/2);
            mesh.rotation.y = Math.round(euler.y / (Math.PI/2)) * (Math.PI/2);
            mesh.rotation.z = Math.round(euler.z / (Math.PI/2)) * (Math.PI/2);
            mesh.updateMatrix();
          }
        });

        pivotRef.current.rotation.set(0,0,0);

        const parent = pivotRef.current.parent;
        if (parent) {
             activeIndices.forEach(idx => {
                const mesh = cubieRefs.current[idx];
                if (mesh) {
                    parent.attach(mesh);
                    mesh.updateMatrixWorld();
                }
             });
        }

        setIsAnimating(false);
        timer.current = 0;
      }
    } else {
      timer.current++;
      if (timer.current > WAIT_TIME) {
        const axes: ('x'|'y'|'z')[] = ['x', 'y', 'z'];
        const axis = axes[Math.floor(Math.random() * axes.length)];
        const slices = [-1, 0, 1];
        const slice = slices[Math.floor(Math.random() * slices.length)] as -1|0|1;
        const dir = Math.random() > 0.5 ? 1 : -1;

        const indices: number[] = [];
        const S = TOTAL_SIZE;
        const epsilon = 0.1;

        cubieRefs.current.forEach((mesh, i) => {
          if (!mesh) return;
          let pos = 0;
          if (axis === 'x') pos = mesh.position.x;
          if (axis === 'y') pos = mesh.position.y;
          if (axis === 'z') pos = mesh.position.z;

          if (Math.abs(pos - (slice * S)) < epsilon) {
            indices.push(i);
          }
        });

        if (indices.length > 0) {
           animationState.current = {
               axis,
               slice, // not really used in animation loop but good for debug
               direction: dir,
               targetRotation: (Math.PI / 2) * dir,
               currentRotation: 0,
               cubieIndices: indices
           };

           indices.forEach(idx => {
               const mesh = cubieRefs.current[idx];
               if (mesh && pivotRef.current) {
                   pivotRef.current.attach(mesh);
               }
           });

           setIsAnimating(true);
        }
      }
    }
  });

  return (
    <group>
        <group ref={pivotRef} />
        {cubies.map((c, i) => (
            <Cubie
                key={c.id}
                position={c.initialPos}
                isCenter={c.isFaceCenter || c.isCore} // We apply special look to centers
                logoMap={c.isFaceCenter ? logoTexture : undefined}
                ref={(el) => (cubieRefs.current[i] = el)}
            />
        ))}
        {/* The Core is separate, stays at 0,0,0 world? No, the core cubie moves too.
            But we want a stationary 'energy' source perhaps?
            Or does the energy source move with the center cubie?
            Let's put a glowing light in the absolute center of the group,
            which might clip if the center cubie moves away (impossible in Rubiks logic, center is always center).
        */}
        <pointLight position={[0,0,0]} intensity={2} color="#1dff00" distance={3} />
    </group>
  );
};

export const SelfSolvingCube = () => {
  return (
    <div className="w-full h-full relative">
      <Canvas camera={{ position: [6, 4, 6], fov: 35 }} dpr={[1, 2]}>
        <color attach="background" args={['#000000']} />

        {/* Cinematic Lighting */}
        <ambientLight intensity={0.2} />
        <spotLight position={[10, 10, 10]} angle={0.5} penumbra={1} intensity={1} color="#1dff00" />
        <spotLight position={[-10, -5, -10]} angle={0.5} penumbra={1} intensity={1} color="#0040ff" /> {/* Cyber blue fill */}

        <Float speed={2} rotationIntensity={0.2} floatIntensity={0.2}>
             <RubiksLogic />
        </Float>

        {/* Data Particles */}
        <Sparkles
            count={100}
            scale={12}
            size={2}
            speed={0.4}
            opacity={0.5}
            color="#1dff00"
        />

        <OrbitControls
            enableZoom={false}
            enablePan={false}
            autoRotate
            autoRotateSpeed={0.5}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={Math.PI * 0.75}
        />
      </Canvas>

      {/* Vignette Overlay for depth */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_20%,black_100%)]" />
    </div>
  );
};
