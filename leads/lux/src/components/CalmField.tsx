import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Group, Points } from 'three'

const POINTER = { x: 0, y: 0 }

function Dust() {
  const points = useRef<Points>(null)
  const group = useRef<Group>(null)
  const positions = useMemo(() => {
    const count = 180
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) {
      arr[i * 3] = (Math.random() - 0.5) * 10
      arr[i * 3 + 1] = (Math.random() - 0.5) * 6.2
      arr[i * 3 + 2] = (Math.random() - 0.5) * 3.6
    }
    return arr
  }, [])

  useFrame((_, delta) => {
    if (points.current) {
      points.current.rotation.y += delta * 0.028
      points.current.rotation.x += delta * 0.008
    }
    if (group.current) {
      group.current.position.x += (POINTER.x * 0.4 - group.current.position.x) * 0.045
      group.current.position.y += (POINTER.y * 0.22 - group.current.position.y) * 0.045
    }
  })

  return (
    <group ref={group}>
      <points ref={points}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.038}
          color="#e8c4b8"
          transparent
          opacity={0.42}
          sizeAttenuation
          depthWrite={false}
        />
      </points>
    </group>
  )
}

export function CalmField() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 900px)')
    const motionOk = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setEnabled(desktop.matches && !motionOk.matches)
    update()
    desktop.addEventListener('change', update)
    motionOk.addEventListener('change', update)
    return () => {
      desktop.removeEventListener('change', update)
      motionOk.removeEventListener('change', update)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    const onMove = (event: PointerEvent) => {
      POINTER.x = event.clientX / window.innerWidth - 0.5
      POINTER.y = -(event.clientY / window.innerHeight - 0.5)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [enabled])

  if (!enabled) return null

  return (
    <div className="hero__canvas" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 48 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <Dust />
      </Canvas>
    </div>
  )
}
