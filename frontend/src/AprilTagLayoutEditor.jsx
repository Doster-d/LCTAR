import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html, Line, Grid, Environment, useTexture } from '@react-three/drei';
import * as THREE from 'three';

const toVector = (value, length = 3) => {
  if (!Array.isArray(value)) return Array.from({ length }, () => 0);
  return value.slice(0, length).map((n) => Number(n) || 0);
};

const clampDecimals = (value, precision = 4) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const createEmptyScene = (name, fallbackOffset = null) => ({
  name,
  diameter: 1,
  fallbackOffsetDefault: fallbackOffset ? [...fallbackOffset] : null
});

const createEmptyTag = (sceneId, id, fallbackOffset = [0, 0, 0]) => ({
  id,
  sceneId,
  size: 0.15,
  normalOffsetMm: 1000,
  position: [0, 0.02, 0],
  rotation: [0, 0, 0],
  sphereOffset: [0, 0, 0.1],
  fallbackOffset: [...fallbackOffset],
  order: Date.now()
});

const TagCube = ({ tag, isSelected }) => {
  const tagTexture = useTexture('/tag36h11-0.svg');

  const edgeGeometry = useMemo(() => {
    const box = new THREE.BoxGeometry(tag.size, tag.size, tag.size);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    return edges;
  }, [tag.size]);

  useEffect(() => () => edgeGeometry.dispose(), [edgeGeometry]);

  const fallbackOffset = tag.fallbackOffset ?? [0, 0, 0];
  const fallbackLength = Math.hypot(...fallbackOffset);
  const hasFallbackOffset = fallbackLength > 1e-4;

  const normalOffsetMeters = -(tag.normalOffsetMm ?? 0) / 1000;
  const hasNormalOffset = Math.abs(normalOffsetMeters) > 1e-4;

  const baseSphereRadius = tag.sphereOffset ? Math.max(0.01, Math.hypot(...tag.sphereOffset)) : tag.size * 0.12;
  const spherePosition = hasNormalOffset ? [0, 0, normalOffsetMeters] : fallbackOffset;
  const sphereColor = hasNormalOffset ? '#f97316' : '#38bdf8';
  const sphereEmissive = hasNormalOffset ? '#ea580c' : '#0ea5e9';

  const cubeColor = isSelected ? '#f59e0b' : '#334155';
  const edgeColor = isSelected ? '#fbbf24' : '#1e293b';

  return (
    <group position={tag.position} rotation={tag.rotation}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[tag.size, tag.size, tag.size]} />
        <meshStandardMaterial color={cubeColor} roughness={0.45} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0, tag.size / 2 + 0.0006]}>
        <planeGeometry args={[tag.size * 0.96, tag.size * 0.96]} />
        <meshStandardMaterial map={tagTexture} toneMapped={false} />
      </mesh>
      <lineSegments>
        <primitive object={edgeGeometry} attach="geometry" />
        <lineBasicMaterial color={edgeColor} />
      </lineSegments>
      <Html position={[0, tag.size / 2 + 0.06, 0]} center>
        <div
          style={{
            padding: '2px 6px',
            borderRadius: '6px',
            background: 'rgba(0,0,0,0.65)',
            color: '#fff',
            fontSize: '11px',
            fontFamily: 'monospace'
          }}
        >
          #{tag.id}
        </div>
      </Html>
      {hasFallbackOffset && (
        <Line points={[[0, 0, 0], fallbackOffset]} color="#38bdf8" lineWidth={2} dashed={false} />
      )}
      {hasNormalOffset && (
        <Line points={[[0, 0, 0], [0, 0, normalOffsetMeters]]} color="#f97316" lineWidth={2} dashed={false} />
      )}
      {(hasNormalOffset || hasFallbackOffset) && (
        <mesh position={spherePosition}>
          <sphereGeometry args={[baseSphereRadius, 24, 24]} />
          <meshStandardMaterial
            color={sphereColor}
            emissive={sphereEmissive}
            emissiveIntensity={0.35}
            opacity={0.8}
            transparent
          />
        </mesh>
      )}
    </group>
  );
};

const SceneCanvas = ({ tags, selectedSceneId, selectedTagId }) => {
  const sceneTags = useMemo(
    () => tags.filter((tag) => tag.sceneId === selectedSceneId),
    [selectedSceneId, tags]
  );

  const linePoints = useMemo(() => {
    if (sceneTags.length < 2) return null;
    const sorted = [...sceneTags].sort((a, b) => a.order - b.order);
    return sorted.map((tag) => tag.position);
  }, [sceneTags]);

  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [3.6, 2.4, 4.2], fov: 55 }}
      style={{ width: '100%', height: '100%' }}
      onCreated={({ camera }) => {
        camera.lookAt(0, 0.2, 0);
      }}
    >
      <color attach="background" args={[0.12, 0.12, 0.16]} />
      <ambientLight intensity={0.4} />
      <hemisphereLight args={[0xe0f7ff, 0x1b1e28, 0.55]} />
      <directionalLight
        position={[6, 7, 3]}
        castShadow
        intensity={0.85}
        shadow-mapSize={[2048, 2048]}
      />
      <spotLight
        position={[-4, 6, -2]}
        angle={0.6}
        penumbra={0.35}
        intensity={0.6}
        castShadow
      />
      <Environment preset="warehouse" />

      <Grid
        args={[20, 20]}
        sectionSize={0.5}
        sectionThickness={0.6}
        cellSize={0.1}
        cellThickness={0.35}
        fadeStrength={0.3}
        fadeDistance={18}
        position={[0, 0.001, 0]}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#1f2430" roughness={0.85} metalness={0.1} />
      </mesh>

      {linePoints && (
        <Line points={linePoints} color="#ffd166" lineWidth={2} dashed={false} />
      )}

      {sceneTags.map((tag) => (
        <TagCube key={tag.order} tag={tag} isSelected={tag.id === selectedTagId} />
      ))}

      <axesHelper args={[0.5]} />
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI * 0.5}
        minPolarAngle={Math.PI * 0.05}
        target={[0, 0.2, 0]}
      />
    </Canvas>
  );
};

const AprilTagLayoutEditor = ({ onExit }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scenes, setScenes] = useState({});
  const [tags, setTags] = useState([]);
  const [selectedSceneId, setSelectedSceneId] = useState('');
  const [selectedTagId, setSelectedTagId] = useState(null);

  useEffect(() => {
    let mounted = true;
    const loadConfig = async () => {
      try {
        const response = await fetch('./apriltag-config.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!mounted) return;

        const parsedScenes = Object.entries(data.scenes || {}).reduce(
          (acc, [name, desc]) => {
            acc[name] = createEmptyScene(name);
            acc[name].diameter = Number(desc.diameter) || 1;
            return acc;
          },
          {}
        );

        const ensureScene = (sceneId) => {
          if (!parsedScenes[sceneId]) {
            parsedScenes[sceneId] = createEmptyScene(sceneId);
          }
          return parsedScenes[sceneId];
        };

        const parsedTags = (data.tags || []).map((tag, index) => {
          const sceneId = tag.sceneId || Object.keys(parsedScenes)[0] || 'default';
          const sceneEntry = ensureScene(sceneId);

          const position = toVector(tag.position);
          const rotation = toVector(tag.rotation);
          const rotationQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
          const positionVec = new THREE.Vector3(...position);

          let fallbackOffset = sceneEntry.fallbackOffsetDefault ? [...sceneEntry.fallbackOffsetDefault] : [0, 0, 0];

          if (Array.isArray(tag.fallbackCenter)) {
            const fallbackWorld = new THREE.Vector3(...toVector(tag.fallbackCenter));
            const offset = fallbackWorld.clone().sub(positionVec);
            const localOffset = offset.applyQuaternion(rotationQuat.clone().invert());
            fallbackOffset = [localOffset.x, localOffset.y, localOffset.z];
          }

          if (!sceneEntry.fallbackOffsetDefault) {
            sceneEntry.fallbackOffsetDefault = [...fallbackOffset];
          }

          return {
            id: typeof tag.id === 'number' ? tag.id : index,
            sceneId,
            size: Number(tag.size) || 0.15,
            normalOffsetMm: Number(tag.normalOffsetMm) || 0,
            position,
            rotation,
            sphereOffset: toVector(tag.sphereOffset),
            fallbackOffset,
            order: Date.now() + index
          };
        });

        Object.values(parsedScenes).forEach((scene) => {
          if (!scene.fallbackOffsetDefault) {
            scene.fallbackOffsetDefault = [0, 0, 0];
          }
        });

        if (Object.keys(parsedScenes).length === 0) {
          const fallback = createEmptyScene('default');
          parsedScenes[fallback.name] = fallback;
        }

        setScenes(parsedScenes);
        setTags(parsedTags);
        setSelectedSceneId(
          parsedTags[0]?.sceneId || Object.keys(parsedScenes)[0]
        );
      } catch (err) {
        setError(err.message || 'Failed to load configuration');
        const fallback = createEmptyScene('default');
        setScenes({ [fallback.name]: fallback });
        setSelectedSceneId(fallback.name);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadConfig();
    return () => {
      mounted = false;
    };
  }, [setScenes]);

  const selectedScene = selectedSceneId ? scenes[selectedSceneId] : null;
  const selectedTag = useMemo(
    () => tags.find((tag) => tag.id === selectedTagId) || null,
    [selectedTagId, tags]
  );

  const sortedTags = useMemo(() => {
    return [...tags].sort((a, b) => a.order - b.order);
  }, [tags]);

  const handleSceneChange = useCallback((sceneId) => {
    setSelectedSceneId(sceneId);
    const next = tags.find((tag) => tag.sceneId === sceneId);
    setSelectedTagId(next?.id ?? null);
  }, [tags]);

  const handleTagUpdate = useCallback((tagId, updates) => {
    setTags((prev) => {
      const next = prev.map((tag) =>
        tag.id === tagId
          ? { ...tag, ...updates }
          : tag
      );

      if (updates.fallbackOffset) {
        const target = prev.find((tag) => tag.id === tagId);
        const sceneId = target?.sceneId;
        if (sceneId) {
          setScenes((prevScenes) => {
            const sceneEntry = prevScenes[sceneId];
            if (!sceneEntry) return prevScenes;
            return {
              ...prevScenes,
              [sceneId]: {
                ...sceneEntry,
                fallbackOffsetDefault: [...updates.fallbackOffset]
              }
            };
          });
        }
      }

      return next;
    });
  }, [setScenes]);

  const handleSceneField = useCallback((field, value) => {
    if (!selectedSceneId) return;
    setScenes((prev) => ({
      ...prev,
      [selectedSceneId]: {
        ...prev[selectedSceneId],
        [field]: value
      }
    }));
  }, [selectedSceneId]);

  const handleAddScene = () => {
    let suffix = 1;
    let name = `scene_${suffix}`;
    while (scenes[name]) {
      suffix += 1;
      name = `scene_${suffix}`;
    }
    setScenes((prev) => ({ ...prev, [name]: createEmptyScene(name) }));
    setSelectedSceneId(name);
    setSelectedTagId(null);
  };

  const handleRemoveScene = () => {
    if (!selectedSceneId) return;
    const remainingScenes = Object.keys(scenes).filter(
      (name) => name !== selectedSceneId
    );
    if (remainingScenes.length === 0) return;

    setScenes((prev) => {
      const next = { ...prev };
      delete next[selectedSceneId];
      return next;
    });

    setTags((prev) => prev.filter((tag) => tag.sceneId !== selectedSceneId));
    setSelectedSceneId(remainingScenes[0]);
    setSelectedTagId(null);
  };

  const handleAddTag = () => {
    if (!selectedSceneId) return;
    const usedIds = new Set(tags.map((tag) => tag.id));
    let nextId = 0;
    while (usedIds.has(nextId)) nextId += 1;

    const defaultFallback = scenes[selectedSceneId]?.fallbackOffsetDefault ?? [0, 0, 0];
    const tag = createEmptyTag(selectedSceneId, nextId, defaultFallback);
    setTags((prev) => [...prev, tag]);
    setSelectedTagId(tag.id);
  };

  const handleRemoveTag = () => {
    if (selectedTagId == null) return;
    setTags((prev) => prev.filter((tag) => tag.id !== selectedTagId));
    setSelectedTagId(null);
  };

  const handleTagField = (field, value) => {
    if (!selectedTag) return;
    handleTagUpdate(selectedTag.id, { [field]: value });
  };

  const handleVectorField = (field, index, value) => {
    if (!selectedTag) return;
    const current = selectedTag[field] ?? [0, 0, 0];
    const vector = [...current];
    vector[index] = value;
    handleTagUpdate(selectedTag.id, { [field]: vector });
  };

  const handleExport = () => {
    const scenesPayload = Object.values(scenes).reduce((acc, scene) => {
      const sceneTags = sortedTags.filter((tag) => tag.sceneId === scene.name);
      let fallbackWorld = [0, 0, 0];
      if (sceneTags.length > 0) {
        const tag = sceneTags[0];
        const rotationQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(...tag.rotation));
        const positionVec = new THREE.Vector3(...tag.position);
        const offsetVec = new THREE.Vector3(...(tag.fallbackOffset ?? [0, 0, 0])).applyQuaternion(rotationQuat).add(positionVec);
        fallbackWorld = [offsetVec.x, offsetVec.y, offsetVec.z];
      } else if (scene.fallbackOffsetDefault) {
        fallbackWorld = [...scene.fallbackOffsetDefault];
      }
      acc[scene.name] = {
        diameter: clampDecimals(scene.diameter)
      };
      return acc;
    }, {});

    const tagsPayload = sortedTags.map((tag) => {
      const rotationQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(...tag.rotation));
      const positionVec = new THREE.Vector3(...tag.position);
      const fallbackVec = new THREE.Vector3(...(tag.fallbackOffset ?? [0, 0, 0])).applyQuaternion(rotationQuat).add(positionVec);
      return {
        id: tag.id,
        sceneId: tag.sceneId,
        size: clampDecimals(tag.size),
        normalOffsetMm: clampDecimals(tag.normalOffsetMm, 3),
        position: tag.position.map((n) => clampDecimals(n)),
        rotation: tag.rotation.map((n) => clampDecimals(n, 6)),
        sphereOffset: tag.sphereOffset.map((n) => clampDecimals(n)),
        fallbackCenter: [fallbackVec.x, fallbackVec.y, fallbackVec.z].map((n) => clampDecimals(n))
      };
    });

    const payload = JSON.stringify(
      {
        scenes: scenesPayload,
        tags: tagsPayload
      },
      null,
      2
    );

    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'apriltag-config.generated.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  if (loading) {
    return (
      <div className="editor-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f1117', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
        <p>Loading AprilTag configuration…</p>
      </div>
    );
  }

  return (
    <div
      className="editor-wrapper"
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        background: '#0f1117',
        color: '#f6f7fb',
        fontFamily: 'Inter, sans-serif'
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 18,
          left: 18,
          right: 18,
          zIndex: 10,
          display: 'flex',
          gap: '16px'
        }}
      >
        <div
          style={{
            flex: '0 0 280px',
            background: 'rgba(16,18,24,0.92)',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Scenes</h2>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="button" onClick={handleAddScene} style={buttonStyle}>Add</button>
              <button type="button" onClick={handleRemoveScene} disabled={Object.keys(scenes).length <= 1} style={{ ...buttonStyle, opacity: Object.keys(scenes).length <= 1 ? 0.4 : 1 }}>Remove</button>
            </div>
          </header>

          {error && (
            <div style={{ fontSize: '12px', color: '#f87171' }}>Failed to load existing config: {error}</div>
          )}

          <select
            value={selectedSceneId}
            onChange={(event) => handleSceneChange(event.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.08)',
              background: '#1a1d24',
              color: '#f6f7fb'
            }}
          >
            {Object.keys(scenes).map((sceneKey) => (
              <option key={sceneKey} value={sceneKey}>
                {sceneKey}
              </option>
            ))}
          </select>

          {selectedScene && (
            <div style={{ display: 'grid', gap: '10px' }}>
              <label style={labelStyle}>
                Diameter (m)
                <input
                  type="number"
                  step="0.01"
                  value={selectedScene.diameter}
                  onChange={(event) => handleSceneField('diameter', Number(event.target.value))}
                  style={inputStyle}
                />
              </label>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>
                Fallback offset to anchors is configured per tag in the panel on the right.
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            flex: '0 0 320px',
            background: 'rgba(16,18,24,0.92)',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Tags</h2>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="button" onClick={handleAddTag} style={buttonStyle}>Add</button>
              <button type="button" onClick={handleRemoveTag} disabled={selectedTagId == null} style={{ ...buttonStyle, opacity: selectedTagId == null ? 0.4 : 1 }}>Remove</button>
            </div>
          </header>

          <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}>
            {sortedTags.filter((tag) => tag.sceneId === selectedSceneId).map((tag) => (
              <button
                key={tag.order}
                type="button"
                onClick={() => setSelectedTagId(tag.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 12px',
                  background: tag.id === selectedTagId ? 'rgba(59,130,246,0.25)' : 'transparent',
                  color: '#f6f7fb',
                  border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                #{tag.id} • size {tag.size.toFixed(2)}
              </button>
            ))}
            {sortedTags.filter((tag) => tag.sceneId === selectedSceneId).length === 0 && (
              <div style={{ padding: '12px', fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>No tags yet. Add one to get started.</div>
            )}
          </div>

          {selectedTag ? (
            <div style={{ display: 'grid', gap: '10px' }}>
              <label style={labelStyle}>
                Tag ID
                <input
                  type="number"
                  value={selectedTag.id}
                  onChange={(event) => {
                    const nextId = Number(event.target.value);
                    if (Number.isNaN(nextId)) return;
                    setTags((prev) => prev.map((tag) => tag.id === selectedTag.id ? { ...tag, id: nextId } : tag));
                    setSelectedTagId(nextId);
                  }}
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                Size (m)
                <input
                  type="number"
                  step="0.01"
                  value={selectedTag.size}
                  onChange={(event) => handleTagField('size', Number(event.target.value))}
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                Normal offset (mm)
                <input
                  type="number"
                  step="1"
                  value={selectedTag.normalOffsetMm}
                  onChange={(event) => handleTagField('normalOffsetMm', Number(event.target.value))}
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                Fallback offset (local XYZ, m)
                <div style={vectorRowStyle}>
                  {selectedTag.fallbackOffset.map((value, index) => (
                    <input
                      key={`fallback-${index}`}
                      type="number"
                      step="0.01"
                      value={value}
                      onChange={(event) => handleVectorField('fallbackOffset', index, Number(event.target.value))}
                      style={vectorInputStyle}
                    />
                  ))}
                </div>
              </label>
              <label style={labelStyle}>
                Position (XYZ, m)
                <div style={vectorRowStyle}>
                  {selectedTag.position.map((value, index) => (
                    <input
                      key={`pos-${index}`}
                      type="number"
                      step="0.01"
                      value={value}
                      onChange={(event) => handleVectorField('position', index, Number(event.target.value))}
                      style={vectorInputStyle}
                    />
                  ))}
                </div>
              </label>
              <label style={labelStyle}>
                Rotation (XYZ, rad)
                <div style={vectorRowStyle}>
                  {selectedTag.rotation.map((value, index) => (
                    <input
                      key={`rot-${index}`}
                      type="number"
                      step="0.01"
                      value={value}
                      onChange={(event) => handleVectorField('rotation', index, Number(event.target.value))}
                      style={vectorInputStyle}
                    />
                  ))}
                </div>
              </label>
              <label style={labelStyle}>
                Sphere offset (XYZ, m)
                <div style={vectorRowStyle}>
                  {selectedTag.sphereOffset.map((value, index) => (
                    <input
                      key={`sphere-${index}`}
                      type="number"
                      step="0.01"
                      value={value}
                      onChange={(event) => handleVectorField('sphereOffset', index, Number(event.target.value))}
                      style={vectorInputStyle}
                    />
                  ))}
                </div>
              </label>
            </div>
          ) : (
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Select a tag to edit parameters.</div>
          )}
        </div>

        <div
          style={{
            flex: '0 0 260px',
            background: 'rgba(16,18,24,0.92)',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <header>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Instructions</h2>
          </header>
          <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px', lineHeight: 1.5, color: 'rgba(255,255,255,0.85)' }}>
            <li>Pick a scene or create a new one – only diameter is stored per scene.</li>
            <li>Add AprilTag cubes and select any tag in the list to edit its parameters. Changes apply instantly in the preview.</li>
            <li>Fallback offset is defined in the tag’s local space; normal offset is measured along the local Z axis in millimetres.</li>
            <li>Tag order follows the list; remove/re-add items if you need to redraw the centerline sequence.</li>
            <li>Use <strong>Download JSON</strong> to export the current layout and replace your <code>apriltag-config.json</code>.</li>
          </ol>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: '70vh',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 18px 36px rgba(0,0,0,0.45)'
          }}
        >
          <SceneCanvas
            tags={tags}
            selectedSceneId={selectedSceneId}
            selectedTagId={selectedTagId}
          />
        </div>
      </div>

      <footer
        style={{
          position: 'absolute',
          bottom: 18,
          left: 18,
          right: 18,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10
        }}
      >
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" onClick={handleExport} style={{ ...buttonStyle, padding: '10px 18px', background: '#22c55e' }}>Download JSON</button>
        </div>
        {onExit && (
          <button type="button" onClick={onExit} style={{ ...buttonStyle, padding: '10px 18px' }}>
            Back
          </button>
        )}
      </footer>
    </div>
  );
};

const buttonStyle = {
  background: '#1b1f29',
  color: '#f6f7fb',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '8px',
  padding: '6px 12px',
  fontSize: '12px',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'background 0.2s ease, transform 0.2s ease'
};

const labelStyle = {
  display: 'grid',
  gap: '6px',
  fontSize: '12px',
  color: 'rgba(255,255,255,0.8)'
};

const inputStyle = {
  width: '100%',
  padding: '8px',
  borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.1)',
  background: '#1a1d24',
  color: '#f6f7fb'
};

const vectorRowStyle = {
  display: 'flex',
  gap: '6px'
};

const vectorInputStyle = {
  flex: 1,
  padding: '8px',
  borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.1)',
  background: '#1a1d24',
  color: '#f6f7fb'
};

export default AprilTagLayoutEditor;
