import React, { useRef, useEffect, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Edges, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// --- Constants ---
const CUBE_SIZE = 1;
const SPACING = 0.05;
const TOTAL_SIZE = CUBE_SIZE + SPACING;
const ANIMATION_SPEED = 0.1; // Radians per frame approx
const WAIT_TIME = 20; // Frames to wait between moves

// --- Types ---
type Vector3 = [number, number, number];

// --- Helper: Round position to nearest grid point to avoid drift ---
const snapToGrid = (val: number) => {
  const S = TOTAL_SIZE;
  // We expect values like -S, 0, S.
  // Divide by S, round, multiply by S.
  return Math.round(val / S) * S;
};

const Cubie = ({ position, color = "#0a0a0a", edgeColor = "#1dff00" }: { position: Vector3; color?: string; edgeColor?: string }) => {
  return (
    <mesh position={position}>
      <boxGeometry args={[CUBE_SIZE, CUBE_SIZE, CUBE_SIZE]} />
      <meshStandardMaterial color={color} roughness={0.1} metalness={0.8} />
      <Edges color={edgeColor} threshold={15} lineWidth={2} />
    </mesh>
  );
};

const RubiksLogic = () => {
  // We need refs for all 27 cubies to manipulate them
  // We'll store them in a flat array, but we need to track their logical positions
  const cubieRefs = useRef<(THREE.Mesh | null)[]>([]);

  // The pivot group is used to rotate a slice
  const pivotRef = useRef<THREE.Group>(null);

  // State machine
  const [isAnimating, setIsAnimating] = useState(false);
  const animationState = useRef({
    axis: 'x' as 'x' | 'y' | 'z',
    slice: 0 as -1 | 0 | 1,
    targetRotation: 0,
    currentRotation: 0,
    cubieIndices: [] as number[], // Indices of cubies in the current slice
    direction: 1 // 1 or -1
  });

  // Timer for pauses
  const timer = useRef(0);

  // Initialize: We just need 27 items. Their initial positions are set in render.
  const cubies = useMemo(() => {
    const arr = [];
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          arr.push({ id: `${x}-${y}-${z}`, initialPos: [x * TOTAL_SIZE, y * TOTAL_SIZE, z * TOTAL_SIZE] as Vector3 });
        }
      }
    }
    return arr;
  }, []);

  useFrame((state, delta) => {
    if (!pivotRef.current) return;

    if (isAnimating) {
      // PERFROM ROTATION
      const { axis, direction, targetRotation } = animationState.current;
      const speed = 4 * delta; // Speed of rotation

      let step = speed * direction;
      animationState.current.currentRotation += step;

      // Check completion
      let finished = false;
      if ((direction > 0 && animationState.current.currentRotation >= targetRotation) ||
          (direction < 0 && animationState.current.currentRotation <= targetRotation)) {
        animationState.current.currentRotation = targetRotation;
        finished = true;
      }

      // Apply rotation to pivot
      pivotRef.current.rotation.set(0, 0, 0);
      pivotRef.current.rotation[axis] = animationState.current.currentRotation;

      if (finished) {
        // FINALIZE MOVE

        // 1. Detach cubies from pivot, reattach to world, keep transform
        // We have to be careful. The pivot is rotated.
        // The standard Three.js "attach" helps here but we are doing it manually to ensure grid alignment.

        // Actually, simpler way:
        // Update the matrices of the children, then move them back to root.
        pivotRef.current.updateMatrixWorld();

        const activeIndices = animationState.current.cubieIndices;

        activeIndices.forEach(idx => {
          const mesh = cubieRefs.current[idx];
          if (mesh) {
            // Apply pivot's transform to the mesh
            mesh.applyMatrix4(pivotRef.current!.matrixWorld);
            mesh.matrixWorldNeedsUpdate = true;

            // Snap position to grid to prevent drift errors accumulating
            mesh.position.x = snapToGrid(mesh.position.x);
            mesh.position.y = snapToGrid(mesh.position.y);
            mesh.position.z = snapToGrid(mesh.position.z);

            // Round rotation to nearest 90 degrees (PI/2)
            const euler = new THREE.Euler().setFromQuaternion(mesh.quaternion);
            mesh.rotation.x = Math.round(euler.x / (Math.PI/2)) * (Math.PI/2);
            mesh.rotation.y = Math.round(euler.y / (Math.PI/2)) * (Math.PI/2);
            mesh.rotation.z = Math.round(euler.z / (Math.PI/2)) * (Math.PI/2);
            mesh.updateMatrix();

            // Re-parent to scene (root) logic is implicitly handled because we used applyMatrix4
            // and we act as if they are in world space (visual root).
            // But wait, they are physically children of Pivot in the scene graph if we added them?
            // In R3F, if we didn't change the React tree, they are still children of the group below.
            // We just "simulated" parenting by attaching?

            // Correct approach for this React setup:
            // We don't actually reparent in React. We just changed the mesh transforms.
            // BUT, if we rotated the pivot, and the meshes are children of the pivot...
            // Wait, the meshes are siblings of the pivot in the JSX below.
            // So we need to:
            // 1. Parent to pivot.
            // 2. Rotate pivot.
            // 3. Unparent (applying transform).
            // 4. Reset pivot.
          }
        });

        // Reset Pivot
        pivotRef.current.rotation.set(0,0,0);

        // Unparenting logical step:
        // We need to attach them back to the 'Scene' or parent group.
        // Since we are using `applyMatrix4` on the meshes while the pivot was rotated,
        // IF they were children of the pivot, this would double apply.
        //
        // Strategy:
        // 1. Identify meshes.
        // 2. Add them to Pivot object (scene.attach(pivot) -> pivot.attach(mesh)).
        //    ThreeJS `object.attach(child)` keeps world transform.
        // 3. Animate Pivot.
        // 4. `scene.attach(mesh)` (or parent.attach(mesh)) to pull them out, keeping world transform.
        // 5. Reset Pivot.

        // Since we are in React, we need access to the parent group.
        const parent = pivotRef.current.parent;
        if (parent) {
             activeIndices.forEach(idx => {
                const mesh = cubieRefs.current[idx];
                if (mesh) parent.attach(mesh);
             });

             // Snap to grid now that they are back in world space
             activeIndices.forEach(idx => {
                 const mesh = cubieRefs.current[idx];
                 if(mesh) {
                     mesh.position.x = snapToGrid(mesh.position.x);
                     mesh.position.y = snapToGrid(mesh.position.y);
                     mesh.position.z = snapToGrid(mesh.position.z);
                     mesh.updateMatrixWorld();
                 }
             });
        }

        setIsAnimating(false);
        timer.current = 0;
      }

    } else {
      // IDLE - WAIT THEN PICK NEW MOVE
      timer.current++;
      if (timer.current > WAIT_TIME) {
        // Pick Move
        const axes: ('x'|'y'|'z')[] = ['x', 'y', 'z'];
        const axis = axes[Math.floor(Math.random() * axes.length)];
        const slices = [-1, 0, 1];
        const slice = slices[Math.floor(Math.random() * slices.length)] as -1|0|1;
        const dir = Math.random() > 0.5 ? 1 : -1;

        // Find cubies in this slice
        // We check current WORLD position
        const indices: number[] = [];
        const S = TOTAL_SIZE;
        const epsilon = 0.1;

        cubieRefs.current.forEach((mesh, i) => {
          if (!mesh) return;
          // Check position on axis
          let pos = 0;
          if (axis === 'x') pos = mesh.position.x;
          if (axis === 'y') pos = mesh.position.y;
          if (axis === 'z') pos = mesh.position.z;

          // Compare with slice * S
          if (Math.abs(pos - (slice * S)) < epsilon) {
            indices.push(i);
          }
        });

        if (indices.length > 0) {
           // Setup Animation
           animationState.current = {
               axis,
               slice,
               direction: dir,
               targetRotation: (Math.PI / 2) * dir,
               currentRotation: 0,
               cubieIndices: indices
           };

           // Attach to pivot
           // We use the ThreeJS attach method to preserve world transforms
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
                ref={(el) => (cubieRefs.current[i] = el)}
            />
        ))}
    </group>
  );
};

export const SelfSolvingCube = () => {
  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [5, 5, 5], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} color="#1dff00" />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="white" />

        <RubiksLogic />

        <OrbitControls
            enableZoom={false}
            enablePan={false}
            autoRotate
            autoRotateSpeed={1}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={Math.PI * 0.75}
        />
      </Canvas>
    </div>
  );
};
