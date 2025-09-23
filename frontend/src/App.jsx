import React, { useState, useRef } from 'react';
import { ZapparCamera, InstantTracker, ZapparCanvas, Loader, BrowserCompatibility } from '@zappar/zappar-react-three-fiber';
import pipeline from './zapparPipeline';
import GLContextBinder from './GLContextBinder';
import ConsolePanel from './ConsolePanel';
import WavyGridBackground from './WavyGridBackground';


function App() {
  const [placementMode, setPlacementMode] = useState(true);
  const cameraRef = useRef();
  return (
    <>
      <WavyGridBackground />
      <ConsolePanel />
      <BrowserCompatibility />
      <ZapparCanvas>
        <ZapparCamera
          ref={cameraRef}
          pipeline={pipeline}
          // environmentMap removed temporarily to rule out side-effects
          onFirstFrame={() => console.log('First camera frame processed')}
        />
        <InstantTracker
          pipeline={pipeline}
          placementMode={placementMode}
          placementCameraOffset={[0, 0, -5]}
          placementUI="toggle"
        >
          <mesh>
            <sphereGeometry args={[0.5, 32, 32]} />
            <meshStandardMaterial color="hotpink" />
          </mesh>
        </InstantTracker>
        <GLContextBinder />
        <ambientLight intensity={0.4} />
        <directionalLight position={[2.5, 8, 5]} intensity={1.5} />
        <Loader />
      </ZapparCanvas>
      {/* Legacy manual placement UI (hidden because using placementUI="toggle") */}
      <div
        id="zappar-placement-ui"
        onClick={() => setPlacementMode(m => !m)}
        onKeyDown={() => setPlacementMode(m => !m)}
        role="button"
        tabIndex={0}
        style={{ display: 'none' }}
      >
        Tap here to {placementMode ? ' place ' : ' pick up '} the object
      </div>
    </>
  );
}

export default App;
