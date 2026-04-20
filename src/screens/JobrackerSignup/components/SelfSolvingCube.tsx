import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Edges, OrbitControls, RoundedBox, Environment, Float } from '@react-three/drei';
import * as THREE from 'three';

// --- Constants ---
const CUBE_SIZE = 0.95; // Slightly smaller to leave gaps
const SPACING = 1;      // Grid step
const TOTAL_SIZE = 1;   // For math consistency
const SCRAMBLE_SPEED = 6;
const SOLVE_SPEED = 3;
const WAIT_TIME = 60;   // Frames to wait between phases
const MAX_MOVES = 12;   // How many moves to scramble

// --- Types ---
type Vector3 = [number, number, number];
interface Move {
  axis: 'x' | 'y' | 'z';
  slice: -1 | 0 | 1;
  direction: 1 | -1;
}

// --- Helper: Round position to nearest grid point ---
const snapToGrid = (val: number) => {
  return Math.round(val);
};

// --- Components ---

const TechMaterial = () => (
  <>
    <meshPhysicalMaterial
      color="#050505"
      roughness={0.2}
      metalness={0.9}
      clearcoat={1}
      clearcoatRoughness={0.1}
      ior={1.5}
    />
  </>
);

const Cubie = React.forwardRef(({ position }: { position: Vector3 }, ref: any) => {
  return (
    <mesh position={position} ref={ref}>
      <RoundedBox args={[CUBE_SIZE, CUBE_SIZE, CUBE_SIZE]} radius={0.05} smoothness={4} receiveShadow castShadow>
        <TechMaterial />
      </RoundedBox>
      <group scale={[0.96, 0.96, 0.96]}>
        <RoundedBox args={[CUBE_SIZE, CUBE_SIZE, CUBE_SIZE]} radius={0.05} smoothness={4}>
          <meshBasicMaterial color="#000000" wireframe transparent opacity={0} />
          <Edges threshold={15} color="#1dff00" renderOrder={100} scale={1.0} linewidth={1} />
        </RoundedBox>
      </group>

      {/* Inner Glow Core */}
      <mesh scale={[0.4, 0.4, 0.4]}>
        <boxGeometry />
        <meshBasicMaterial color="#1dff00" transparent opacity={0.1} />
      </mesh>
    </mesh>
  );
});

const RubiksLogic = () => {
  const cubieRefs = useRef<(THREE.Mesh | null)[]>([]);
  const pivotRef = useRef<THREE.Group>(null);

  // Logic State
  const [phase, setPhase] = useState<'idle' | 'scrambling' | 'solving'>('scrambling');
  const moveStack = useRef<Move[]>([]);
  const moveCount = useRef(0);

  // Animation State
  const animationState = useRef({
    active: false,
    axis: 'x' as 'x' | 'y' | 'z',
    direction: 1, // 1 or -1
    targetRotation: 0,
    currentRotation: 0,
    cubieIndices: [] as number[],
  });

  const timer = useRef(0);

  // Initialize Cubies
  const cubies = useMemo(() => {
    const arr = [];
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          arr.push({ id: `${x}-${y}-${z}`, initialPos: [x, y, z] as Vector3 });
        }
      }
    }
    return arr;
  }, []);

  useFrame((state, delta) => {
    if (!pivotRef.current) return;

    if (animationState.current.active) {
      // --- ANIMATING ---
      const { axis, direction, targetRotation } = animationState.current;

      // Determine speed based on phase
      const speedParam = phase === 'solving' ? SOLVE_SPEED : SCRAMBLE_SPEED;
      const speed = speedParam * delta;

      let step = speed * direction;

      // Snap to finish if close
      const remaining = targetRotation - animationState.current.currentRotation;
      if (Math.abs(remaining) < Math.abs(step)) {
        step = remaining;
      }

      animationState.current.currentRotation += step;

      // Apply to pivot make sure we accumulate correctly
      // Actually simpler: just set the rotation absolute value
      // But we need to be careful about Euler order if we touched other axes.
      // Pivot is reset to 0,0,0 after every move, so we only rotate one axis at a time.
      pivotRef.current.rotation.set(0, 0, 0);
      pivotRef.current.rotation[axis] = animationState.current.currentRotation;

      // Check Check completion
      if (Math.abs(animationState.current.currentRotation - targetRotation) < 0.001) {
        // FINISH MOVE
        finishMove();
      }

    } else {
      // --- IDLE / DECISION ---
      timer.current++;

      // Wait a bit between full sequences
      if (phase === 'idle') {
        if (timer.current > WAIT_TIME * 2) {
          setPhase('scrambling');
          timer.current = 0;
          moveCount.current = 0;
        }
        return;
      }

      // Small pause between moves
      if (timer.current < (phase === 'solving' ? 10 : 5)) return;

      if (phase === 'scrambling') {
        if (moveCount.current >= MAX_MOVES) {
          setPhase('idle');
          // Actually, after scrambling, we should solve.
          // But let's verify visual: Scramble -> Wait -> Solve -> Wait -> Scramble
          setTimeout(() => setPhase('solving'), 1000);
          return;
        }

        // Pick Random Move
        const axes: ('x' | 'y' | 'z')[] = ['x', 'y', 'z'];
        const axis = axes[Math.floor(Math.random() * axes.length)];
        const slices = [-1, 0, 1];
        const slice = slices[Math.floor(Math.random() * slices.length)] as -1 | 0 | 1;
        const dir = Math.random() > 0.5 ? 1 : -1;

        startMove({ axis, slice, direction: dir as 1 | -1 });
        moveStack.current.push({ axis, slice, direction: dir as 1 | -1 });
        moveCount.current++;

      } else if (phase === 'solving') {
        if (moveStack.current.length === 0) {
          setPhase('idle');
          timer.current = 0;
          return;
        }

        // Pop move and inverse
        const move = moveStack.current.pop();
        if (move) {
          startMove({ ...move, direction: (move.direction * -1) as 1 | -1 });
        }
      }
    }
  });

  const startMove = (move: Move) => {
    const { axis, slice, direction } = move;

    // 1. Find Cubies
    const indices: number[] = [];
    const epsilon = 0.1;
    cubieRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      let pos = 0;
      if (axis === 'x') pos = mesh.position.x;
      if (axis === 'y') pos = mesh.position.y;
      if (axis === 'z') pos = mesh.position.z;

      if (Math.abs(pos - slice) < epsilon) {
        indices.push(i);
      }
    });

    if (indices.length === 0) return;

    // 2. Attach to Pivot
    indices.forEach(idx => {
      const mesh = cubieRefs.current[idx];
      if (mesh && pivotRef.current) pivotRef.current.attach(mesh);
    });

    // 3. Set State
    animationState.current = {
      active: true,
      axis,
      direction,
      targetRotation: (Math.PI / 2) * direction,
      currentRotation: 0,
      cubieIndices: indices
    };
    timer.current = 0;
  };

  const finishMove = () => {
    if (!pivotRef.current) return;

    // 1. Update Matrix World of pivot (it's rotated)
    pivotRef.current.updateMatrixWorld();

    const parent = pivotRef.current.parent;
    const ids = animationState.current.cubieIndices;

    // 2. Re-attach to parent
    ids.forEach(idx => {
      const mesh = cubieRefs.current[idx];
      if (mesh && parent) {
        parent.attach(mesh);

        // Snap positions to integer grid
        mesh.position.x = snapToGrid(mesh.position.x);
        mesh.position.y = snapToGrid(mesh.position.y);
        mesh.position.z = snapToGrid(mesh.position.z);

        // Snap rotation to nearest 90 deg
        const e = new THREE.Euler().setFromQuaternion(mesh.quaternion);
        mesh.rotation.x = Math.round(e.x / (Math.PI / 2)) * (Math.PI / 2);
        mesh.rotation.y = Math.round(e.y / (Math.PI / 2)) * (Math.PI / 2);
        mesh.rotation.z = Math.round(e.z / (Math.PI / 2)) * (Math.PI / 2);

        mesh.updateMatrix();
      }
    });

    // 3. Reset Pivot
    pivotRef.current.rotation.set(0, 0, 0);

    animationState.current.active = false;
  };

  return (
    <group>
      <group ref={pivotRef} />
      {cubies.map((c, i) => (
        <Cubie
          key={c.id}
          position={c.initialPos}
          ref={(el: any) => (cubieRefs.current[i] = el)}
        />
      ))}
    </group>
  );
};

export const SelfSolvingCube = () => {
  return (
    <div className="w-full h-full relative group">
      {/* Decorative gradient bloom */}
      <div className="absolute inset-0 bg-[#1dff00] blur-[150px] opacity-[0.03] animate-pulse pointer-events-none" />

      <Canvas
        camera={{ position: [5, 4, 5], fov: 35 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
      >
        <Environment preset="city" />
        <ambientLight intensity={0.2} />
        <pointLight position={[10, 10, 10]} intensity={2} color="#1dff00" distance={20} />
        <pointLight position={[-10, -5, -10]} intensity={1} color="#00ff88" distance={20} />

        <Float
          speed={2}
          rotationIntensity={0.5}
          floatIntensity={0.5}
          floatingRange={[-0.2, 0.2]}
        >
          <RubiksLogic />
        </Float>

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={2}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI * 0.75}
        />
      </Canvas>
    </div>
  );
};
